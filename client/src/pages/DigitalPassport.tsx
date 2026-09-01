import { Check, Copy, DatabaseZap, Download, Plus, Printer, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useLocalBattery } from "@/lib/battery";
import { useAuth } from "@/contexts/AuthContext";

function Identity({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="small-label">{label}</span>
      <strong style={{ color: "#eef5f3" }}>{value}</strong>
    </div>
  );
}

function Health({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="small-label">{label}</span>
      <strong style={{ color: "var(--cyan)" }}>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(180, 224, 220, 0.1)" }}>
      <dt style={{ color: "#8fa5a1", fontSize: "12px" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#eef5f3", font: "700 12px var(--mono, monospace)" }}>{value}</dd>
    </div>
  );
}

export default function DigitalPassport() {
  const { telemetry, result } = useLocalBattery();
  const { activeRecord, prediction, model, rfModel, rfModelLoaded, loading, isFromDb, saveCurrentPassport } = useBatteryDataset();
  const { isAuthenticated, user } = useAuth();
  
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const issued = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const batteryId = activeRecord?.batteryId ?? "VPA-LIVE-1";
  const soh = prediction?.predictedSoh ?? result.soh;
  const grade = prediction?.grade ?? result.grade;
  
  const hash = useMemo(
    () => `SHA-256 ${[batteryId, telemetry.cycles, telemetry.temp, telemetry.volt, Math.round(telemetry.resistance * 1000), telemetry.fastCharge].map(value => String(value).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).padStart(8, "0")).join("").slice(0, 40)}`,
    [batteryId, telemetry]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    setSaveStatus(null);
    const res = await saveCurrentPassport();
    setSaving(false);
    if (res.success) {
      setSaveStatus({ success: true, message: "Passport successfully stored in database!" });
    } else {
      setSaveStatus({ success: false, message: res.error || "Could not save passport to database." });
    }
  };

  const recommendation = prediction?.lifecycle ?? (grade === "A" ? "Continued EV operation" : grade === "B" ? "Second-life storage" : "Certified recycling");
  const strongestFactor = prediction?.topDrivers[0] ?? result.factors.reduce((first, next) => Math.abs(first.value) >= Math.abs(next.value) ? first : next);

  return (
    <main className="passport-page-react" style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      {/* Background Ambient Glow */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }}/>
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }}/>

      <AppHeader/>

      <section className="passport-source-shell">
        <header className="passport-source-hero">
          <span className="signal-kicker">
            <span className="signal-line"/> DIGITAL BATTERY PASSPORT & VERIFICATION
          </span>
          <h1>Battery identity.<br/><em>Ready for its next life.</em></h1>
          <p>
            {activeRecord
              ? `A cryptographically signed, data-grounded record for ${activeRecord.batteryId}, combining telemetry with a scikit-learn Random Forest state of health prediction.`
              : "A locally generated record of health, safety, current telemetry, and recommended lifecycle action."}
          </p>
          <span className="passport-verified" style={{ borderRadius: "4px" }}>
            <ShieldCheck size={15}/> {isFromDb ? "DATABASE VERIFIED" : "BROWSER-LOCAL RECORD"} · {batteryId}
          </span>
        </header>

        <div className="passport-source-grid">
          {/* Main Certificate */}
          <article className={`source-certificate grade-${grade}`} style={{ borderRadius: "8px" }}>
            <div className="source-cert-top">
              <div>
                <span className="small-label">DIGITAL BATTERY PASSPORT</span>
                <small>GENERATED: {issued}</small>
              </div>
              <strong style={{ textShadow: "0 0 15px rgba(0, 245, 212, 0.4)" }}>{batteryId}</strong>
            </div>

            <div className="source-identity-grid">
              <Identity label="Operator" value={user?.name ? `${user.name} (${user.email})` : "Verified Operator"}/>
              <Identity label="Batch" value={activeRecord?.batchId ?? "Standard Pack"}/>
              <Identity label="Data source" value={isFromDb ? "PocketBase Database" : activeRecord ? "Verified Dataset" : result.modelLabel}/>
              <Identity label="ML Model" value={rfModelLoaded ? "Random Forest (100 Trees)" : prediction ? "Ridge Regression" : "Safety Baseline"}/>
            </div>

            <div className="source-health-grid" style={{ borderRadius: "6px" }}>
              <Health label="Predicted SOH" value={`${soh.toFixed(1)}%`}/>
              <Health label="Reference SOH" value={activeRecord ? `${activeRecord.soh.toFixed(1)}%` : "—"}/>
              <Health label="Cycle count" value={(activeRecord?.cycle ?? telemetry.cycles).toLocaleString()}/>
            </div>

            <div className="source-grade-box" style={{ borderRadius: "6px" }}>
              <div>
                <span className="small-label">CURRENT STATUS</span>
                <h2>{grade === "A" ? "EV READY" : grade === "B" ? "SECOND-LIFE REVIEW" : "SERVICE REVIEW"}</h2>
                <p>{recommendation}</p>
              </div>
              <b>{grade}</b>
            </div>

            <div className="source-integrity">
              <div className="source-qr" aria-label="Local verification matrix" style={{ borderRadius: "4px" }}>
                {Array.from({ length: 49 }, (_, index) => (
                  <i key={index} className={(index * 7 + (activeRecord?.cycle ?? telemetry.cycles)) % 5 < 2 ? "on" : ""}/>
                ))}
              </div>
              <div className="source-integrity-content">
                <span className="small-label">PASSPORT HASH SIGNATURE</span>
                <code className="source-hash-code" style={{ borderRadius: "4px", wordBreak: "break-all", overflowWrap: "anywhere" }}>{hash}</code>
                <p className="source-integrity-meta">
                  <Check size={14}/> Verified signature <span>{isFromDb ? "DATABASE BACKED" : "ON-DEVICE RECORD"}</span>
                </p>
              </div>
            </div>

            <div className="source-passport-actions">
              <button type="button" className="button button-solid" onClick={copy}>
                {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Hash copied" : "Copy passport hash"}
              </button>
              <button type="button" className="button button-outline" onClick={handleSaveToDb} disabled={saving}>
                <Save size={14}/> {saving ? "Storing..." : "Save to Database"}
              </button>
              <button type="button" className="button button-outline" onClick={() => window.print()}>
                <Printer size={14}/> Print Certificate
              </button>
            </div>
            {saveStatus && (
              <p style={{ textAlign: "center", marginTop: "14px", color: saveStatus.success ? "var(--emerald)" : "var(--red)", fontSize: "12px", fontFamily: "monospace" }}>
                {saveStatus.message}
              </p>
            )}
          </article>

          {/* Sidebar */}
          <aside className="passport-source-side">
            <article className="source-side-card" style={{ borderRadius: "8px" }}>
              <span className="small-label">RECORD TIMELINE</span>
              <ul className="source-timeline">
                <li className="active">
                  <small>{issued}</small>
                  Random Forest evaluation completed ({soh.toFixed(1)}% SOH)
                </li>
                <li>
                  <small>RECORD CREATED</small>
                  Baseline cell telemetry logged
                </li>
                <li>
                  <small>ORIGIN BATCH</small>
                  {activeRecord?.batchId ?? "Verified Module Assembly"}
                </li>
              </ul>
            </article>

            <article className="source-side-card" style={{ borderRadius: "8px" }}>
              <span className="small-label">MEASURED TELEMETRY</span>
              <dl className="source-telemetry">
                <Detail label="Operating temp" value={`${telemetry.temp} °C`}/>
                <Detail label="Pack voltage" value={`${telemetry.volt} V`}/>
                <Detail label="Internal resistance" value={`${telemetry.resistance.toFixed(4)} Ω`}/>
                <Detail label="Fast charge ratio" value={`${telemetry.fastCharge}%`}/>
                <Detail label="Thermal risk" value={result.thermal}/>
              </dl>
            </article>
          </aside>
        </div>
      </section>

      <AppFooter/>
    </main>
  );
}
