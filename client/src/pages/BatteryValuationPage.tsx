import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Coins,
  Cpu,
  FileCheck,
  Layers,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import BatteryResaleValuation from "@/components/BatteryResaleValuation";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useLocalBattery } from "@/lib/battery";
import { useAuth } from "@/contexts/AuthContext";

export default function BatteryValuationPage() {
  const { telemetry, result } = useLocalBattery();
  const { activeRecord, activeBatteryId, selectBatteryId, prediction } = useBatteryDataset();
  const { user } = useAuth();

  const [customSoh, setCustomSoh] = useState<number | null>(null);
  const [packCapacityKwh, setPackCapacityKwh] = useState<number>(60);

  // Check URL query parameters for ?id=
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get("id");
      if (idParam && idParam !== activeBatteryId) {
        selectBatteryId(idParam).catch(() => {});
      }
    }
  }, [activeBatteryId, selectBatteryId]);

  const batteryId = activeRecord?.batteryId || activeBatteryId || "BAT0001";
  const defaultSoh = prediction?.predictedSoh ?? result.soh;
  const currentSoh = customSoh !== null ? customSoh : defaultSoh;
  const currentGrade = currentSoh >= 85 ? "A" : currentSoh >= 70 ? "B" : "C";
  const currentCycles = activeRecord?.cycle ?? telemetry.cycles;

  const valuationInput = useMemo(() => ({
    batteryId,
    soh: currentSoh,
    grade: currentGrade,
    cycles: currentCycles,
    temp: telemetry.temp,
    volt: telemetry.volt,
    resistance: telemetry.resistance,
    fastChargeRatio: telemetry.fastCharge,
    packCapacityKwh,
    hasCertifiedPassport: true,
  }), [batteryId, currentSoh, currentGrade, currentCycles, telemetry, packCapacityKwh]);

  return (
    <main className="passport-page-react" style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Background ambient lighting */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }} />
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }} />

      <AppHeader />

      <section className="passport-source-shell" style={{ maxWidth: "1140px", margin: "0 auto", padding: "40px 4vw 60px", borderTop: "none" }}>
        {/* Hero Header */}
        <header className="passport-source-hero" style={{ textAlign: "center", marginBottom: "36px" }}>
          <span className="signal-kicker">
            <span className="signal-line" /> AI RESALE & SECOND-LIFE VALUATION ENGINE
          </span>
          <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", margin: "16px 0 12px" }}>
            Battery Resale Valuation.<br />
            <em>Maximize secondary market equity.</em>
          </h1>
          <p style={{ maxWidth: "700px", margin: "0 auto", color: "#9cb2ad", fontSize: "15px", lineHeight: "1.6" }}>
            Real-time diagnostic appraisal based on electrochemical degradation, capacity retention, and certified passport provenance.
          </p>
        </header>

        {/* Battery Asset & Pack Size Selector Bar */}
        <div
          style={{
            background: "rgba(10, 24, 26, 0.85)",
            border: "1px solid rgba(0, 245, 212, 0.22)",
            borderRadius: "12px",
            padding: "20px 24px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
            marginBottom: "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <span className="small-label" style={{ display: "block", marginBottom: "4px" }}>
                EVALUATING BATTERY ASSET
              </span>
              <strong style={{ color: "var(--cyan)", fontFamily: "var(--mono, monospace)", fontSize: "18px" }}>
                {batteryId}
              </strong>
            </div>

            <div style={{ height: "32px", width: "1px", background: "rgba(255,255,255,0.1)" }} />

            <div>
              <span className="small-label" style={{ display: "block", marginBottom: "4px" }}>
                STATE OF HEALTH (SOH)
              </span>
              <span style={{ color: "#eef5f3", fontFamily: "var(--mono, monospace)", fontSize: "16px", fontWeight: 700 }}>
                {currentSoh.toFixed(1)}% ({currentGrade === "A" ? "Grade A" : currentGrade === "B" ? "Grade B" : "Grade C"})
              </span>
            </div>

            <div style={{ height: "32px", width: "1px", background: "rgba(255,255,255,0.1)" }} />

            <div>
              <span className="small-label" style={{ display: "block", marginBottom: "4px" }}>
                CYCLE USAGE
              </span>
              <span style={{ color: "#eef5f3", fontFamily: "var(--mono, monospace)", fontSize: "16px", fontWeight: 700 }}>
                {currentCycles.toLocaleString()} cycles
              </span>
            </div>
          </div>

          {/* Quick pack size adjuster */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "#8fa5a1" }}>Pack Capacity:</span>
            {[40, 60, 75, 100].map((kwh) => (
              <button
                key={kwh}
                type="button"
                onClick={() => setPackCapacityKwh(kwh)}
                style={{
                  background: packCapacityKwh === kwh ? "var(--cyan)" : "rgba(0,0,0,0.4)",
                  color: packCapacityKwh === kwh ? "#041214" : "#eef5f3",
                  border: `1px solid ${packCapacityKwh === kwh ? "var(--cyan)" : "rgba(255,255,255,0.15)"}`,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontFamily: "var(--mono, monospace)",
                  cursor: "pointer",
                }}
              >
                {kwh} kWh
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Resale Valuation Component */}
        <BatteryResaleValuation input={valuationInput} />

        {/* Quick Navigation Footer Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "36px" }}>
          <Link
            href="/passport"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px",
              background: "rgba(8, 22, 24, 0.6)",
              border: "1px solid rgba(0, 245, 212, 0.2)",
              borderRadius: "10px",
              color: "#eef5f3",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <span className="small-label" style={{ color: "var(--cyan)", display: "block", marginBottom: "4px" }}>
                DIGITAL PASSPORT
              </span>
              <strong style={{ fontSize: "15px" }}>View Full Battery Passport Certificate</strong>
              <p style={{ margin: "4px 0 0", color: "#8aa5a0", fontSize: "12px" }}>
                Download certified PDF certificate and verify provenance.
              </p>
            </div>
            <ArrowRight size={20} style={{ color: "var(--cyan)" }} />
          </Link>

          <Link
            href="/verify"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px",
              background: "rgba(8, 22, 24, 0.6)",
              border: "1px solid rgba(0, 245, 212, 0.2)",
              borderRadius: "10px",
              color: "#eef5f3",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <span className="small-label" style={{ color: "var(--emerald)", display: "block", marginBottom: "4px" }}>
                VERIFICATION PORTAL
              </span>
              <strong style={{ fontSize: "15px" }}>Verify Document Authenticity</strong>
              <p style={{ margin: "4px 0 0", color: "#8aa5a0", fontSize: "12px" }}>
                Drag & drop any exported PDF to detect tampering.
              </p>
            </div>
            <ArrowRight size={20} style={{ color: "var(--emerald)" }} />
          </Link>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
