import { describe, it, expect } from "vitest";
import { calculateBatteryResaleValuation } from "./batteryValuation";

describe("batteryValuation engine", () => {
  it("calculates realistic resale value for a healthy Grade A battery", () => {
    const valuation = calculateBatteryResaleValuation({
      batteryId: "BAT0001",
      soh: 94.0,
      grade: "A",
      cycles: 320,
      temp: 26.5,
      volt: 3.84,
      resistance: 0.018,
      fastChargeRatio: 12.0,
      packCapacityKwh: 60,
    });

    expect(valuation.fairMarketValueUsd).toBeGreaterThan(5000);
    expect(valuation.valueRetentionPct).toBeGreaterThan(65);
    expect(valuation.primaryMarketChannel.channel).toBe("ev_marketplace");
    expect(valuation.primaryMarketChannel.recommended).toBe(true);
    expect(valuation.optimalSellingWindow.urgency).toBe("OPTIMAL");
  });

  it("routes a degraded battery (SOH 72%) to BESS energy storage market", () => {
    const valuation = calculateBatteryResaleValuation({
      batteryId: "BAT0042",
      soh: 72.0,
      grade: "B",
      cycles: 1400,
      temp: 34.0,
      volt: 3.68,
      resistance: 0.038,
      fastChargeRatio: 45.0,
      packCapacityKwh: 60,
    });

    expect(valuation.fairMarketValueUsd).toBeLessThan(4500);
    expect(valuation.primaryMarketChannel.channel).toBe("bess_storage");
    expect(valuation.primaryMarketChannel.recommended).toBe(true);
    expect(valuation.optimalSellingWindow.urgency).toBe("ATTENTION");
  });

  it("routes an end-of-life battery (SOH 58%) to recycling material recovery", () => {
    const valuation = calculateBatteryResaleValuation({
      batteryId: "BAT0099",
      soh: 58.0,
      grade: "C",
      cycles: 2200,
      temp: 42.0,
      volt: 3.52,
      resistance: 0.065,
      fastChargeRatio: 80.0,
      packCapacityKwh: 60,
    });

    expect(valuation.primaryMarketChannel.channel).toBe("recycling_scrap");
    expect(valuation.optimalSellingWindow.urgency).toBe("CRITICAL_VALUE_CLIFF");
    expect(valuation.breakdown.length).toBeGreaterThan(3);
  });

  it("includes certified passport provenance bonus when hasCertifiedPassport is true", () => {
    const withPassport = calculateBatteryResaleValuation({
      batteryId: "BAT0001",
      soh: 90.0,
      grade: "A",
      cycles: 400,
      temp: 25.0,
      volt: 3.8,
      resistance: 0.02,
      fastChargeRatio: 10.0,
      hasCertifiedPassport: true,
    });

    const withoutPassport = calculateBatteryResaleValuation({
      batteryId: "BAT0001",
      soh: 90.0,
      grade: "A",
      cycles: 400,
      temp: 25.0,
      volt: 3.8,
      resistance: 0.02,
      fastChargeRatio: 10.0,
      hasCertifiedPassport: false,
    });

    expect(withPassport.fairMarketValueUsd).toBeGreaterThan(withoutPassport.fairMarketValueUsd);
    expect(withPassport.breakdown.some(b => b.type === "bonus")).toBe(true);
  });
});
