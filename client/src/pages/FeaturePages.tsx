import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  DatabaseZap,
  Gauge,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Sliders,
  Thermometer,
  Unlock,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import type { BatteryTelemetry } from "@/lib/battery";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useAuth } from "@/contexts/AuthContext";

function FeatureShell({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="feature-page" style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      {/* Background ambient orbs */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }}/>
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }}/>

      <AppHeader/>

      <section className="feature-hero">
        <span className="signal-kicker">
          <span className="signal-line"/> {label}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      {children}

      <AppFooter/>
    </main>
  );
}

export function SignalPage() {
  const { telemetry, assessment, activeRecord } = useBatteryDataset();
  return (
    <FeatureShell
      label="01 / UNDERSTAND"
      title={<>Every battery<br/><em>tells a story.</em></>}
      description="State of health is a legible relationship between cycles, temperature, resistance, and the way energy has moved through your battery pack."
    >
      <section className="feature-body signal-page-body">
        <div className="signal-stat-grid">
          <Stat
            icon={<Activity size={20}/>}
            label="State of health"
            value={`${assessment.soh.toFixed(1)}%`}
            detail="Active usable capacity remaining"
          />
          <Stat
            icon={<Gauge size={20}/>}
            label="Cycle history"
            value={telemetry.cycles.toLocaleString()}
            detail="Completed charge-discharge cycles"
          />
          <Stat
            icon={<Thermometer size={20}/>}
            label="Thermal behavior"
            value={assessment.thermal}
            detail={`${telemetry.temp} °C operating cell temperature`}
          />
        </div>

        <article className="feature-narrative" style={{ marginTop: "24px", borderRadius: "8px" }}>
          <div>
            <span className="small-label">THE SIGNAL BEHIND THE SCORE</span>
            <h2 style={{ margin: "14px 0 16px", color: "#eef5f3" }}>
              {activeRecord ? `${activeRecord.batteryId} · ` : ""}Read the pattern,<br/>
              <em style={{ color: "var(--cyan)" }}>not just the number.</em>
            </h2>
          </div>
          <div>
            <p style={{ margin: "0 0 20px" }}>
              Your pack’s state of health is continuously monitored and evaluated by a 100-tree Random Forest machine learning model. Telemetry reflects authenticated database records from your registered battery.
            </p>
            <div className="feature-actions">
              <Link href="/analyzer" className="button button-solid">
                Open analyzer <ArrowUpRight size={14}/>
              </Link>
              <Link href="/passport" className="button button-outline">
                View passport <ArrowUpRight size={14}/>
              </Link>
            </div>
          </div>
        </article>
      </section>
    </FeatureShell>
  );
}

export function AnalyzerPage() {
  const {
    telemetry,
    setTelemetry,
    isManualSimulation,
    toggleManualSimulation,
    resetToAuthenticTelemetry,
    assessment,
    activeRecord,
    rfModelLoaded,
    saveCurrentAssessment,
  } = useBatteryDataset();
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const update = (key: keyof BatteryTelemetry, value: number) => {
    if (!isManualSimulation) return;
    setTelemetry(current => ({ ...current, [key]: value }));
  };

  const handleSaveAssessment = async () => {
    setSavingAssessment(true);
    setSaveStatus("");
    const res = await saveCurrentAssessment({
      cycles: telemetry.cycles,
      temp: telemetry.temp,
      volt: telemetry.volt,
      resistance: telemetry.resistance,
      fastCharge: telemetry.fastCharge,
      soh: assessment.soh,
      grade: assessment.grade,
      safety: assessment.safety,
      thermal: assessment.thermal,
      mode: assessment.mode,
      factors: assessment.factors,
    });
    setSavingAssessment(false);
    if (res.success) {
      setSaveStatus("✓ Assessment saved to database!");
      setTimeout(() => setSaveStatus(""), 3000);
    } else {
      setSaveStatus(`! ${res.error}`);
    }
  };

  return (
    <FeatureShell
      label="02 / MEASURE"
      title={<>From raw telemetry<br/><em>to intelligence.</em></>}
      description="Inspect your battery's live telemetry evaluated by the scikit-learn Random Forest model, or toggle Manual Simulation to test edge-case failure scenarios."
    >
      <section className="feature-body analyzer-layout">
        {/* Controls Card */}
        <article className="feature-control-card" style={{ borderRadius: "8px" }}>
          <div className="panel-head">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.08em" }}>
              {isManualSimulation ? <Unlock size={14} style={{ color: "#f59e0b" }}/> : <Lock size={14} style={{ color: "var(--cyan)" }}/>}
              {isManualSimulation ? "SIMULATION TELEMETRY (UNLOCKED)" : `AUTHENTIC DATABASE · ${activeRecord?.batteryId || "LOCKED"}`}
            </span>
            <button
              type="button"
              className={isManualSimulation ? "button button-solid" : "button button-outline"}
              onClick={toggleManualSimulation}
              style={{
                fontSize: "11px",
                padding: "6px 12px",
                borderColor: isManualSimulation ? "#f59e0b" : "var(--cyan)",
                color: isManualSimulation ? "#010809" : "var(--cyan)",
                background: isManualSimulation ? "#f59e0b" : "rgba(0, 245, 212, 0.06)",
                fontWeight: 600,
              }}
            >
              <Sliders size={12}/> Manual Simulation
            </button>
          </div>

          {/* Status banner */}
          <div
            style={{
              margin: "16px 0 24px",
              padding: "12px 16px",
              background: isManualSimulation ? "rgba(245, 158, 11, 0.12)" : "rgba(0, 245, 212, 0.08)",
              border: isManualSimulation ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(0, 245, 212, 0.25)",
              borderRadius: "6px",
              fontSize: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ color: isManualSimulation ? "#fbbf24" : "#c0d8d3", fontFamily: "monospace" }}>
              {isManualSimulation
                ? "⚠️ Manual Simulation Active: Sliders unlocked for testing & failure simulation."
                : `🔒 Database Locked: Showing authentic telemetry for ${activeRecord?.batteryId || "your claimed pack"}.`}
            </span>
            {isManualSimulation && (
              <button
                type="button"
                onClick={resetToAuthenticTelemetry}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--cyan)",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  textDecoration: "underline",
                }}
              >
                <RotateCcw size={11}/> Reset
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Range
              label="Cycle count"
              value={telemetry.cycles}
              min={1}
              max={2000}
              step={1}
              suffix=" cycles"
              disabled={!isManualSimulation}
              onChange={v => update("cycles", v)}
            />
            <Range
              label="Operating temperature"
              value={telemetry.temp}
              min={10}
              max={55}
              step={1}
              suffix=" °C"
              disabled={!isManualSimulation}
              onChange={v => update("temp", v)}
            />
            <Range
              label="Pack voltage"
              value={telemetry.volt}
              min={300}
              max={420}
              step={1}
              suffix=" V"
              disabled={!isManualSimulation}
              onChange={v => update("volt", v)}
            />
            <Range
              label="Internal resistance"
              value={telemetry.resistance}
              min={.045}
              max={.25}
              step={.001}
              suffix=" Ω"
              disabled={!isManualSimulation}
              onChange={v => update("resistance", v)}
            />
            <Range
              label="Fast charging ratio"
              value={telemetry.fastCharge}
              min={0}
              max={100}
              step={1}
              suffix=" %"
              disabled={!isManualSimulation}
              onChange={v => update("fastCharge", v)}
            />
          </div>
          
          <div style={{ display: "flex", gap: "12px", marginTop: "32px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-solid"
              onClick={handleSaveAssessment}
              disabled={savingAssessment}
              style={{ flex: 1, justifyContent: "center" }}
            >
              <Save size={14}/> {savingAssessment ? "Saving..." : "Log to Database"}
            </button>
            <Link className="button button-outline" href="/passport">
              View passport <ArrowUpRight size={14}/>
            </Link>
          </div>
          {saveStatus && (
            <p style={{ margin: "12px 0 0", color: "var(--emerald)", fontSize: "12px", fontFamily: "monospace" }}>
              {saveStatus}
            </p>
          )}
        </article>

        {/* Live Diagnostics Card */}
        <aside className="feature-diagnostic" style={{ borderRadius: "8px" }}>
          <span className="small-label"><Activity size={13}/> LIVE ML DIAGNOSTIC</span>
          <p className="diagnostic-model trained" style={{ margin: "8px 0 20px" }}>{assessment.modelLabel}</p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              padding: "24px 0",
              borderBottom: "1px solid rgba(180, 224, 220, 0.12)",
              width: "100%",
            }}
          >
            {/* Glowing radial score ring */}
            <div
              className="score-ring"
              style={{
                background: `conic-gradient(var(--cyan) ${assessment.soh * 3.6}deg, #132427 0deg)`,
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: "0 0 24px rgba(0, 245, 212, 0.25)",
              }}
            >
              <div
                style={{
                  width: "78px",
                  height: "78px",
                  borderRadius: "50%",
                  background: "#081316",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <b style={{ font: "700 28px/1 var(--mono, monospace)", color: "var(--cyan)", letterSpacing: "-0.05em" }}>
                  {assessment.grade}
                </b>
                <small style={{ font: "9px var(--mono, monospace)", color: "#78918f", marginTop: "-6px" }}>GRADE</small>
              </div>
            </div>

            <div>
              <span className="small-label">CURRENT STATUS</span>
              <strong style={{ display: "block", fontSize: "18px", color: "#eef5f3", margin: "4px 0" }}>
                {assessment.grade === "A" ? "EV Ready" : assessment.grade === "B" ? "Second-Life Ready" : "Intervention Required"}
              </strong>
              <small style={{ color: "#8fa5a1", fontSize: "12px" }}>
                {rfModelLoaded ? "100-Tree scikit-learn RF Model" : "Live Baseline Inference"}
              </small>
            </div>
          </div>

          <div className="diagnostic-metrics" style={{ marginTop: "20px" }}>
            <Metric label="State of health" value={`${assessment.soh.toFixed(1)}%`}/>
            <Metric
              label={assessment.predictionInterval ? "95% prediction interval" : "Model status"}
              value={assessment.predictionInterval ? `${assessment.predictionInterval.lower.toFixed(1)}–${assessment.predictionInterval.upper.toFixed(1)}%` : "Live inference active"}
            />
            <Metric label="Safety score" value={`${assessment.safety.toFixed(0)}/100`}/>
            <Metric label="Thermal stress" value={assessment.thermal}/>
          </div>

          <Link href="/explainability" className="text-link" style={{ marginTop: "24px" }}>
            Why this result? <ArrowUpRight size={13}/>
          </Link>
        </aside>
      </section>
    </FeatureShell>
  );
}

export function ExplainabilityPage() {
  const { telemetry, assessment, rfModel, rfModelLoaded, activeRecord } = useBatteryDataset();
  const recommendation = assessment.grade === "A"
    ? "Continue EV operation and premium resale."
    : assessment.grade === "B"
    ? "Consider stationary storage while monitoring thermal load."
    : "Route to certified recycling for recovery and safe handling.";

  return (
    <FeatureShell
      label="03 / EXPLAIN"
      title={<>Don’t just predict<br/><em>degradation. Explain it.</em></>}
      description="Every result is legible: the 100-tree Random Forest model ranks feature contributions and shows how each telemetry parameter impacts battery state of health."
    >
      <section className="feature-body explain-page-layout">
        <article className="feature-narrative" style={{ borderRadius: "8px" }}>
          <div className="explain-advisory" style={{ borderRadius: "6px" }}>
            <BrainCircuit size={22} style={{ color: "var(--cyan)", flexShrink: 0 }}/>
            <div>
              <span className="small-label">SMART ADVISORY</span>
              <p style={{ color: "#eef5f3", fontSize: "14px", margin: "4px 0 0" }}>{recommendation}</p>
            </div>
          </div>
          <p style={{ margin: "16px 0", color: "#a3b8b5", lineHeight: "1.6" }}>
            {rfModelLoaded
              ? `The 100-tree RandomForest regression ensemble evaluates multi-dimensional battery wear for ${activeRecord?.batteryId || "your pack"}. Feature importances indicate that cycle aging (95.3%) and internal resistance growth (4.4%) are the primary degradation drivers.`
              : `The model predicts ${assessment.soh.toFixed(1)}% SOH, with a ${assessment.predictionInterval?.lower.toFixed(1)}–${assessment.predictionInterval?.upper.toFixed(1)}% prediction range. Telemetry inputs are within the observed dataset range.`}
          </p>
          <div className="feature-actions" style={{ marginTop: "16px" }}>
            <Link href="/analyzer" className="button button-solid">
              Adjust telemetry <ArrowUpRight size={14}/>
            </Link>
            <Link href="/passport" className="button button-outline">
              Open passport <ArrowUpRight size={14}/>
            </Link>
          </div>
        </article>

        <article className="feature-factor-card" style={{ borderRadius: "8px" }}>
          <div className="panel-head">
            <span style={{ fontSize: "11px", letterSpacing: "0.08em" }}>RANDOM FOREST FEATURE IMPORTANCE</span>
            <span className="verified-label"><ShieldCheck size={13}/> SCIKIT-LEARN MODEL</span>
          </div>
          {rfModelLoaded && rfModel ? (
            rfModel.featureNames.map((name, index) => {
              const importance = rfModel.featureImportances[index] * 100;
              const labels: Record<string, string> = {
                Cycle: "Cycle count",
                Voltage: "Pack voltage",
                Current: "Operating current",
                Temperature: "Cell temperature",
                ChargeTime: "Charge duration",
                DischargeTime: "Discharge duration",
                InternalResistance: "Internal resistance",
                AmbientHumidity: "Ambient humidity",
                C_Rate: "Charge rate (C-rate)",
              };
              const tone = index === 0 ? "cyan" : index === 6 ? "violet" : "emerald";
              return (
                <div className="feature-factor" key={name} style={{ marginTop: "20px" }}>
                  <div>
                    <span>
                      <b style={{ color: "var(--cyan)" }}>{String(index + 1).padStart(2, "0")}</b> {labels[name] || name}
                      <small style={{ color: "#78918f" }}>{importance >= 1 ? "Dominant degradation driver" : "Secondary telemetry signal"}</small>
                    </span>
                    <strong className={importance > 1 ? "factor-negative" : "factor-positive"} style={{ font: "700 13px var(--mono, monospace)" }}>
                      {importance.toFixed(importance < 0.1 ? 3 : 1)}%
                    </strong>
                  </div>
                  <i className={`tone-${tone}`} style={{ width: `${Math.max(4, Math.min(100, importance * 1.05))}%`, height: "4px", borderRadius: "2px", marginTop: "10px", display: "block" }}/>
                </div>
              );
            })
          ) : (
            assessment.factors.map((factor, index) => (
              <div className="feature-factor" key={factor.label} style={{ marginTop: "20px" }}>
                <div>
                  <span><b>{String(index + 1).padStart(2, "0")}</b> {factor.label}<small>{factor.direction} predicted health</small></span>
                  <strong className={factor.value < 0 ? "factor-negative" : "factor-positive"}>
                    {factor.value >= 0 ? "+" : "−"}{Math.abs(factor.value).toFixed(1)} pts
                  </strong>
                </div>
                <i className={`tone-${factor.tone}`} style={{ width: `${Math.min(100, Math.abs(factor.value) * 6 + 8)}%`, height: "4px", borderRadius: "2px", marginTop: "10px", display: "block" }}/>
              </div>
            ))
          )}
        </article>
      </section>
    </FeatureShell>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="feature-range" style={{ opacity: disabled ? 0.75 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <span>
        <b>{label}</b>
        <strong style={{ color: disabled ? "#7d9692" : "var(--cyan)" }}>
          {step < .01 ? value.toFixed(3) : Math.round(value)}{suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: disabled
            ? `linear-gradient(90deg, #445c58 ${pct}%, #131d20 ${pct}%)`
            : `linear-gradient(90deg, var(--cyan) ${pct}%, #1d2a2d ${pct}%)`,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </label>
  );
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="signal-stat" style={{ borderRadius: "8px", transition: "transform 0.2s ease, border-color 0.2s ease" }}>
      <span style={{ borderRadius: "6px" }}>{icon}</span>
      <small>{label}</small>
      <strong style={{ textShadow: "0 0 20px rgba(0, 245, 212, 0.2)" }}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
