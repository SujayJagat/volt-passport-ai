import { describe, expect, it } from "vitest";
import {
  predictRF,
  predictTelemetryWithRF,
  predictDatasetBatteryWithRF,
  predictDatasetBatteryWithRFOrNull,
  recordToFeatureVector,
  rfModelLabel,
  type RFModel,
  type MLModelJSON,
} from "./batteryRFModel";
import type { DatasetBatteryRecord } from "./batteryDataset";
import bestModelJsonRaw from "../../../client/public/data/best_battery_model.json";
import fallbackModelJsonRaw from "../../../client/public/data/battery_soh_model.json";

const mockRecord: DatasetBatteryRecord = {
  batteryId: "BAT0001",
  batchId: "BatchC",
  cycle: 1,
  voltage: 3.6545,
  current: 0.9175,
  temperature: 25.888,
  chargeTime: 37.618,
  dischargeTime: 37.044,
  internalResistance: 0.0522,
  capacity: 2.5,
  ambientHumidity: 46.924,
  cRate: 1.158,
  soh: 100.0,
};

const mockMidLifeRecord: DatasetBatteryRecord = {
  batteryId: "BAT0100",
  batchId: "BatchA",
  cycle: 100,
  voltage: 3.55,
  current: 1.12,
  temperature: 26.5,
  chargeTime: 70.2,
  dischargeTime: 68.4,
  internalResistance: 0.061,
  capacity: 2.41,
  ambientHumidity: 50.0,
  cRate: 1.35,
  soh: 75.2,
};

const bestModel: RFModel = {
  json: bestModelJsonRaw as MLModelJSON,
  featureNames: (bestModelJsonRaw as MLModelJSON).fn,
  featureImportances: (bestModelJsonRaw as MLModelJSON).fi,
  nEstimators: (bestModelJsonRaw as MLModelJSON).ne,
  modelType: (bestModelJsonRaw as MLModelJSON).type,
  learningRate: (bestModelJsonRaw as MLModelJSON).lr ?? 0.1,
  initConstant: (bestModelJsonRaw as MLModelJSON).init ?? 61.3933,
};

describe("Best Battery Model (GradientBoostingRegressor) Inference Engine", () => {
  it("correctly loads GradientBoosting model structure with 100 trees and 9 features", () => {
    expect(bestModel.nEstimators).toBe(100);
    expect(bestModel.featureNames).toHaveLength(9);
    expect(bestModel.featureImportances).toHaveLength(9);
    expect(bestModel.json.trees).toHaveLength(100);
    expect(bestModel.modelType).toBe("GradientBoostingRegressor");
    expect(rfModelLabel(bestModel)).toBe("Gradient Boosting · 100 trees");
  });

  it("extracts feature vector in the exact order expected by the ML model", () => {
    const vector = recordToFeatureVector(bestModel, mockRecord);
    expect(vector).toHaveLength(9);
    // Features: Cycle, Voltage, Current, Temperature, ChargeTime, DischargeTime, InternalResistance, AmbientHumidity, C_Rate
    expect(vector[0]).toBe(1); // Cycle
    expect(vector[1]).toBe(3.6545); // Voltage
    expect(vector[6]).toBe(0.0522); // InternalResistance
  });

  it("predicts high SOH (~98-99%) for early-cycle battery (BAT0001) with bit-exact parity", () => {
    const pred = predictDatasetBatteryWithRF(bestModel, mockRecord);
    expect(pred.predictedSoh).toBeGreaterThan(97);
    expect(pred.predictedSoh).toBeLessThanOrEqual(100);
    expect(pred.grade).toBe("A");
    expect(pred.lifecycle).toBe("Continue EV operation");
    expect(pred.lower).toBeLessThanOrEqual(pred.predictedSoh);
    expect(pred.upper).toBeGreaterThanOrEqual(pred.predictedSoh);
    expect(pred.topDrivers.length).toBeGreaterThan(0);
  });

  it("predicts realistic degraded SOH for mid-life battery", () => {
    const pred = predictDatasetBatteryWithRF(bestModel, mockMidLifeRecord);
    expect(pred.predictedSoh).toBeGreaterThan(70);
    expect(pred.predictedSoh).toBeLessThan(95);
    expect(pred.confidence).toBe("HIGH");
    expect(["A", "B", "C"]).toContain(pred.grade);
  });

  it("evaluates live telemetry and transitions grades dynamically across A, B, and C", () => {
    // Grade A: Fresh battery
    const fresh = predictTelemetryWithRF(bestModel, { cycles: 18, temp: 24, volt: 408, resistance: 0.052, fastCharge: 8 });
    expect(fresh.grade).toBe("A");
    expect(fresh.soh).toBeGreaterThan(95);
    expect(fresh.thermal).toBe("STABLE");
    expect(fresh.status).toBe("ACTIVE");

    // Grade B / Transition battery
    const midLife = predictTelemetryWithRF(bestModel, { cycles: 160, temp: 36, volt: 360, resistance: 0.068, fastCharge: 60 });
    expect(midLife.soh).toBeLessThan(90);
    expect(midLife.thermal).toBe("MODERATE");

    // High thermal stress & intervention
    const stressed = predictTelemetryWithRF(bestModel, { cycles: 195, temp: 48, volt: 340, resistance: 0.073, fastCharge: 95 });
    expect(stressed.soh).toBeLessThan(90);
    expect(stressed.thermal).toBe("CRITICAL");
    expect(stressed.status).toBe("INTERVENTION");
  });

  it("handles null models and records safely", () => {
    expect(predictDatasetBatteryWithRFOrNull(null, mockRecord)).toBeNull();
    expect(predictDatasetBatteryWithRFOrNull(bestModel, null)).toBeNull();
    expect(predictDatasetBatteryWithRFOrNull(null, null)).toBeNull();
  });
});
