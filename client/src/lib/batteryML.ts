import type { BatteryTelemetry } from "./battery";

export const REQUIRED_TRAINING_COLUMNS = ["cycles", "temp", "volt", "resistance", "fastCharge", "soh"] as const;
export const MIN_TRAINING_ROWS = 20;

const FEATURE_NAMES = ["cycles", "temp", "volt", "resistance", "fastCharge"] as const;

type FeatureName = (typeof FEATURE_NAMES)[number];

export type BatteryTrainingRow = BatteryTelemetry & { soh: number };

export type CsvParseResult = {
  rows: BatteryTrainingRow[];
  errors: string[];
};

export type ValidationSummary = {
  heldoutRows: number;
  mae: number;
  rmse: number;
  r2: number;
};

export type BatteryHealthModel = {
  version: "ridge-v1";
  featureNames: readonly FeatureName[];
  means: number[];
  scales: number[];
  minimums: number[];
  maximums: number[];
  coefficients: number[];
  residualStd: number;
  trainingRows: number;
  validation: ValidationSummary;
  createdAt: number;
};

export type ModelFeatureImpact = {
  label: string;
  value: number;
  tone: "cyan" | "amber" | "red" | "violet" | "emerald";
  direction: "raises" | "lowers";
};

export type ModelPrediction = {
  soh: number;
  lower: number;
  upper: number;
  uncertainty: number;
  coverage: "IN RANGE" | "EXTRAPOLATING";
  factors: ModelFeatureImpact[];
};

const HEADER_ALIASES: Record<string, string> = {
  "fastcharge": "fastCharge",
  "fast charge": "fastCharge",
  "fast charging ratio": "fastCharge",
  "state of health": "soh",
  "stateofhealth": "soh",
  "soh%": "soh",
};

const FEATURE_LABELS: Record<FeatureName, string> = {
  cycles: "Cycle history",
  temp: "Operating temperature",
  volt: "Pack voltage",
  resistance: "Internal resistance",
  fastCharge: "Fast charging ratio",
};

const FEATURE_TONES: Record<FeatureName, ModelFeatureImpact["tone"]> = {
  cycles: "cyan",
  temp: "red",
  volt: "emerald",
  resistance: "violet",
  fastCharge: "amber",
};

const VALIDATION_RANGES: Record<keyof BatteryTrainingRow, readonly [number, number]> = {
  cycles: [0, 10000],
  temp: [-30, 100],
  volt: [0, 1000],
  resistance: [0, 1],
  fastCharge: [0, 100],
  soh: [0, 100],
};

function normalizeHeader(value: string) {
  const trimmed = value.trim().replace(/^\uFEFF/, "");
  const normalized = trimmed.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  return HEADER_ALIASES[normalized] ?? trimmed;
}

function toFiniteNumber(value: string) {
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : null;
}

/**
 * Parses only the compact numerical CSV contract used by the local model.
 * The data never leaves the browser; invalid records are surfaced by row.
 */
export function parseBatteryTrainingCsv(csv: string): CsvParseResult {
  const rows = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rows.length < 2) return { rows: [], errors: ["Add a header and at least one labelled telemetry record."] };

  const headers = rows[0].split(",").map(normalizeHeader);
  const missing = REQUIRED_TRAINING_COLUMNS.filter(column => !headers.includes(column));
  const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] };
  }
  if (duplicate) return { rows: [], errors: [`Duplicate column: ${duplicate}.`] };

  const indexes = Object.fromEntries(REQUIRED_TRAINING_COLUMNS.map(column => [column, headers.indexOf(column)])) as Record<keyof BatteryTrainingRow, number>;
  const validRows: BatteryTrainingRow[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((line, rowIndex) => {
    const cells = line.split(",");
    const parsed = Object.fromEntries(REQUIRED_TRAINING_COLUMNS.map(column => [column, toFiniteNumber(cells[indexes[column]] ?? "")])) as Record<keyof BatteryTrainingRow, number | null>;
    const invalidColumn = REQUIRED_TRAINING_COLUMNS.find(column => parsed[column] === null);
    if (invalidColumn) {
      errors.push(`Row ${rowIndex + 2}: ${invalidColumn} must be a finite number.`);
      return;
    }

    const outOfRange = REQUIRED_TRAINING_COLUMNS.find(column => {
      const [min, max] = VALIDATION_RANGES[column];
      const value = parsed[column] as number;
      return value < min || value > max;
    });
    if (outOfRange) {
      const [min, max] = VALIDATION_RANGES[outOfRange];
      errors.push(`Row ${rowIndex + 2}: ${outOfRange} must be between ${min} and ${max}.`);
      return;
    }

    validRows.push(parsed as BatteryTrainingRow);
  });

  if (validRows.length < MIN_TRAINING_ROWS && errors.length === 0) {
    errors.push(`At least ${MIN_TRAINING_ROWS} valid labelled records are required to train and validate the model.`);
  }

  return { rows: validRows, errors };
}

function featureVector(row: BatteryTelemetry) {
  return FEATURE_NAMES.map(feature => row[feature]);
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number) {
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / Math.max(1, values.length - 1);
  return Math.sqrt(variance) || 1;
}

function solveLinearSystem(matrix: number[][], target: number[]) {
  const size = target.length;
  const augmented = matrix.map((row, index) => [...row, target[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) throw new Error("The training data does not contain enough independent signal to fit this model.");
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

    const pivotValue = augmented[column][column];
    for (let targetColumn = column; targetColumn <= size; targetColumn += 1) augmented[column][targetColumn] /= pivotValue;

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let targetColumn = column; targetColumn <= size; targetColumn += 1) augmented[row][targetColumn] -= factor * augmented[column][targetColumn];
    }
  }

  return augmented.map(row => row[size]);
}

function ridgeCoefficients(rows: BatteryTrainingRow[], means: number[], scales: number[]) {
  const dimension = FEATURE_NAMES.length + 1;
  const gram = Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 0));
  const cross = Array.from({ length: dimension }, () => 0);
  const ridgePenalty = 0.75;

  rows.forEach(row => {
    const normalized = featureVector(row).map((value, index) => (value - means[index]) / scales[index]);
    const vector = [1, ...normalized];
    vector.forEach((left, leftIndex) => {
      cross[leftIndex] += left * row.soh;
      vector.forEach((right, rightIndex) => {
        gram[leftIndex][rightIndex] += left * right;
      });
    });
  });

  for (let index = 1; index < dimension; index += 1) gram[index][index] += ridgePenalty;
  return solveLinearSystem(gram, cross);
}

function calculateMetrics(rows: BatteryTrainingRow[], predict: (row: BatteryTelemetry) => number): ValidationSummary {
  const actual = rows.map(row => row.soh);
  const predictions = rows.map(predict);
  const average = mean(actual);
  const squaredError = actual.reduce((total, value, index) => total + (value - predictions[index]) ** 2, 0);
  const totalVariance = actual.reduce((total, value) => total + (value - average) ** 2, 0);
  return {
    heldoutRows: rows.length,
    mae: actual.reduce((total, value, index) => total + Math.abs(value - predictions[index]), 0) / rows.length,
    rmse: Math.sqrt(squaredError / rows.length),
    r2: totalVariance === 0 ? 0 : 1 - squaredError / totalVariance,
  };
}

/**
 * Fits a ridge regression with a fixed 80/20 deterministic holdout split.
 * This is intentionally modest: it is a local exploratory tool, not a safety certification.
 */
export function trainBatteryHealthModel(rows: BatteryTrainingRow[]): BatteryHealthModel {
  if (rows.length < MIN_TRAINING_ROWS) throw new Error(`Provide at least ${MIN_TRAINING_ROWS} valid labelled records before training.`);

  const validationRows = rows.filter((_, index) => (index + 1) % 5 === 0);
  const trainingRows = rows.filter((_, index) => (index + 1) % 5 !== 0);
  if (trainingRows.length < 12 || validationRows.length < 3) throw new Error("The dataset is too small for the required training and holdout validation split.");

  const means = FEATURE_NAMES.map(feature => mean(trainingRows.map(row => row[feature])));
  const scales = FEATURE_NAMES.map((feature, index) => standardDeviation(trainingRows.map(row => row[feature]), means[index]));
  const minimums = FEATURE_NAMES.map(feature => Math.min(...trainingRows.map(row => row[feature])));
  const maximums = FEATURE_NAMES.map(feature => Math.max(...trainingRows.map(row => row[feature])));
  const coefficients = ridgeCoefficients(trainingRows, means, scales);
  const rawPrediction = (row: BatteryTelemetry) => coefficients[0] + featureVector(row).reduce((total, value, index) => total + coefficients[index + 1] * ((value - means[index]) / scales[index]), 0);
  const trainingResiduals = trainingRows.map(row => row.soh - rawPrediction(row));
  const residualStd = Math.sqrt(trainingResiduals.reduce((total, residual) => total + residual ** 2, 0) / Math.max(1, trainingRows.length - FEATURE_NAMES.length - 1));

  return {
    version: "ridge-v1",
    featureNames: FEATURE_NAMES,
    means,
    scales,
    minimums,
    maximums,
    coefficients,
    residualStd: Number.isFinite(residualStd) ? residualStd : 0,
    trainingRows: trainingRows.length,
    validation: calculateMetrics(validationRows, row => clamp(rawPrediction(row), 0, 100)),
    createdAt: Date.now(),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function predictBatteryHealth(model: BatteryHealthModel, telemetry: BatteryTelemetry): ModelPrediction {
  const values = featureVector(telemetry);
  const normalized = values.map((value, index) => (value - model.means[index]) / model.scales[index]);
  const rawPrediction = model.coefficients[0] + normalized.reduce((total, value, index) => total + model.coefficients[index + 1] * value, 0);
  const soh = clamp(rawPrediction, 0, 100);
  const extrapolation = values.reduce((total, value, index) => {
    const span = Math.max(model.maximums[index] - model.minimums[index], Number.EPSILON);
    const distance = value < model.minimums[index] ? (model.minimums[index] - value) / span : value > model.maximums[index] ? (value - model.maximums[index]) / span : 0;
    return total + distance;
  }, 0) / values.length;
  const uncertainty = clamp(Math.max(1.5, model.residualStd * 1.96) * (1 + extrapolation), 1.5, 25);
  const factors = model.featureNames.map((feature, index) => {
    const impact = model.coefficients[index + 1] * normalized[index];
    const direction: ModelFeatureImpact["direction"] = impact >= 0 ? "raises" : "lowers";
    return {
      label: FEATURE_LABELS[feature],
      value: impact,
      direction,
      tone: FEATURE_TONES[feature],
    };
  }).sort((first, second) => Math.abs(second.value) - Math.abs(first.value));

  return {
    soh,
    lower: clamp(soh - uncertainty, 0, 100),
    upper: clamp(soh + uncertainty, 0, 100),
    uncertainty,
    coverage: extrapolation > 0 ? "EXTRAPOLATING" : "IN RANGE",
    factors,
  };
}
