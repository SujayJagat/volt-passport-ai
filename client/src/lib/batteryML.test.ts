import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assessWithTrainedModel, defaultTelemetry, loadBatteryHealthModel, loadTelemetry } from "./battery";
import { MIN_TRAINING_ROWS, parseBatteryTrainingCsv, predictBatteryHealth, trainBatteryHealthModel, type BatteryTrainingRow } from "./batteryML";

function dataset(): BatteryTrainingRow[] {
  return Array.from({ length: MIN_TRAINING_ROWS + 5 }, (_, index) => {
    const cycles = 80 + index * 61 + (index % 3) * 17;
    const temp = 21 + (index * 7) % 22;
    const volt = 414 - index * 2 - (index % 4) * 3;
    const resistance = .05 + index * .004 + (index % 3) * .001;
    const fastCharge = 8 + (index * 13) % 74;
    const soh = 99 - cycles * .007 - Math.max(0, temp - 30) * .33 - (resistance - .045) * 36 - fastCharge * .035 + (volt - 360) * .025;
    return { cycles, temp, volt, resistance, fastCharge, soh };
  });
}

function browserStorage(values: Record<string, string> = {}) {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; },
    removeItem: (key: string) => { delete values[key]; },
  };
}

describe("local battery health regression", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the documented CSV contract and rejects missing target labels", () => {
    const valid = parseBatteryTrainingCsv("cycles,temp,volt,resistance,fastCharge,soh\n100,25,400,0.06,10,96\n");
    const missingTarget = parseBatteryTrainingCsv("cycles,temp,volt,resistance,fastCharge\n100,25,400,0.06,10\n");

    expect(valid.rows).toHaveLength(1);
    expect(valid.errors[0]).toContain("At least");
    expect(missingTarget.rows).toHaveLength(0);
    expect(missingTarget.errors[0]).toContain("soh");
  });

  it("trains locally with a deterministic holdout and returns bounded predictions", () => {
    const model = trainBatteryHealthModel(dataset());
    const prediction = predictBatteryHealth(model, defaultTelemetry);

    expect(model.trainingRows).toBeGreaterThanOrEqual(20);
    expect(model.validation.heldoutRows).toBeGreaterThan(0);
    expect(Number.isFinite(model.validation.mae)).toBe(true);
    expect(prediction.soh).toBeGreaterThanOrEqual(0);
    expect(prediction.soh).toBeLessThanOrEqual(100);
    expect(prediction.lower).toBeLessThanOrEqual(prediction.soh);
    expect(prediction.upper).toBeGreaterThanOrEqual(prediction.soh);
    expect(prediction.factors).toHaveLength(5);
  });

  it("widens the prediction interval rather than failing for unseen telemetry", () => {
    const model = trainBatteryHealthModel(dataset());
    const inRange = predictBatteryHealth(model, dataset()[2]);
    const unseen = predictBatteryHealth(model, { cycles: 9000, temp: 82, volt: 120, resistance: .6, fastCharge: 100 });

    expect(unseen.coverage).toBe("EXTRAPOLATING");
    expect(unseen.uncertainty).toBeGreaterThanOrEqual(inRange.uncertainty);
    expect(Number.isFinite(unseen.soh)).toBe(true);
  });

  it("falls back safely when browser telemetry or the stored model is corrupt", () => {
    vi.stubGlobal("localStorage", browserStorage({
      "voltpassport-local-telemetry": "{not-json",
      "voltpassport-local-ridge-model": "{not-json",
    }));

    expect(loadTelemetry()).toEqual(defaultTelemetry);
    expect(loadBatteryHealthModel()).toBeNull();
  });

  it("keeps a trained-model prediction subject to thermal risk classification", () => {
    const model = trainBatteryHealthModel(dataset());
    const assessment = assessWithTrainedModel({ ...defaultTelemetry, temp: 50 }, model);

    expect(assessment.mode).toBe("TRAINED");
    expect(assessment.predictionInterval).toBeDefined();
    expect(assessment.thermal).toBe("CRITICAL");
    expect(assessment.status).toBe("INTERVENTION");
  });
});
