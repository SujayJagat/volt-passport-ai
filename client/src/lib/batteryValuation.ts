/**
 * Battery Resale & Residual Valuation Engine
 * Inspired by Cashify / Recurrent Auto diagnostic appraisal algorithms.
 * Calculates fair market value, itemized diagnostic deductions, secondary market routing,
 * and future depreciation curves based on electrochemical telemetry and certified passport provenance.
 */

export interface BatteryValuationInput {
  batteryId: string;
  soh: number; // 0 - 100 (%)
  grade: "A" | "B" | "C" | string;
  cycles: number;
  temp: number; // °C
  volt: number; // V
  resistance: number; // Ohm
  fastChargeRatio: number; // 0 - 100 (%)
  packCapacityKwh?: number; // default 60 kWh
  nominalVoltage?: number; // default 350V - 400V
  hasCertifiedPassport?: boolean;
}

export interface MarketChannelQuote {
  channel: "ev_marketplace" | "bess_storage" | "recycling_scrap";
  channelName: string;
  recommended: boolean;
  estimatedPrice: number;
  pricePerKwh: number;
  demandRating: "HIGH" | "MODERATE" | "LOW";
  turnaroundDays: string;
  description: string;
}

export interface ValuationBreakdownItem {
  label: string;
  type: "base" | "deduction" | "bonus";
  amount: number;
  description: string;
}

export interface ProjectedValuePoint {
  year: number;
  estimatedSoh: number;
  projectedValue: number;
  recommendedAction: string;
}

export interface BatteryValuationResult {
  batteryId: string;
  fairMarketValueUsd: number;
  fairMarketValueInr: number;
  basePackMsrpUsd: number;
  valueRetentionPct: number;
  healthGrade: string;
  primaryMarketChannel: MarketChannelQuote;
  allMarketChannels: MarketChannelQuote[];
  breakdown: ValuationBreakdownItem[];
  optimalSellingWindow: {
    urgency: "OPTIMAL" | "ATTENTION" | "CRITICAL_VALUE_CLIFF";
    recommendation: string;
    monthsRemaining: number;
  };
  projectedCurve: ProjectedValuePoint[];
}

const USD_TO_INR_RATE = 83.5;

/**
 * Calculates the comprehensive resale valuation and Cashify-style diagnostic price breakdown.
 */
export function calculateBatteryResaleValuation(input: BatteryValuationInput): BatteryValuationResult {
  const packKwh = input.packCapacityKwh || 60; // Default standard 60 kWh pack
  const baseCostPerKwh = 135; // Standard $135/kWh OEM replacement pack baseline
  const baseMsrp = Math.round(packKwh * baseCostPerKwh); // e.g. $8,100

  const soh = Math.max(0, Math.min(100, Number(input.soh || 0)));
  const cycles = Math.max(0, Number(input.cycles || 0));
  const resistanceMilliOhm = (Number(input.resistance || 0.02)) * 1000;
  const fastCharge = Math.max(0, Math.min(100, Number(input.fastChargeRatio || 0)));
  const hasPassport = input.hasCertifiedPassport !== false;

  const breakdown: ValuationBreakdownItem[] = [
    {
      label: `Base OEM Pack Value (${packKwh} kWh)`,
      type: "base",
      amount: baseMsrp,
      description: `Baseline manufacturer replacement value at $${baseCostPerKwh}/kWh`,
    },
  ];

  // 1. Capacity Loss & SOH Deduction
  // Batteries lose value non-linearly with SOH capacity loss
  const sohLossPct = Math.max(0, 100 - soh);
  const sohDeduction = Math.round(baseMsrp * (sohLossPct / 100) * 1.25);
  if (sohDeduction > 0) {
    breakdown.push({
      label: `Capacity Degradation (-${sohLossPct.toFixed(1)}% SOH)`,
      type: "deduction",
      amount: -sohDeduction,
      description: `Remaining usable capacity is ${soh.toFixed(1)}% of original factory spec`,
    });
  }

  // 2. Cycle Count Wear Deduction (Standard EV design life: 2000 cycles)
  const ratedCycles = 2000;
  const cycleWearRatio = Math.min(1.0, cycles / ratedCycles);
  const cycleDeduction = Math.round(baseMsrp * cycleWearRatio * 0.22);
  if (cycleDeduction > 0) {
    breakdown.push({
      label: `Cycle Utilization (${cycles.toLocaleString()} / ${ratedCycles.toLocaleString()} cycles)`,
      type: "deduction",
      amount: -cycleDeduction,
      description: `${(cycleWearRatio * 100).toFixed(0)}% of rated automotive design life exhausted`,
    });
  }

  // 3. Electrochemical Resistance / Thermal Stress Deduction
  const baselineResistanceMilliOhm = 20.0;
  const resistanceElevated = Math.max(0, resistanceMilliOhm - baselineResistanceMilliOhm);
  const resistanceDeduction = Math.round(Math.min(baseMsrp * 0.18, (resistanceElevated / baselineResistanceMilliOhm) * (baseMsrp * 0.08)));
  if (resistanceDeduction > 0) {
    breakdown.push({
      label: `Internal Impedance Rise (${resistanceMilliOhm.toFixed(1)} mΩ)`,
      type: "deduction",
      amount: -resistanceDeduction,
      description: `Increased internal resistance causes thermal inefficiencies during load`,
    });
  }

  // 4. Fast-Charge High-C Stress Deduction
  const fastChargeDeduction = Math.round(baseMsrp * (fastCharge / 100) * 0.06);
  if (fastChargeDeduction > 0) {
    breakdown.push({
      label: `DC Fast-Charge Exposure (${fastCharge.toFixed(1)}%)`,
      type: "deduction",
      amount: -fastChargeDeduction,
      description: `High-current fast charging increases micro-cracking and SEI layer growth`,
    });
  }

  // 5. Certified Passport Provenance Confidence Premium (+8% bonus)
  let passportBonus = 0;
  if (hasPassport) {
    passportBonus = Math.round(baseMsrp * 0.08);
    breakdown.push({
      label: `VoltPassport Cryptographic Provenance`,
      type: "bonus",
      amount: passportBonus,
      description: `Verified telemetry and immutable SHA-256 seal eliminates used market lemon risk`,
    });
  }

  // Compute Raw Value
  const rawEstimatedValue = Math.max(
    baseMsrp * 0.12, // Floor at material scrap value
    baseMsrp - sohDeduction - cycleDeduction - resistanceDeduction - fastChargeDeduction + passportBonus
  );

  const fairMarketValueUsd = Math.round(rawEstimatedValue);
  const fairMarketValueInr = Math.round(fairMarketValueUsd * USD_TO_INR_RATE);
  const valueRetentionPct = Number(((fairMarketValueUsd / baseMsrp) * 100).toFixed(1));

  // Determine Target Market Channels (EV vs BESS Storage vs Recycling)
  const isEvReady = soh >= 80 && input.grade === "A";
  const isSecondLifeStorage = soh >= 65 && !isEvReady;
  const isRecyclingScrap = soh < 65;

  const evMarketPrice = Math.round(fairMarketValueUsd);
  const bessMarketPrice = Math.round(packKwh * Math.max(45, (soh / 100) * 75) * (hasPassport ? 1.08 : 1.0));
  const recyclingScrapPrice = Math.round(packKwh * 28.5); // ~$28.50/kWh raw material spot price

  const marketChannels: MarketChannelQuote[] = [
    {
      channel: "ev_marketplace",
      channelName: "Automotive Secondary EV Market",
      recommended: isEvReady,
      estimatedPrice: isEvReady ? evMarketPrice : Math.round(evMarketPrice * 0.85),
      pricePerKwh: Math.round((isEvReady ? evMarketPrice : Math.round(evMarketPrice * 0.85)) / packKwh),
      demandRating: isEvReady ? "HIGH" : "LOW",
      turnaroundDays: isEvReady ? "2-4 Days" : "10-15 Days",
      description: "Direct sale to certified EV repair centers, fleet operators, and used EV buyers.",
    },
    {
      channel: "bess_storage",
      channelName: "Commercial BESS / Solar Energy Storage",
      recommended: isSecondLifeStorage,
      estimatedPrice: bessMarketPrice,
      pricePerKwh: Math.round(bessMarketPrice / packKwh),
      demandRating: isSecondLifeStorage ? "HIGH" : "MODERATE",
      turnaroundDays: "3-5 Days",
      description: "Repurposing pack for residential solar, telecom backup, and micro-grid energy arbitrage.",
    },
    {
      channel: "recycling_scrap",
      channelName: "Certified Mineral Refining & Recycling",
      recommended: isRecyclingScrap,
      estimatedPrice: recyclingScrapPrice,
      pricePerKwh: Math.round(recyclingScrapPrice / packKwh),
      demandRating: "HIGH",
      turnaroundDays: "1-2 Days (Instant Buyback)",
      description: "Hydrometallurgical extraction of critical minerals (Lithium, Cobalt, Nickel, Copper).",
    },
  ];

  const primaryMarketChannel = marketChannels.find((c) => c.recommended) || marketChannels[0];

  // Optimal Liquidation Window calculation
  let optimalSellingWindow: BatteryValuationResult["optimalSellingWindow"];
  if (soh >= 82) {
    optimalSellingWindow = {
      urgency: "OPTIMAL",
      recommendation: "Peak valuation tier. Ideal for direct EV resale or continuing high-efficiency fleet operation.",
      monthsRemaining: 24,
    };
  } else if (soh >= 68) {
    optimalSellingWindow = {
      urgency: "ATTENTION",
      recommendation: "Approaching second-life boundary. Monetize via BESS stationary energy storage within 10-14 months to avoid steep price drops.",
      monthsRemaining: 12,
    };
  } else {
    optimalSellingWindow = {
      urgency: "CRITICAL_VALUE_CLIFF",
      recommendation: "Past automotive utility threshold. Transition immediately to solar storage or material recovery to preserve residual scrap equity.",
      monthsRemaining: 2,
    };
  }

  // 5-Year Depreciation Forecast Curve
  const projectedCurve: ProjectedValuePoint[] = [];
  let simSoh = soh;
  let simCycles = cycles;

  for (let yr = 0; yr <= 4; yr++) {
    const projectedVal = yr === 0
      ? fairMarketValueUsd
      : Math.round(Math.max(recyclingScrapPrice, fairMarketValueUsd * Math.pow(0.86, yr)));
    
    projectedCurve.push({
      year: new Date().getFullYear() + yr,
      estimatedSoh: Number(simSoh.toFixed(1)),
      projectedValue: projectedVal,
      recommendedAction: simSoh >= 80 ? "EV Fleet Service" : simSoh >= 68 ? "BESS Storage Repurpose" : "Material Recycling",
    });

    simSoh = Math.max(50, simSoh - 3.2);
    simCycles += 220;
  }

  return {
    batteryId: input.batteryId,
    fairMarketValueUsd,
    fairMarketValueInr,
    basePackMsrpUsd: baseMsrp,
    valueRetentionPct,
    healthGrade: String(input.grade || "A").toUpperCase(),
    primaryMarketChannel,
    allMarketChannels: marketChannels,
    breakdown,
    optimalSellingWindow,
    projectedCurve,
  };
}
