import { describe, expect, it } from "vitest";
import { findDatasetBattery, parseBatteryDatasetCsv, predictDatasetBatteryOrNull, trainDatasetHealthModel, type DatasetBatteryRecord } from "./batteryDataset";

const DATASET_SAMPLE = `BatteryID,BatchID,Cycle,Voltage,Current,Temperature,ChargeTime,DischargeTime,InternalResistance,Capacity,AmbientHumidity,C_Rate,SOH
BAT0001,BatchC,1,3.654513540254056,0.9175527224939849,25.888505004666268,37.61838782261661,37.044703265688824,0.052224334895177325,2.500157267479604,46.924727901909215,1.158641932357813,100.0
BAT1001,BatchB,1001,3.665544589453374,0.9031964225452972,17.96841268164083,111.85998855934822,97.35567205887688,0.1487573848172578,1.9903766330503987,67.96388355713705,0.9268500651197776,60.35516974398891`;

function modelRows(): DatasetBatteryRecord[] {
  return Array.from({ length: 105 }, (_, index) => {
    const cycle = index + 1;
    const voltage = 3.1 + (index % 12) * .08;
    const current = .55 + (index % 8) * .16;
    const temperature = 14 + (index % 17);
    const chargeTime = 35 + (index % 13) * 6;
    const dischargeTime = 42 + (index % 11) * 7;
    const internalResistance = .05 + cycle * .00012;
    const capacity = 2.5 - cycle * .003;
    const ambientHumidity = 34 + (index % 9) * 4;
    const cRate = .6 + (index % 7) * .18;
    return { batteryId: `UNIT${String(cycle).padStart(4, "0")}`, batchId: "UnitBatch", cycle, voltage, current, temperature, chargeTime, dischargeTime, internalResistance, capacity, ambientHumidity, cRate, soh: 99 - cycle * .24 - internalResistance * 12 + capacity * .2 };
  });
}

describe("supplied battery dataset schema", () => {
  it("maps all supplied telemetry columns and finds IDs case-insensitively", () => {
    const parsed = parseBatteryDatasetCsv(DATASET_SAMPLE);
    const matched = findDatasetBattery(parsed.records, "bat1001");

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.records).toHaveLength(2);
    expect(matched).toMatchObject({ batteryId: "BAT1001", batchId: "BatchB", cycle: 1001, soh: 60.35516974398891 });
  });

  it("rejects a CSV that cannot support state-of-health prediction", () => {
    const invalid = parseBatteryDatasetCsv("BatteryID,BatchID,Cycle\nBAT0001,BatchC,1");

    expect(invalid.records).toHaveLength(0);
    expect(invalid.errors[0]).toContain("SOH");
    expect(findDatasetBattery([], "BAT0001")).toBeNull();
  });

  it("keeps unmatched IDs and unavailable models on the safe fallback path", () => {
    const parsed = parseBatteryDatasetCsv(DATASET_SAMPLE);

    expect(findDatasetBattery(parsed.records, "UNKNOWN9")).toBeNull();
    expect(() => trainDatasetHealthModel([])).toThrow("At least 100 complete battery records");
    expect(predictDatasetBatteryOrNull(null, parsed.records[0])).toBeNull();
    expect(predictDatasetBatteryOrNull(null, null)).toBeNull();
  });

  it("returns no prediction when a valid model has no active battery record", () => {
    const model = trainDatasetHealthModel(modelRows());

    expect(predictDatasetBatteryOrNull(model, null)).toBeNull();
  });
});
