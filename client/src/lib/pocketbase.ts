import PocketBase from "pocketbase";
import type { DatasetBatteryRecord } from "./batteryDataset";

export const POCKETBASE_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

export const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

export type DbBatteryRecord = {
  id: string;
  batteryId: string;
  batchId: string;
  cycle: number;
  voltage: number;
  current: number;
  temperature: number;
  chargeTime: number;
  dischargeTime: number;
  internalResistance: number;
  capacity: number;
  ambientHumidity: number;
  cRate: number;
  soh: number;
  created: string;
  updated: string;
};

export type DbPassport = {
  id: string;
  batteryId: string;
  batchId?: string;
  user?: string;
  soh: number;
  grade: string;
  status?: string;
  lifecycle?: string;
  hash?: string;
  primaryDriver?: string;
  confidence?: string;
  telemetry?: Record<string, any>;
  notes?: string;
  created: string;
  updated: string;
};

export type DbTelemetryAssessment = {
  id: string;
  batteryId?: string;
  user?: string;
  cycles: number;
  temp: number;
  volt: number;
  resistance: number;
  fastCharge: number;
  soh: number;
  grade: string;
  safety: number;
  thermal: string;
  mode?: string;
  factors?: Array<{ label: string; value: number; tone: string; direction: string }>;
  created: string;
  updated: string;
};

export type DbUser = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  activeBatteryId?: string;
  verified?: boolean;
};

/** Convert PocketBase DB record to client's DatasetBatteryRecord */
export function dbRecordToDataset(r: DbBatteryRecord): DatasetBatteryRecord {
  return {
    batteryId: r.batteryId,
    batchId: r.batchId,
    cycle: r.cycle,
    voltage: r.voltage,
    current: r.current,
    temperature: r.temperature,
    chargeTime: r.chargeTime,
    dischargeTime: r.dischargeTime,
    internalResistance: r.internalResistance,
    capacity: r.capacity,
    ambientHumidity: r.ambientHumidity,
    cRate: r.cRate,
    soh: r.soh,
  };
}

/** Check if PocketBase backend is reachable */
export async function checkPocketBaseHealth(): Promise<boolean> {
  try {
    const res = await pb.health.check();
    return res.code === 200;
  } catch {
    return false;
  }
}

/** Fetch battery records from PocketBase with pagination */
export async function getDbBatteryRecords(page = 1, perPage = 200, filter = ""): Promise<{ items: DatasetBatteryRecord[]; totalItems: number }> {
  const options: Record<string, any> = {
    sort: "cycle",
  };
  if (filter && filter.trim()) {
    options.filter = filter.trim();
  }
  const result = await pb.collection("battery_records").getList<DbBatteryRecord>(page, perPage, options);
  return {
    items: result.items.map(dbRecordToDataset),
    totalItems: result.totalItems,
  };
}

/** Lookup single battery by its BatteryID (e.g. BAT0001) */
export async function getDbBatteryById(batteryId: string): Promise<DatasetBatteryRecord | null> {
  try {
    const normalized = batteryId.trim().toUpperCase();
    const result = await pb.collection("battery_records").getFirstListItem<DbBatteryRecord>(`batteryId = "${normalized}"`);
    return dbRecordToDataset(result);
  } catch {
    return null;
  }
}

/** Save a digital battery passport record */
export async function savePassportToDb(data: Partial<DbPassport>): Promise<DbPassport> {
  return await pb.collection("passports").create<DbPassport>(data);
}

/** Fetch passports list */
export async function getPassportsFromDb(userId?: string): Promise<DbPassport[]> {
  try {
    const options: Record<string, any> = {
      sort: "-id",
    };
    if (userId && userId.trim()) {
      options.filter = `user = "${userId.trim()}"`;
    }
    const list = await pb.collection("passports").getList<DbPassport>(1, 50, options);
    return list.items;
  } catch {
    return [];
  }
}

/** Save telemetry assessment */
export async function saveAssessmentToDb(data: Partial<DbTelemetryAssessment>): Promise<DbTelemetryAssessment> {
  return await pb.collection("telemetry_assessments").create<DbTelemetryAssessment>(data);
}

/** Fetch telemetry assessments */
export async function getAssessmentsFromDb(userId?: string): Promise<DbTelemetryAssessment[]> {
  try {
    const options: Record<string, any> = {
      sort: "-id",
    };
    if (userId && userId.trim()) {
      options.filter = `user = "${userId.trim()}"`;
    }
    const list = await pb.collection("telemetry_assessments").getList<DbTelemetryAssessment>(1, 50, options);
    return list.items;
  } catch {
    return [];
  }
}

/** Storage key prefix for user's claimed batteries */
const CLAIMED_BATTERIES_PREFIX = "voltpassport_claimed_batteries_";

/** Get list of claimed battery IDs for a user */
export function getUserClaimedBatteriesLocal(userId: string): string[] {
  try {
    const key = `${CLAIMED_BATTERIES_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Save list of claimed battery IDs for a user */
export function saveUserClaimedBatteriesLocal(userId: string, batteryIds: string[]): void {
  try {
    const key = `${CLAIMED_BATTERIES_PREFIX}${userId}`;
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(batteryIds))));
  } catch {}
}

