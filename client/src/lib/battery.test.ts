import { describe, expect, it } from "vitest";
import { assessBattery, defaultTelemetry } from "./battery";

describe("assessBattery", () => {
  it("returns a strong, stable grade for the default browser-local telemetry", () => {
    const result = assessBattery(defaultTelemetry);
    expect(result.grade).toBe("A");
    expect(result.thermal).toBe("STABLE");
    expect(result.soh).toBeGreaterThan(85);
  });

  it("flags a heavily cycled, heat-stressed battery for intervention", () => {
    const result = assessBattery({ cycles: 2000, temp: 55, volt: 300, resistance: .25, fastCharge: 100 });
    expect(result.grade).toBe("C");
    expect(result.thermal).toBe("CRITICAL");
    expect(result.status).toBe("INTERVENTION");
  });
});
