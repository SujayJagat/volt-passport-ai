import { useEffect, useMemo, useState } from "react";
import { predictBatteryHealth, type BatteryHealthModel, type ModelFeatureImpact } from "./batteryML";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";

export type BatteryTelemetry = { cycles: number; temp: number; volt: number; resistance: number; fastCharge: number };

export type BatteryFactor = ModelFeatureImpact;

export type BatteryAssessment = {
  soh: number;
  safety: number;
  grade: "A" | "B" | "C";
  thermal: "STABLE" | "MODERATE" | "CRITICAL";
  status: "ACTIVE" | "WATCH" | "INTERVENTION";
  factors: BatteryFactor[];
  modelLabel: string;
  mode: "BASELINE" | "TRAINED";
  predictionInterval?: { lower: number; upper: number };
  validation?: BatteryHealthModel["validation"];
  coverage?: "IN RANGE" | "EXTRAPOLATING";
};

export const defaultTelemetry: BatteryTelemetry = { cycles: 438, temp: 29, volt: 392, resistance: .078, fastCharge: 31 };
export const batteryPresets: Record<string, BatteryTelemetry> = {
  "New pack": { cycles: 18, temp: 24, volt: 408, resistance: .052, fastCharge: 8 },
  "Mid-life fleet EV": { cycles: 842, temp: 34, volt: 374, resistance: .118, fastCharge: 54 },
  "Thermal stress": { cycles: 1280, temp: 47, volt: 351, resistance: .182, fastCharge: 76 },
};

const STORAGE_KEY = "voltpassport-local-telemetry";
const MODEL_STORAGE_KEY = "voltpassport-local-ridge-model";

export function loadTelemetry(): BatteryTelemetry {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultTelemetry;
    const value = JSON.parse(stored) as Partial<BatteryTelemetry>;
    return { ...defaultTelemetry, ...value };
  } catch {
    return defaultTelemetry;
  }
}

export function saveTelemetry(telemetry: BatteryTelemetry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetry));
  } catch {}
}

export function loadBatteryHealthModel(): BatteryHealthModel | null {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (!stored) return null;
    const model = JSON.parse(stored) as BatteryHealthModel;
    if (model.version !== "ridge-v1" || model.coefficients.length !== 6 || model.means.length !== 5 || model.scales.some(scale => !Number.isFinite(scale) || scale <= 0)) return null;
    return model;
  } catch {
    return null;
  }
}

export function saveBatteryHealthModel(model: BatteryHealthModel | null) {
  if (model) {
    try { localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(model)); } catch {}
  } else {
    try { localStorage.removeItem(MODEL_STORAGE_KEY); } catch {}
  }
}

function classify(soh: number, thermal: BatteryAssessment["thermal"]) {
  const grade: BatteryAssessment["grade"] = soh >= 80 ? "A" : soh >= 65 ? "B" : "C";
  const status: BatteryAssessment["status"] = grade === "C" || thermal === "CRITICAL" ? "INTERVENTION" : grade === "B" || thermal === "MODERATE" ? "WATCH" : "ACTIVE";
  return { grade, status };
}

/** Baseline heuristic fallback when no ML model is available */
export function assessBattery(t: BatteryTelemetry): BatteryAssessment {
  const cycleLoss = (t.cycles / 2000) * 12;
  const fastLoss = (t.fastCharge / 100) * 8;
  const thermalLoss = Math.max(0, t.temp - 30) * 0.4;
  const resistanceLoss = Math.max(0, t.resistance - 0.045) * 35;
  const soh = Math.max(10, Math.min(100, 100 - cycleLoss - fastLoss - thermalLoss - resistanceLoss));
  const safety = Math.max(0, Math.min(100, 100 - Math.max(0, t.temp - 35) * 3 - Math.max(0, t.resistance - 0.12) * 260));
  const thermal: BatteryAssessment["thermal"] = t.temp > 42 ? "CRITICAL" : t.temp > 34 ? "MODERATE" : "STABLE";
  const { grade, status } = classify(soh, thermal);
  return {
    soh,
    safety,
    grade,
    thermal,
    status,
    modelLabel: "Safety baseline",
    mode: "BASELINE",
    factors: [
      { label: "Cycle aging", value: -cycleLoss, tone: "cyan", direction: "lowers" },
      { label: "Fast charging", value: -fastLoss, tone: "amber", direction: "lowers" },
      { label: "Thermal stress", value: -thermalLoss, tone: "red", direction: "lowers" },
      { label: "Resistance", value: -resistanceLoss, tone: "violet", direction: "lowers" },
    ],
  };
}

export function assessWithTrainedModel(telemetry: BatteryTelemetry, model: BatteryHealthModel): BatteryAssessment {
  const safetyFallback = assessBattery(telemetry);
  const prediction = predictBatteryHealth(model, telemetry);
  const { grade, status } = classify(prediction.soh, safetyFallback.thermal);
  return {
    ...safetyFallback,
    soh: prediction.soh,
    grade,
    status,
    factors: prediction.factors,
    modelLabel: "Local ridge regression",
    mode: "TRAINED",
    predictionInterval: { lower: prediction.lower, upper: prediction.upper },
    validation: model.validation,
    coverage: prediction.coverage,
  };
}

/**
 * useLocalBattery hook connected to the app-wide BatteryDatasetContext.
 * Ensures state is globally synchronized across all pages.
 */
export function useLocalBattery() {
  try {
    const ctx = useBatteryDataset();
    return {
      telemetry: ctx.telemetry,
      setTelemetry: ctx.setTelemetry,
      result: ctx.assessment,
      model: ctx.model,
      setModel: () => {},
      clearModel: () => {},
    };
  } catch {
    const [telemetry, setTelemetry] = useState<BatteryTelemetry>(loadTelemetry);
    const result = useMemo(() => assessBattery(telemetry), [telemetry]);
    return {
      telemetry,
      setTelemetry,
      result,
      model: null,
      setModel: () => {},
      clearModel: () => {},
    };
  }
}
