import React, { useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowUpRight,
  DatabaseZap,
  FileText,
  Gauge,
  LogOut,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalBattery } from "@/lib/battery";
import AddBatteryModal from "@/components/AddBatteryModal";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dataset-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Dashboard() {
  const { telemetry, result } = useLocalBattery();
  const {
    records,
    userBatteries,
    activeRecord,
    prediction,
    model,
    rfModel,
    rfModelLoaded,
    loading,
    error,
    isFromDb,
    userPassports,
    userAssessments,
    selectBatteryId,
    saveCurrentPassport,
  } = useBatteryDataset();
  const { user, isAuthenticated, logout, claimedBatteries, removeBatteryFromAccount } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingPassport, setSavingPassport] = useState(false);

  const soh = prediction?.predictedSoh ?? result.soh;
  const grade = prediction?.grade ?? result.grade;
  const status = grade === "A" ? "EV ready" : grade === "B" ? "Second-life review" : "Service review needed";

  const handleQuickSavePassport = async () => {
    setSavingPassport(true);
    setSaveMessage("");
    const res = await saveCurrentPassport("Generated from Battery Workspace dashboard.");
    setSavingPassport(false);
    if (res.success) {
      setSaveMessage("✓ Passport saved to database!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      setSaveMessage(`! Error: ${res.error}`);
    }
  };

  return (
    <main className="portal-page" style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      {/* Background ambient orbs */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }}/>
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }}/>

      <AppHeader/>

      <section className="portal-content">
        <div className="portal-heading">
          <div>
            <span className="signal-kicker">
              <span className="signal-line"/> PRIVATE OPERATOR WORKSPACE
            </span>
            <h1>Keep your battery<br/><em>decision in view.</em></h1>
            <p>
              Authenticated workspace for <b>{user?.name || "Operator"}</b> ({user?.email}). You have access to only your claimed battery packs and verified digital passports.
            </p>
            <p className={`dataset-status ${error ? "error" : ""}`}>
              <DatabaseZap size={14}/>
              {loading ? (
                "Connecting to verified database..."
              ) : error ? (
                <strong>{error}</strong>
              ) : (
                <strong>
                  {rfModelLoaded ? "Random Forest ML Active (100 Trees · R² = 0.966)" : isFromDb ? "PocketBase Database Connected" : "Local Database Ready"}
                  {activeRecord ? ` · Active Pack: ${activeRecord.batteryId}` : ""}
                </strong>
              )}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setIsAddModalOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px" }}
              >
                <Plus size={13}/> Add Battery
              </button>
              <Link className="button button-solid" href="/analyzer">
                Open analyzer <ArrowUpRight size={14}/>
              </Link>
            </div>
          </div>
        </div>

        {/* Claimed Battery Fleet Selector Bar */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px 20px",
            background: "rgba(10, 23, 25, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(0, 245, 212, 0.25)",
            borderRadius: "8px",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#b5c9c5", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={15} style={{ color: "var(--cyan)" }}/> MY CLAIMED BATTERIES ({claimedBatteries.length}):
            </span>
            {claimedBatteries.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#78918f", fontStyle: "italic" }}>
                No battery packs claimed yet.
              </span>
            ) : (
              claimedBatteries.map(batId => (
                <button
                  key={batId}
                  type="button"
                  onClick={() => selectBatteryId(batId)}
                  style={{
                    padding: "6px 14px",
                    background: activeRecord?.batteryId === batId ? "rgba(0, 245, 212, 0.2)" : "rgba(5, 14, 17, 0.8)",
                    border: activeRecord?.batteryId === batId ? "1px solid var(--cyan)" : "1px solid rgba(180, 224, 220, 0.15)",
                    borderRadius: "4px",
                    color: activeRecord?.batteryId === batId ? "var(--cyan)" : "#b5c9c5",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.18s ease",
                  }}
                >
                  <Zap size={11}/> {batId} {activeRecord?.batteryId === batId ? "★ ACTIVE" : ""}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setIsAddModalOpen(true)}
            style={{ fontSize: "11px", padding: "6px 12px" }}
          >
            <Plus size={12}/> Claim New Pack
          </button>
        </div>

        <div className="portal-grid" style={{ marginTop: "24px" }}>
          {/* Active Context Card */}
          <article className="portal-card portal-card-wide" style={{ borderRadius: "8px" }}>
            <div className="card-kicker"><Gauge size={15}/> ACTIVE BATTERY CONTEXT</div>
            <div className="battery-summary">
              <div>
                <span className="small-label">BATTERY ID</span>
                <strong style={{ fontSize: "20px", color: "#eef5f3" }}>{activeRecord?.batteryId ?? "No Pack Selected"}</strong>
              </div>
              <div>
                <span className="small-label">PREDICTED SOH</span>
                <strong style={{ color: "var(--cyan)", fontSize: "20px" }}>{soh.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="small-label">CYCLE COUNT</span>
                <strong style={{ fontSize: "20px", color: "#eef5f3" }}>{activeRecord?.cycle.toLocaleString() ?? telemetry.cycles}</strong>
              </div>
            </div>
            <p>
              {activeRecord
                ? `Matched to verified batch ${activeRecord.batchId}. Telemetry parameters and ML regression predictions are synchronized across all modules.`
                : "No battery pack active. Click '+ Add Battery' above to pair your battery via QR code or battery ID."}
            </p>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "18px" }}>
              <Link href="/passport" className="text-link">Review detailed passport <ArrowUpRight size={14}/></Link>
              <button
                type="button"
                onClick={handleQuickSavePassport}
                disabled={savingPassport || !activeRecord}
                style={{ background: "none", border: 0, color: "var(--cyan)", cursor: "pointer", fontSize: "12px", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={13}/> Save to DB
              </button>
              {saveMessage && <span style={{ fontSize: "11px", color: "var(--emerald)", fontFamily: "monospace" }}>{saveMessage}</span>}
            </div>
          </article>

          {/* Digital Passport Card */}
          <article className="portal-card" style={{ borderRadius: "8px" }}>
            <div className="card-kicker"><ShieldCheck size={15}/> DIGITAL PASSPORT</div>
            <h2>Traceable battery record</h2>
            <p>
              {activeRecord
                ? `The digital passport for ${activeRecord.batteryId} is cryptographically signed with an immutable hash and next-life decision.`
                : "Pair a Battery ID to inspect its detailed verified passport."}
            </p>
            <Link href="/passport" className="text-link">Open passport <ArrowUpRight size={14}/></Link>
          </article>

          {/* Decision Status Card */}
          <article className="portal-card" style={{ borderRadius: "8px" }}>
            <div className="card-kicker"><Sparkles size={15}/> DECISION STATUS</div>
            <h2>{status}</h2>
            <p>
              {prediction
                ? `${prediction.confidence} confidence · ${prediction.coverage.toLowerCase().replace("_", " ")} inputs · ${prediction.lifecycle}.`
                : `Current thermal profile: ${result.thermal}. The explanation view shows detailed degradation drivers.`}
            </p>
            <Link href="/explainability" className="text-link">Explain diagnosis <ArrowUpRight size={14}/></Link>
          </article>
        </div>

        {/* Database Passports List */}
        {userPassports.length > 0 && (
          <section style={{ marginTop: "32px", padding: "28px", background: "rgba(8, 20, 23, 0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(0, 245, 212, 0.2)", borderRadius: "8px", boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <span className="small-label"><FileText size={14}/> MY SAVED PASSPORTS IN DATABASE ({userPassports.length})</span>
              <Link href="/passport" className="text-link">View latest <ArrowUpRight size={13}/></Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
              {userPassports.slice(0, 6).map(p => (
                <div
                  key={p.id}
                  style={{
                    padding: "16px",
                    background: "rgba(3, 10, 12, 0.75)",
                    border: "1px solid rgba(180, 224, 220, 0.12)",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: "var(--cyan)", fontFamily: "monospace", fontSize: "14px" }}>{p.batteryId}</strong>
                    <span style={{ padding: "3px 8px", border: "1px solid var(--cyan)", borderRadius: "4px", fontSize: "11px", color: "var(--cyan)", fontFamily: "monospace" }}>
                      Grade {p.grade}
                    </span>
                  </div>
                  <span style={{ fontSize: "13px", color: "#eef5f3" }}>SOH: <b style={{ color: "var(--cyan)" }}>{p.soh.toFixed(1)}%</b></span>
                  <small style={{ color: "#78918f", fontSize: "11px", fontFamily: "monospace" }}>
                    {p.lifecycle || p.status} · {new Date(p.created).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detailed Prediction View */}
        {activeRecord && prediction ? (
          <section className="dataset-prediction" style={{ marginTop: "32px" }}>
            <div className="dataset-prediction-head">
              <div>
                <span className="small-label">{rfModelLoaded ? "RANDOM FOREST ENSEMBLE ASSESSMENT" : "DATASET-TRAINED BATTERY ASSESSMENT"}</span>
                <h2>{activeRecord.batteryId} · {activeRecord.batchId}</h2>
                <p className="dataset-meta">
                  {rfModelLoaded
                    ? "A 100-tree RandomForest regression model (scikit-learn trained) evaluates non-linear multi-variate telemetry features in real time."
                    : "A ridge-regression model is fitted to the battery records in PocketBase with this ID held out. Recorded measurements are displayed below."}
                </p>
              </div>
              <b className="dataset-grade">{prediction.grade}</b>
            </div>
            <div className="dataset-metric-grid">
              <Metric label="Predicted SOH" value={`${prediction.predictedSoh.toFixed(1)}%`}/>
              <Metric label="95% range" value={`${prediction.lower.toFixed(1)}–${prediction.upper.toFixed(1)}%`}/>
              <Metric label="Reference SOH" value={`${activeRecord.soh.toFixed(1)}%`}/>
              <Metric label="Lifecycle signal" value={prediction.lifecycle}/>
            </div>
            <dl className="dataset-details-grid">
              <Detail label="Cycle" value={activeRecord.cycle.toLocaleString()}/>
              <Detail label="Voltage" value={`${activeRecord.voltage.toFixed(3)} V`}/>
              <Detail label="Current" value={`${activeRecord.current.toFixed(3)} A`}/>
              <Detail label="Temperature" value={`${activeRecord.temperature.toFixed(1)} °C`}/>
              <Detail label="Charge time" value={`${activeRecord.chargeTime.toFixed(1)} min`}/>
              <Detail label="Discharge time" value={`${activeRecord.dischargeTime.toFixed(1)} min`}/>
              <Detail label="Internal resistance" value={`${activeRecord.internalResistance.toFixed(4)} Ω`}/>
              <Detail label="Capacity" value={`${activeRecord.capacity.toFixed(3)} Ah`}/>
              <Detail label="Ambient humidity" value={`${activeRecord.ambientHumidity.toFixed(1)}%`}/>
              <Detail label="C-rate" value={activeRecord.cRate.toFixed(2)}/>
            </dl>
            <div className="dataset-drivers">
              {prediction.topDrivers.map(driver => (
                <span className="dataset-driver" key={driver.label}>
                  <b>{driver.direction === "raises" ? "+" : "−"}{Math.abs(driver.impact).toFixed(1)}</b> pts · {driver.label}
                </span>
              ))}
            </div>
          </section>
        ) : (
          <section className="dataset-empty" style={{ marginTop: "32px" }}>
            <strong style={{ fontSize: "16px", color: "var(--cyan)", display: "block", marginBottom: "8px" }}>
              No Battery Pack Selected
            </strong>
            <p style={{ color: "#8fa5a1", maxWidth: "440px", margin: "0 auto 18px" }}>
              Pair your battery using the QR code scanner or enter your battery ID to load live telemetry and AI diagnostics.
            </p>
            <button
              type="button"
              className="button button-solid"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={14}/> Claim Battery Pack
            </button>
          </section>
        )}

        <div className="feature-launcher" style={{ marginTop: "40px" }}>
          <span className="small-label">VOLTPASSPORT MODULES</span>
          <div>
            <Link href="/signal">Read battery signal <ArrowUpRight size={14}/></Link>
            <Link href="/analyzer">Tune health model <ArrowUpRight size={14}/></Link>
            <Link href="/explainability">Understand recommendation <ArrowUpRight size={14}/></Link>
          </div>
        </div>
      </section>

      <AppFooter/>

      {/* Modal */}
      <AddBatteryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </main>
  );
}
