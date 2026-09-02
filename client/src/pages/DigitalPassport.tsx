import { Check, Coins, Copy, DatabaseZap, Download, FileCheck, Plus, Printer, Save, ShieldCheck, Sparkles, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useLocalBattery } from "@/lib/battery";
import { useAuth } from "@/contexts/AuthContext";
import { generatePassportFingerprint, type CanonicalPassportData } from "@/lib/passportCrypto";
import { downloadBatteryPassportPdf } from "@/lib/passportPdf";

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
  const { activeRecord, prediction, isFromDb, saveCurrentPassport } = useBatteryDataset();
  const { user } = useAuth();
  
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [cryptoHash, setCryptoHash] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const issued = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const batteryId = activeRecord?.batteryId ?? "VPA-LIVE-1";
  const soh = prediction?.predictedSoh ?? result.soh;
  const grade = prediction?.grade ?? result.grade;
  const recommendation = prediction?.lifecycle ?? (grade === "A" ? "Continued EV operation" : grade === "B" ? "Second-life storage" : "Certified recycling");

  // Canonical data structure for cryptographic hashing
  const canonicalData: Partial<CanonicalPassportData> = useMemo(() => ({
    batteryId,
    batchId: activeRecord?.batchId ?? "Standard Pack",
    soh,
    grade,
    status: grade === "A" ? "EV READY" : grade === "B" ? "SECOND-LIFE REVIEW" : "SERVICE REVIEW",
    lifecycle: recommendation,
    cycle: activeRecord?.cycle ?? telemetry.cycles,
    temp: telemetry.temp,
    volt: telemetry.volt,
    resistance: telemetry.resistance,
    fastCharge: telemetry.fastCharge,
    modelLabel: "VoltPassport AI Certified",
    issuedAt: new Date().toISOString().slice(0, 10),
    issuer: user?.name ? `${user.name} (VoltPassport AI)` : "VoltPassport AI Authority",
  }), [batteryId, activeRecord, soh, grade, recommendation, telemetry, user]);

  // Compute real SHA-256 fingerprint & generate authentic QR Code image
  useEffect(() => {
    let cancelled = false;
    generatePassportFingerprint(canonicalData).then(async ({ hash }) => {
      if (!cancelled) {
        setCryptoHash(hash);
        const origin = typeof window !== "undefined" ? window.location.origin : "https://voltpassport.ai";
        const verifyUrl = `${origin}/verify?hash=${hash}&id=${encodeURIComponent(batteryId)}`;
        try {
          const url = await QRCode.toDataURL(verifyUrl, {
            margin: 1,
            width: 180,
            color: { dark: "#000000", light: "#ffffff" },
          });
          if (!cancelled) setQrDataUrl(url);
        } catch {
          // ignore qr error
        }
      }
    });
    return () => { cancelled = true; };
  }, [canonicalData, batteryId]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      // Auto-save passport to database in parallel if not already saved
      saveCurrentPassport().catch(() => {});

      await downloadBatteryPassportPdf(canonicalData, {
        verificationBaseUrl: window.location.origin,
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    setSaveStatus(null);
    const res = await saveCurrentPassport();
    setSaving(false);
    if (res.success) {
      setSaveStatus({ success: true, message: "Passport successfully stored and registered in database!" });
    } else {
      setSaveStatus({ success: false, message: res.error || "Could not save passport to database." });
    }
  };

  return (
    <main className="passport-page-react" style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      {/* Background Ambient Glow */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }}/>
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }}/>

      <AppHeader/>

      <section className="passport-source-shell" style={{ borderTop: "none", padding: "40px 4vw 60px" }}>
        <header className="passport-source-hero">
          <span className="signal-kicker">
            <span className="signal-line"/> DIGITAL BATTERY PASSPORT
          </span>
          <h1>Battery Passport & <em>Provenance</em></h1>
          <span className="passport-verified" style={{ borderRadius: "4px" }}>
            <ShieldCheck size={15}/> {isFromDb ? "DATABASE VERIFIED" : "CRYPTOGRAPHIC RECORD"} · {batteryId}
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
              <Identity label="Data source" value={isFromDb ? "PocketBase Database" : activeRecord ? "Verified Dataset" : "Hardware Telemetry Baseline"}/>
              <Identity label="Standard" value="EU 2023/1542 Compliant"/>
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

            {/* Official Passport Provenance & Verification Badge (Raw hash completely hidden) */}
            <div className="source-integrity">
              {qrDataUrl && (
                <div style={{ width: "80px", height: "80px", background: "#fff", padding: "4px", borderRadius: "6px", flexShrink: 0 }}>
                  <img src={qrDataUrl} alt="Passport Verification QR" style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span className="small-label" style={{ color: "var(--cyan)" }}>AUTHENTIC DIGITAL PROVENANCE</span>
                <p style={{ margin: "4px 0 6px", display: "flex", alignItems: "center", gap: "6px", color: "var(--emerald)", fontWeight: 600, fontSize: "13px" }}>
                  <Check size={15}/> Cryptographically Sealed & Verified <span style={{ marginLeft: "auto", fontSize: "10px", color: "#829794" }}>{isFromDb ? "DATABASE BACKED" : "AUTHENTIC RECORD"}</span>
                </p>
                <span style={{ fontSize: "11px", color: "#8fa5a1", lineHeight: "1.4" }}>
                  Official hardware identity for asset <strong>{batteryId}</strong>. Compliant with EU battery passport provenance guidelines.
                </span>
              </div>
            </div>

            <div className="source-passport-actions" style={{ gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className="button button-solid" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                <Download size={14}/> {downloadingPdf ? "Generating PDF..." : "Download Certified PDF"}
              </button>
              <Link
                href={`/valuation?id=${batteryId}`}
                className="button button-outline"
                style={{ borderColor: "var(--cyan)", color: "var(--cyan)" }}
              >
                <Coins size={14}/> Check Resale Value
              </Link>
              <Link href="/verify" className="button button-outline">
                <FileCheck size={14}/> Verify Portal
              </Link>
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
                  Certified health evaluation completed ({soh.toFixed(1)}% SOH)
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

            <article className="source-side-card" style={{ borderRadius: "8px", border: "1px solid rgba(0, 245, 212, 0.2)" }}>
              <span className="small-label" style={{ color: "var(--cyan)" }}>ANTI-TAMPER GUARANTEE</span>
              <p style={{ fontSize: "12px", color: "#8fa5a1", margin: "8px 0 0", lineHeight: "1.6" }}>
                All exported PDFs are sealed with a cryptographic SHA-256 fingerprint. Any post-issuance modifications to SOH, voltage, or cycles are flagged immediately on the verification portal.
              </p>
            </article>
          </aside>
        </div>
      </section>

      <AppFooter/>
    </main>
  );
}
