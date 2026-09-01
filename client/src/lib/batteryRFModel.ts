/**
 * Browser-based Machine Learning inference engine.
 *
 * Loads the 100-tree GradientBoostingRegressor / RandomForest model exported
 * from the scikit-learn pickle file (`best_battery_model.pkl`) as a compact JSON
 * structure and runs high-precision inference entirely in the browser.
 *
 * Tree JSON shape per tree:
 *   l: number[]  – left child indices  (-1 = leaf)
 *   r: number[]  – right child indices (-1 = leaf)
 *   f: number[]  – split feature index (-2 = leaf)
 *   t: number[]  – split threshold
 *   v: number[]  – leaf value (prediction / residual)
 */

import type { DatasetBatteryRecord, DatasetPrediction } from "./batteryDataset";

// ── Types ──────────────────────────────────────────────────────────────

export type MLTree = {
  l: number[];
  r: number[];
  f: number[];
  t: number[];
  v: number[];
};

export type MLModelJSON = {
  type: "GradientBoostingRegressor" | "RandomForestRegressor";
  modelName?: string;
  ne: number;          // n_estimators
  lr?: number;         // learning_rate (for GBDT)
  init?: number;       // initial constant prediction (for GBDT)
  fn: string[];        // feature_names
  fi: number[];        // feature_importances
  trees: MLTree[];
};

// Aliases for backwards compatibility
export type RFTree = MLTree;
export type RFModelJSON = MLModelJSON;

export type RFModel = {
  json: MLModelJSON;
  featureNames: string[];
  featureImportances: number[];
  nEstimators: number;
  modelType: "GradientBoostingRegressor" | "RandomForestRegressor";
  learningRate: number;
  initConstant: number;
};

// ── Constants ──────────────────────────────────────────────────────────

const BEST_MODEL_URL = "/data/best_battery_model.json";
const FALLBACK_MODEL_URL = "/data/battery_soh_model.json";

const FEATURE_LABELS: Record<string, string> = {
  Cycle: "Cycle count",
  Voltage: "Voltage",
  Current: "Current",
  Temperature: "Temperature",
  ChargeTime: "Charge duration",
  DischargeTime: "Discharge duration",
  InternalResistance: "Internal resistance",
  AmbientHumidity: "Ambient humidity",
  C_Rate: "C-rate",
};

// Map model feature names → DatasetBatteryRecord keys
const FEATURE_TO_RECORD_KEY: Record<string, keyof DatasetBatteryRecord> = {
  Cycle: "cycle",
  Voltage: "voltage",
  Current: "current",
  Temperature: "temperature",
  ChargeTime: "chargeTime",
  DischargeTime: "dischargeTime",
  InternalResistance: "internalResistance",
  AmbientHumidity: "ambientHumidity",
  C_Rate: "cRate",
};

// ── Singleton loader ───────────────────────────────────────────────────

let _cached: RFModel | null = null;
let _loading: Promise<RFModel | null> | null = null;

/** Lazily fetch and cache the best battery model JSON. Returns null on failure. */
export async function loadRFModel(): Promise<RFModel | null> {
  if (_cached) return _cached;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // 1. Try best_battery_model.json first
      let response = await fetch(BEST_MODEL_URL);
      if (!response.ok) {
        response = await fetch(FALLBACK_MODEL_URL);
      }
      if (!response.ok) return null;
      const json: MLModelJSON = await response.json();

      if (!json.trees?.length) {
        console.warn("ML model JSON has unexpected structure.");
        return null;
      }

      _cached = {
        json,
        featureNames: json.fn,
        featureImportances: json.fi,
        nEstimators: json.ne,
        modelType: json.type || "GradientBoostingRegressor",
        learningRate: json.lr ?? 0.1,
        initConstant: json.init ?? 61.3933,
      };
      return _cached;
    } catch (err) {
      console.warn("Failed to load battery ML model:", err);
      return null;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

/** Returns the cached model synchronously, or null. */
export function getCachedRFModel(): RFModel | null {
  return _cached;
}

// ── Tree inference ─────────────────────────────────────────────────────

/** Traverse a single decision tree and return its leaf prediction. */
function predictTree(tree: MLTree, features: number[]): number {
  let node = 0;
  while (tree.l[node] !== -1) {
    const featureIdx = tree.f[node];
    if (features[featureIdx] <= tree.t[node]) {
      node = tree.l[node];
    } else {
      node = tree.r[node];
    }
  }
  return tree.v[node];
}

/** Run inference over ensemble (supports both GBDT and Random Forest). */
export function predictRF(model: RFModel, features: number[]): number {
  const trees = model.json.trees;

  if (model.modelType === "GradientBoostingRegressor") {
    let prediction = model.initConstant;
    const lr = model.learningRate;
    for (let i = 0; i < trees.length; i++) {
      prediction += lr * predictTree(trees[i], features);
    }
    return prediction;
  }

  // Random Forest: simple average
  let sum = 0;
  for (let i = 0; i < trees.length; i++) {
    sum += predictTree(trees[i], features);
  }
  return sum / trees.length;
}

// ── High-level prediction ──────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Build the feature vector from a DatasetBatteryRecord. */
export function recordToFeatureVector(
  model: RFModel,
  record: DatasetBatteryRecord,
): number[] {
  return model.featureNames.map(name => {
    const key = FEATURE_TO_RECORD_KEY[name];
    if (!key) return 0;
    return record[key] as number;
  });
}

/**
 * Predict SOH for a DatasetBatteryRecord using the ML model.
 * Returns a DatasetPrediction compatible with the existing UI.
 */
export function predictDatasetBatteryWithRF(
  model: RFModel,
  record: DatasetBatteryRecord,
): DatasetPrediction {
  const features = recordToFeatureVector(model, record);
  const rawPred = predictRF(model, features);
  const predictedSoh = clamp(rawPred, 0, 100);

  // Confidence interval calculation
  const interval = clamp(Math.max(0.6, (100 - predictedSoh) * 0.05 + 0.8), 0.5, 5.0);

  const grade: DatasetPrediction["grade"] =
    predictedSoh >= 80 ? "A" : predictedSoh >= 65 ? "B" : "C";
  const lifecycle =
    grade === "A"
      ? "Continue EV operation"
      : grade === "B"
        ? "Monitor for second-life suitability"
        : "Service and recovery assessment";

  // Top drivers from feature importances
  const topDrivers = model.featureNames
    .map((name, idx) => ({
      label: FEATURE_LABELS[name] || name,
      impact: model.featureImportances[idx] * 100,
      direction: ("raises" as "raises" | "lowers"),
    }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 3);

  for (const driver of topDrivers) {
    if (
      driver.label === "Cycle count" ||
      driver.label === "Internal resistance"
    ) {
      driver.direction = "lowers";
    }
  }

  const confidence: DatasetPrediction["confidence"] = "HIGH";

  return {
    predictedSoh,
    lower: clamp(predictedSoh - interval, 0, 100),
    upper: clamp(predictedSoh + interval, 0, 100),
    coverage: "IN RANGE",
    grade,
    lifecycle,
    confidence,
    topDrivers,
  };
}

/** Convert BatteryTelemetry to 9-feature vector for the ML model */
export function telemetryToRFVector(
  model: RFModel,
  t: { cycles: number; temp: number; volt: number; resistance: number; fastCharge: number },
  baseRecord?: DatasetBatteryRecord | null,
): number[] {
  const cRate = t.fastCharge / 50;
  const cycle = t.cycles;
  const voltage = baseRecord?.voltage ?? (t.volt / 100);
  const current = baseRecord?.current ?? (0.8 + cRate * 0.4);
  const temperature = t.temp;
  const chargeTime = baseRecord?.chargeTime ?? Math.max(30, 120 - cRate * 35);
  const dischargeTime = baseRecord?.dischargeTime ?? Math.max(30, 120 - cRate * 30);
  const internalResistance = t.resistance;
  const ambientHumidity = baseRecord?.ambientHumidity ?? 50.0;

  const mapping: Record<string, number> = {
    Cycle: cycle,
    Voltage: voltage,
    Current: current,
    Temperature: temperature,
    ChargeTime: chargeTime,
    DischargeTime: dischargeTime,
    InternalResistance: internalResistance,
    AmbientHumidity: ambientHumidity,
    C_Rate: cRate,
  };

  return model.featureNames.map(name => mapping[name] ?? 0);
}

/**
 * Predict SOH and safety directly from raw BatteryTelemetry input.
 */
export function predictTelemetryWithRF(
  model: RFModel,
  telemetry: { cycles: number; temp: number; volt: number; resistance: number; fastCharge: number },
  baseRecord?: DatasetBatteryRecord | null,
): {
  soh: number;
  grade: "A" | "B" | "C";
  safety: number;
  thermal: "STABLE" | "MODERATE" | "CRITICAL";
  status: "ACTIVE" | "WATCH" | "INTERVENTION";
  factors: Array<{ label: string; value: number; tone: "cyan" | "emerald" | "amber" | "red" | "violet"; direction: "raises" | "lowers" }>;
  prediction: DatasetPrediction;
} {
  const vector = telemetryToRFVector(model, telemetry, baseRecord);
  const rawSoh = predictRF(model, vector);
  const soh = clamp(rawSoh, 0, 100);

  const grade: "A" | "B" | "C" = soh >= 80 ? "A" : soh >= 65 ? "B" : "C";

  // Thermal stress evaluation
  const thermal: "STABLE" | "MODERATE" | "CRITICAL" =
    telemetry.temp > 42 || telemetry.volt < 320
      ? "CRITICAL"
      : telemetry.temp > 35 || telemetry.resistance > 0.08
        ? "MODERATE"
        : "STABLE";

  // Safety Score (0-100)
  const safetyPenalty =
    (telemetry.temp > 35 ? (telemetry.temp - 35) * 2.5 : 0) +
    (telemetry.resistance > 0.06 ? (telemetry.resistance - 0.06) * 400 : 0) +
    (telemetry.fastCharge > 50 ? (telemetry.fastCharge - 50) * 0.3 : 0);
  const safety = clamp(Math.round(100 - safetyPenalty), 10, 100);

  const status: "ACTIVE" | "WATCH" | "INTERVENTION" =
    grade === "A" && thermal !== "CRITICAL"
      ? "ACTIVE"
      : grade === "B" || thermal === "MODERATE"
        ? "WATCH"
        : "INTERVENTION";

  // Degradation factors calculation
  const cyclePenalty = clamp((telemetry.cycles / 200) * 12, 0, 20);
  const resistancePenalty = clamp((telemetry.resistance - 0.05) * 150, 0, 15);
  const tempPenalty = telemetry.temp > 30 ? (telemetry.temp - 30) * 0.4 : 0;
  const fastChargePenalty = (telemetry.fastCharge / 100) * 2.5;

  const factors: Array<{ label: string; value: number; tone: "cyan" | "emerald" | "amber" | "red" | "violet"; direction: "raises" | "lowers" }> = [
    {
      label: "Cycle Aging",
      value: -Number(cyclePenalty.toFixed(1)),
      tone: cyclePenalty > 8 ? "red" : cyclePenalty > 4 ? "amber" : "cyan",
      direction: "lowers",
    },
    {
      label: "Internal Resistance",
      value: -Number(resistancePenalty.toFixed(1)),
      tone: resistancePenalty > 6 ? "red" : "amber",
      direction: "lowers",
    },
    {
      label: "Thermal Stress",
      value: -Number(tempPenalty.toFixed(1)),
      tone: tempPenalty > 3 ? "red" : "amber",
      direction: "lowers",
    },
    {
      label: "Fast Charge Ratio",
      value: -Number(fastChargePenalty.toFixed(1)),
      tone: fastChargePenalty > 1.5 ? "amber" : "cyan",
      direction: "lowers",
    },
  ];

  const interval = clamp(Math.max(0.6, (100 - soh) * 0.05 + 0.8), 0.5, 5.0);

  const prediction: DatasetPrediction = {
    predictedSoh: soh,
    lower: clamp(soh - interval, 0, 100),
    upper: clamp(soh + interval, 0, 100),
    coverage: "IN RANGE",
    grade,
    lifecycle:
      grade === "A"
        ? "Continue EV operation"
        : grade === "B"
          ? "Monitor for second-life suitability"
          : "Service and recovery assessment",
    confidence: "HIGH",
    topDrivers: factors.map(f => ({
      label: f.label,
      impact: Math.abs(f.value),
      direction: f.direction,
    })),
  };

  return {
    soh,
    grade,
    safety,
    thermal,
    status,
    factors,
    prediction,
  };
}

/** Null-safe helper. */
export function predictDatasetBatteryWithRFOrNull(
  model: RFModel | null,
  record: DatasetBatteryRecord | null,
): DatasetPrediction | null {
  if (!model || !record) return null;
  return predictDatasetBatteryWithRF(model, record);
}

/** Model summary label. */
export function rfModelLabel(model: RFModel): string {
  if (model.modelType === "GradientBoostingRegressor") {
    return `Gradient Boosting · ${model.nEstimators} trees`;
  }
  return `Random Forest · ${model.nEstimators} trees`;
}
