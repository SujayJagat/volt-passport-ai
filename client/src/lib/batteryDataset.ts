export const DATASET_URL = "/data/battery_dataset.csv";

export const DATASET_FEATURES = [
  "cycle",
  "voltage",
  "current",
  "temperature",
  "chargeTime",
  "dischargeTime",
  "internalResistance",
  "capacity",
  "ambientHumidity",
  "cRate",
] as const;

type DatasetFeature = (typeof DATASET_FEATURES)[number];

export type DatasetBatteryRecord = {
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
};

export type DatasetValidation = { trainingRows: number; holdoutRows: number; mae: number; rmse: number; r2: number };

export type DatasetHealthModel = {
  version: "dataset-ridge-v1";
  means: number[];
  scales: number[];
  minimums: number[];
  maximums: number[];
  coefficients: number[];
  residualStd: number;
  validation: DatasetValidation;
};

export type DatasetPrediction = {
  predictedSoh: number;
  lower: number;
  upper: number;
  coverage: "IN RANGE" | "EXTRAPOLATING";
  grade: "A" | "B" | "C";
  lifecycle: string;
  confidence: "HIGH" | "MODERATE" | "CAUTIOUS";
  topDrivers: { label: string; impact: number; direction: "raises" | "lowers" }[];
};

const CSV_HEADERS = ["BatteryID", "BatchID", "Cycle", "Voltage", "Current", "Temperature", "ChargeTime", "DischargeTime", "InternalResistance", "Capacity", "AmbientHumidity", "C_Rate", "SOH"] as const;
const FEATURE_LABELS: Record<DatasetFeature, string> = { cycle: "Cycle count", voltage: "Voltage", current: "Current", temperature: "Temperature", chargeTime: "Charge duration", dischargeTime: "Discharge duration", internalResistance: "Internal resistance", capacity: "Measured capacity", ambientHumidity: "Ambient humidity", cRate: "C-rate" };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function featureVector(record: DatasetBatteryRecord) {
  return DATASET_FEATURES.map(feature => record[feature]);
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStd(values: number[], average: number) {
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / Math.max(1, values.length - 1);
  return Math.sqrt(variance) || 1;
}

function solveLinearSystem(matrix: number[][], target: number[]) {
  const dimension = target.length;
  const augmented = matrix.map((row, index) => [...row, target[index]]);
  for (let column = 0; column < dimension; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < dimension; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    if (Math.abs(augmented[pivot][column]) < 1e-10) throw new Error("The battery dataset does not contain enough independent signal to fit the model.");
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const pivotValue = augmented[column][column];
    for (let index = column; index <= dimension; index += 1) augmented[column][index] /= pivotValue;
    for (let row = 0; row < dimension; row += 1) {
      if (row === column) continue;
      const multiple = augmented[row][column];
      for (let index = column; index <= dimension; index += 1) augmented[row][index] -= multiple * augmented[column][index];
    }
  }
  return augmented.map(row => row[dimension]);
}

function modelPrediction(record: DatasetBatteryRecord, means: number[], scales: number[], coefficients: number[]) {
  return coefficients[0] + featureVector(record).reduce((total, value, index) => total + coefficients[index + 1] * ((value - means[index]) / scales[index]), 0);
}

export function parseBatteryDatasetCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return { records: [] as DatasetBatteryRecord[], errors: ["The dataset needs a header row and battery records."] };
  const headers = lines[0].replace(/^\uFEFF/, "").split(",").map(value => value.trim());
  const missing = CSV_HEADERS.filter(header => !headers.includes(header));
  if (missing.length > 0) return { records: [] as DatasetBatteryRecord[], errors: [`Missing required dataset column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] };
  const indexes = Object.fromEntries(CSV_HEADERS.map(header => [header, headers.indexOf(header)])) as Record<(typeof CSV_HEADERS)[number], number>;
  const records: DatasetBatteryRecord[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = line.split(",");
    const number = (header: Exclude<(typeof CSV_HEADERS)[number], "BatteryID" | "BatchID">) => Number(cells[indexes[header]]?.trim());
    const record: DatasetBatteryRecord = {
      batteryId: cells[indexes.BatteryID]?.trim().toUpperCase() ?? "",
      batchId: cells[indexes.BatchID]?.trim() ?? "",
      cycle: number("Cycle"), voltage: number("Voltage"), current: number("Current"), temperature: number("Temperature"), chargeTime: number("ChargeTime"), dischargeTime: number("DischargeTime"), internalResistance: number("InternalResistance"), capacity: number("Capacity"), ambientHumidity: number("AmbientHumidity"), cRate: number("C_Rate"), soh: number("SOH"),
    };
    const invalid = !record.batteryId || !record.batchId || Object.entries(record).some(([key, value]) => key !== "batteryId" && key !== "batchId" && !Number.isFinite(value));
    if (invalid) errors.push(`Row ${index + 2} is incomplete or contains a non-numeric telemetry value.`);
    else records.push(record);
  });
  return { records, errors };
}

export function findDatasetBattery(records: DatasetBatteryRecord[], batteryId: string) {
  const normalized = batteryId.trim().toUpperCase();
  return records.find(record => record.batteryId === normalized) ?? null;
}

export function trainDatasetHealthModel(records: DatasetBatteryRecord[]): DatasetHealthModel {
  if (records.length < 100) throw new Error("At least 100 complete battery records are required for the dataset model.");
  const holdout = records.filter((_, index) => (index + 1) % 5 === 0);
  const training = records.filter((_, index) => (index + 1) % 5 !== 0);
  const means = DATASET_FEATURES.map(feature => mean(training.map(record => record[feature])));
  const scales = DATASET_FEATURES.map((feature, index) => sampleStd(training.map(record => record[feature]), means[index]));
  const minimums = DATASET_FEATURES.map(feature => Math.min(...training.map(record => record[feature])));
  const maximums = DATASET_FEATURES.map(feature => Math.max(...training.map(record => record[feature])));
  const dimension = DATASET_FEATURES.length + 1;
  const gram = Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 0));
  const cross = Array.from({ length: dimension }, () => 0);
  training.forEach(record => {
    const row = [1, ...featureVector(record).map((value, index) => (value - means[index]) / scales[index])];
    row.forEach((left, leftIndex) => {
      cross[leftIndex] += left * record.soh;
      row.forEach((right, rightIndex) => { gram[leftIndex][rightIndex] += left * right; });
    });
  });
  for (let index = 1; index < dimension; index += 1) gram[index][index] += 0.75;
  const coefficients = solveLinearSystem(gram, cross);
  const prediction = (record: DatasetBatteryRecord) => clamp(modelPrediction(record, means, scales, coefficients), 0, 100);
  const residuals = training.map(record => record.soh - prediction(record));
  const holdoutPrediction = holdout.map(prediction);
  const holdoutTruth = holdout.map(record => record.soh);
  const squaredError = holdoutTruth.reduce((total, truth, index) => total + (truth - holdoutPrediction[index]) ** 2, 0);
  const holdoutMean = mean(holdoutTruth);
  const totalVariance = holdoutTruth.reduce((total, truth) => total + (truth - holdoutMean) ** 2, 0);
  return {
    version: "dataset-ridge-v1", means, scales, minimums, maximums, coefficients,
    residualStd: Math.sqrt(residuals.reduce((total, residual) => total + residual ** 2, 0) / Math.max(1, training.length - dimension)),
    validation: { trainingRows: training.length, holdoutRows: holdout.length, mae: holdoutTruth.reduce((total, truth, index) => total + Math.abs(truth - holdoutPrediction[index]), 0) / holdout.length, rmse: Math.sqrt(squaredError / holdout.length), r2: totalVariance === 0 ? 0 : 1 - squaredError / totalVariance },
  };
}

export function predictDatasetBattery(model: DatasetHealthModel, record: DatasetBatteryRecord): DatasetPrediction {
  const values = featureVector(record);
  const normalized = values.map((value, index) => (value - model.means[index]) / model.scales[index]);
  const predictedSoh = clamp(model.coefficients[0] + normalized.reduce((total, value, index) => total + model.coefficients[index + 1] * value, 0), 0, 100);
  const extrapolation = values.reduce((total, value, index) => {
    const span = Math.max(model.maximums[index] - model.minimums[index], Number.EPSILON);
    return total + (value < model.minimums[index] ? (model.minimums[index] - value) / span : value > model.maximums[index] ? (value - model.maximums[index]) / span : 0);
  }, 0) / values.length;
  const interval = clamp(Math.max(0.75, model.residualStd * 1.96) * (1 + extrapolation), 0.75, 25);
  const grade: DatasetPrediction["grade"] = predictedSoh >= 80 ? "A" : predictedSoh >= 60 ? "B" : "C";
  const lifecycle = grade === "A" ? "Continue EV operation" : grade === "B" ? "Monitor for second-life suitability" : "Service and recovery assessment";
  const topDrivers = DATASET_FEATURES.map((feature, index) => {
    const impact = model.coefficients[index + 1] * normalized[index];
    return { label: FEATURE_LABELS[feature], impact, direction: impact >= 0 ? "raises" as const : "lowers" as const };
  }).sort((first, second) => Math.abs(second.impact) - Math.abs(first.impact)).slice(0, 3);
  return { predictedSoh, lower: clamp(predictedSoh - interval, 0, 100), upper: clamp(predictedSoh + interval, 0, 100), coverage: extrapolation > 0 ? "EXTRAPOLATING" : "IN RANGE", grade, lifecycle, confidence: extrapolation > 0.35 ? "CAUTIOUS" : interval > 3 ? "MODERATE" : "HIGH", topDrivers };
}

export function predictDatasetBatteryOrNull(model: DatasetHealthModel | null, record: DatasetBatteryRecord | null) {
  return model && record ? predictDatasetBattery(model, record) : null;
}

export function datasetRecordToLocalTelemetry(record: DatasetBatteryRecord) {
  return { cycles: clamp(record.cycle, 1, 2000), temp: clamp(record.temperature, 10, 55), volt: clamp(record.voltage * 100, 300, 420), resistance: clamp(record.internalResistance, .045, .25), fastCharge: clamp(record.cRate * 50, 0, 100) };
}
