import { describe, it, expect } from "vitest";
import { dbRecordToDataset, type DbBatteryRecord } from "./pocketbase";

describe("PocketBase Record Adapter", () => {
  it("correctly converts PocketBase DB battery records to dataset record shape", () => {
    const mockDbRecord: DbBatteryRecord = {
      id: "rec123456789abc",
      batteryId: "BAT0001",
      batchId: "BatchC",
      cycle: 1,
      voltage: 3.654,
      current: 0.917,
      temperature: 25.88,
      chargeTime: 37.61,
      dischargeTime: 37.04,
      internalResistance: 0.0522,
      capacity: 2.500,
      ambientHumidity: 46.92,
      cRate: 1.158,
      soh: 100.0,
      created: "2026-08-31 18:00:00.000Z",
      updated: "2026-08-31 18:00:00.000Z",
    };

    const datasetRecord = dbRecordToDataset(mockDbRecord);

    expect(datasetRecord.batteryId).toBe("BAT0001");
    expect(datasetRecord.batchId).toBe("BatchC");
    expect(datasetRecord.cycle).toBe(1);
    expect(datasetRecord.soh).toBe(100.0);
    expect(datasetRecord.voltage).toBe(3.654);
    expect(datasetRecord.internalResistance).toBe(0.0522);
  });
});
