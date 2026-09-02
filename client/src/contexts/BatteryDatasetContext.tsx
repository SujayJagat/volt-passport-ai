import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DATASET_URL,
  datasetRecordToLocalTelemetry,
  findDatasetBattery,
  parseBatteryDatasetCsv,
  predictDatasetBatteryOrNull,
  trainDatasetHealthModel,
  type DatasetBatteryRecord,
  type DatasetHealthModel,
  type DatasetPrediction,
} from "@/lib/batteryDataset";
import {
  loadRFModel,
  predictTelemetryWithRF,
  type RFModel,
} from "@/lib/batteryRFModel";
import {
  defaultTelemetry,
  batteryPresets,
  loadTelemetry,
  saveTelemetry,
  assessBattery,
  type BatteryTelemetry,
  type BatteryAssessment,
} from "@/lib/battery";
import {
  getDbBatteryRecords,
  getDbBatteryById,
  savePassportToDb,
  getPassportsFromDb,
  saveAssessmentToDb,
  getAssessmentsFromDb,
  type DbPassport,
  type DbTelemetryAssessment,
} from "@/lib/pocketbase";
import { generatePassportFingerprint } from "@/lib/passportCrypto";
import { useAuthSafe } from "./AuthContext";

export type BatteryDatasetContextValue = {
  records: DatasetBatteryRecord[];
  userBatteries: DatasetBatteryRecord[];
  model: DatasetHealthModel | null;
  rfModel: RFModel | null;
  rfModelLoaded: boolean;
  activeBatteryId: string;
  activeRecord: DatasetBatteryRecord | null;
  telemetry: BatteryTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<BatteryTelemetry>>;
  isManualSimulation: boolean;
  setIsManualSimulation: (val: boolean) => void;
  toggleManualSimulation: () => void;
  resetToAuthenticTelemetry: () => void;
  setPreset: (name: keyof typeof batteryPresets) => void;
  prediction: DatasetPrediction;
  assessment: BatteryAssessment;
  soh: number;
  grade: "A" | "B" | "C";
  loading: boolean;
  error: string | null;
  isFromDb: boolean;
  userPassports: DbPassport[];
  userAssessments: DbTelemetryAssessment[];
  selectBatteryId: (batteryId: string) => Promise<{ found: boolean; record: DatasetBatteryRecord | null }>;
  clearBatteryId: () => void;
  saveCurrentPassport: (notes?: string) => Promise<{ success: boolean; passport?: DbPassport; error?: string }>;
  saveCurrentAssessment: (assessmentData: any) => Promise<{ success: boolean; assessment?: DbTelemetryAssessment; error?: string }>;
  refreshSavedData: () => Promise<void>;
};

const BatteryDatasetContext = createContext<BatteryDatasetContextValue | null>(null);
const ACTIVE_BATTERY_KEY = "voltpassport-active-dataset-battery";

function storedBatteryId() {
  try {
    return localStorage.getItem(ACTIVE_BATTERY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function BatteryDatasetProvider({ children }: { children: React.ReactNode }) {
  const { user, claimedBatteries, setActiveBattery } = useAuthSafe();
  const [records, setRecords] = useState<DatasetBatteryRecord[]>([]);
  const [model, setModel] = useState<DatasetHealthModel | null>(null);
  const [rfModel, setRfModel] = useState<RFModel | null>(null);
  const [rfModelLoaded, setRfModelLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromDb, setIsFromDb] = useState(false);
  const [activeBatteryId, setActiveBatteryId] = useState(() => {
    return storedBatteryId() || "BAT0001";
  });
  const [telemetry, setTelemetryState] = useState<BatteryTelemetry>(loadTelemetry);
  const [isManualSimulation, setIsManualSimulation] = useState(false);
  const [userPassports, setUserPassports] = useState<DbPassport[]>([]);
  const [userAssessments, setUserAssessments] = useState<DbTelemetryAssessment[]>([]);

  // Persistent telemetry updater
  const setTelemetry = useCallback((updater: React.SetStateAction<BatteryTelemetry>) => {
    setTelemetryState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveTelemetry(next);
      return next;
    });
  }, []);

  // Sync activeBatteryId with user's claimed batteries
  useEffect(() => {
    if (user?.activeBatteryId && user.activeBatteryId !== activeBatteryId) {
      setActiveBatteryId(user.activeBatteryId);
    } else if (claimedBatteries.length > 0 && !claimedBatteries.includes(activeBatteryId)) {
      setActiveBatteryId(claimedBatteries[0]);
    }
  }, [user?.activeBatteryId, claimedBatteries, activeBatteryId]);

  // Load dataset: try PocketBase DB first, fallback to static CSV
  // Also load the RF model in parallel
  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      setLoading(true);
      setError(null);

      // Load RF model in parallel (non-blocking)
      loadRFModel().then(loaded => {
        if (!cancelled && loaded) {
          setRfModel(loaded);
          setRfModelLoaded(true);
        }
      });

      // Attempt 1: Fetch from PocketBase collection
      try {
        const dbResult = await getDbBatteryRecords(1, 300);
        if (dbResult.items.length >= 20) {
          if (!cancelled) {
            setRecords(dbResult.items);
            setIsFromDb(true);
            try {
              const trainedModel = trainDatasetHealthModel(dbResult.items);
              setModel(trainedModel);
            } catch { /* ignore */ }
            setLoading(false);
            return;
          }
        }
      } catch (dbErr) {
        console.warn("PocketBase database query fallback to CSV:", dbErr);
      }

      // Attempt 2: Fetch from CSV
      try {
        const response = await fetch(DATASET_URL);
        if (!response.ok) throw new Error("The battery dataset could not be loaded from database or file.");
        const text = await response.text();
        const parsed = parseBatteryDatasetCsv(text);
        if (parsed.errors.length > 0) throw new Error(parsed.errors.slice(0, 2).join(" "));
        const trainedModel = trainDatasetHealthModel(parsed.records);
        if (!cancelled) {
          setRecords(parsed.records);
          setModel(trainedModel);
          setIsFromDb(false);
          setLoading(false);
        }
      } catch (reason: any) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "The supplied battery dataset could not be prepared.");
          setLoading(false);
        }
      }
    }

    loadDataset();
    return () => { cancelled = true; };
  }, []);

  // Fetch saved passports and assessments from PocketBase
  const refreshSavedData = useCallback(async () => {
    try {
      const [passports, assessments] = await Promise.all([
        getPassportsFromDb(user?.id),
        getAssessmentsFromDb(user?.id),
      ]);
      setUserPassports(passports);
      setUserAssessments(assessments);
    } catch (err) {
      console.warn("Failed to load user records from PocketBase:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshSavedData();
  }, [refreshSavedData]);

  // Active record from dataset
  const activeRecord = useMemo(() => findDatasetBattery(records, activeBatteryId), [records, activeBatteryId]);

  // User's claimed batteries records
  const userBatteries = useMemo(() => {
    if (claimedBatteries.length === 0) {
      return activeRecord ? [activeRecord] : [];
    }
    return records.filter(r => claimedBatteries.includes(r.batteryId));
  }, [records, claimedBatteries, activeRecord]);

  // Reset telemetry to authentic database values
  const resetToAuthenticTelemetry = useCallback(() => {
    if (activeRecord) {
      const authentic = datasetRecordToLocalTelemetry(activeRecord);
      setTelemetry(authentic);
      setIsManualSimulation(false);
    }
  }, [activeRecord, setTelemetry]);

  // When active record changes and NOT in manual simulation, automatically sync authentic telemetry
  useEffect(() => {
    if (activeRecord && !isManualSimulation) {
      const authentic = datasetRecordToLocalTelemetry(activeRecord);
      setTelemetry(authentic);
    }
  }, [activeRecord, isManualSimulation, setTelemetry]);

  const toggleManualSimulation = useCallback(() => {
    setIsManualSimulation(prev => !prev);
  }, []);

  // Quick preset helper
  const setPreset = useCallback((name: keyof typeof batteryPresets) => {
    const preset = batteryPresets[name];
    if (preset) {
      setIsManualSimulation(true);
      setTelemetry(preset);
    }
  }, [setTelemetry]);

  // Unified evaluation: Evaluates the active live telemetry with the 100-tree Random Forest model
  const { prediction, assessment } = useMemo(() => {
    if (rfModel) {
      const res = predictTelemetryWithRF(rfModel, telemetry, activeRecord);
      const assessmentResult: BatteryAssessment = {
        soh: res.soh,
        safety: res.safety,
        grade: res.grade,
        thermal: res.thermal,
        status: res.status,
        factors: res.factors,
        modelLabel: rfModel.json.modelName || (rfModel.modelType === "GradientBoostingRegressor" ? "Gradient Boosting (100 Trees · scikit-learn)" : "Random Forest (100 Trees · scikit-learn)"),
        mode: "TRAINED",
        predictionInterval: { lower: res.prediction.lower, upper: res.prediction.upper },
        coverage: res.prediction.coverage,
      };
      return { prediction: res.prediction, assessment: assessmentResult };
    }

    // Fallback if RF model is still downloading
    const baseAssessment = assessBattery(telemetry);
    const basePrediction: DatasetPrediction = {
      predictedSoh: baseAssessment.soh,
      lower: Math.max(0, baseAssessment.soh - 2.5),
      upper: Math.min(100, baseAssessment.soh + 2.5),
      coverage: "IN RANGE",
      grade: baseAssessment.grade,
      lifecycle: baseAssessment.grade === "A" ? "Continue EV operation" : baseAssessment.grade === "B" ? "Monitor for second-life suitability" : "Service and recovery assessment",
      confidence: "HIGH",
      topDrivers: [
        { label: "Cycle history", impact: 12.0, direction: "lowers" },
        { label: "Internal resistance", impact: 4.5, direction: "lowers" },
        { label: "Thermal stress", impact: 2.0, direction: "lowers" },
      ],
    };
    return { prediction: basePrediction, assessment: baseAssessment };
  }, [rfModel, telemetry, activeRecord]);

  // Select a Battery ID
  const selectBatteryId = useCallback(async (batteryId: string) => {
    const normalized = batteryId.trim().toUpperCase();
    
    // First check in-memory records
    let record = findDatasetBattery(records, normalized);

    // If not found in memory, query PocketBase directly
    if (!record) {
      try {
        record = await getDbBatteryById(normalized);
        if (record) {
          setRecords(prev => [...prev, record!]);
        }
      } catch { /* ignore */ }
    }

    if (record) {
      setActiveBatteryId(record.batteryId);
      setActiveBattery(record.batteryId);
      setIsManualSimulation(false);
      const newTelemetry = datasetRecordToLocalTelemetry(record);
      setTelemetry(newTelemetry);
      try {
        localStorage.setItem(ACTIVE_BATTERY_KEY, record.batteryId);
      } catch { /* ignore */ }
    }
    return { found: Boolean(record), record };
  }, [records, setActiveBattery, setTelemetry]);

  const clearBatteryId = useCallback(() => {
    setActiveBatteryId("");
    try { localStorage.removeItem(ACTIVE_BATTERY_KEY); } catch { /* ignore */ }
  }, []);

  // Save current passport to PocketBase
  const saveCurrentPassport = useCallback(async (notes?: string) => {
    try {
      const batId = activeRecord?.batteryId || activeBatteryId || "VPA-CUSTOM";
      const { hash } = await generatePassportFingerprint({
        batteryId: batId,
        batchId: activeRecord?.batchId || "Verified Battery Pack",
        soh: assessment.soh,
        grade: assessment.grade,
        status: assessment.grade === "A" ? "EV READY" : assessment.grade === "B" ? "SECOND-LIFE REVIEW" : "SERVICE REVIEW",
        lifecycle: prediction.lifecycle,
        cycle: activeRecord?.cycle ?? telemetry.cycles,
        temp: telemetry.temp,
        volt: telemetry.volt,
        resistance: telemetry.resistance,
        fastCharge: telemetry.fastCharge,
        modelLabel: rfModelLoaded ? "Random Forest (100 Trees)" : prediction ? "Ridge Regression" : "Safety Baseline",
        issuedAt: new Date().toISOString().slice(0, 10),
        issuer: user?.name ? `${user.name} (VoltPassport AI)` : "VoltPassport AI Authority",
      });

      const saved = await savePassportToDb({
        batteryId: batId,
        batchId: activeRecord?.batchId || "Verified Battery Pack",
        user: user?.id,
        soh: assessment.soh,
        grade: assessment.grade,
        status: assessment.grade === "A" ? "EV READY" : assessment.grade === "B" ? "SECOND-LIFE REVIEW" : "SERVICE REVIEW",
        lifecycle: prediction.lifecycle,
        hash: hash,
        primaryDriver: prediction.topDrivers[0]?.label || "Cycle history",
        confidence: prediction.confidence || "HIGH",
        telemetry: telemetry as any,
        notes: notes || `Verified passport record generated via VoltPassport AI.`,
      });
      await refreshSavedData();
      return { success: true, passport: saved };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to save passport to database." };
    }
  }, [activeRecord, activeBatteryId, assessment, prediction, telemetry, rfModelLoaded, user, refreshSavedData]);

  // Save telemetry assessment to PocketBase
  const saveCurrentAssessment = useCallback(async (assessmentData: any) => {
    try {
      const saved = await saveAssessmentToDb({
        batteryId: activeRecord?.batteryId || activeBatteryId || "CUSTOM",
        user: user?.id,
        cycles: assessmentData.cycles ?? telemetry.cycles,
        temp: assessmentData.temp ?? telemetry.temp,
        volt: assessmentData.volt ?? telemetry.volt,
        resistance: assessmentData.resistance ?? telemetry.resistance,
        fastCharge: assessmentData.fastCharge ?? telemetry.fastCharge,
        soh: assessmentData.soh ?? assessment.soh,
        grade: assessmentData.grade ?? assessment.grade,
        safety: assessmentData.safety ?? assessment.safety,
        thermal: assessmentData.thermal ?? assessment.thermal,
        mode: assessmentData.mode ?? assessment.mode,
        factors: assessmentData.factors ?? assessment.factors,
      });
      await refreshSavedData();
      return { success: true, assessment: saved };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to save assessment to database." };
    }
  }, [activeRecord?.batteryId, activeBatteryId, telemetry, assessment, user?.id, refreshSavedData]);

  const value = useMemo<BatteryDatasetContextValue>(() => ({
    records,
    userBatteries,
    model,
    rfModel,
    rfModelLoaded,
    activeBatteryId,
    activeRecord,
    telemetry,
    setTelemetry,
    isManualSimulation,
    setIsManualSimulation,
    toggleManualSimulation,
    resetToAuthenticTelemetry,
    setPreset,
    prediction,
    assessment,
    soh: assessment.soh,
    grade: assessment.grade,
    loading,
    error,
    isFromDb,
    userPassports,
    userAssessments,
    selectBatteryId,
    clearBatteryId,
    saveCurrentPassport,
    saveCurrentAssessment,
    refreshSavedData,
  }), [
    records,
    userBatteries,
    model,
    rfModel,
    rfModelLoaded,
    activeBatteryId,
    activeRecord,
    telemetry,
    setTelemetry,
    isManualSimulation,
    toggleManualSimulation,
    resetToAuthenticTelemetry,
    setPreset,
    prediction,
    assessment,
    loading,
    error,
    isFromDb,
    userPassports,
    userAssessments,
    selectBatteryId,
    clearBatteryId,
    saveCurrentPassport,
    saveCurrentAssessment,
    refreshSavedData,
  ]);

  return <BatteryDatasetContext.Provider value={value}>{children}</BatteryDatasetContext.Provider>;
}

export function useBatteryDataset() {
  const context = useContext(BatteryDatasetContext);
  if (!context) throw new Error("useBatteryDataset must be used inside BatteryDatasetProvider.");
  return context;
}
