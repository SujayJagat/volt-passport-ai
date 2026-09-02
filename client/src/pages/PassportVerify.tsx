import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  FileSearch,
  Fingerprint,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import {
  computeArrayBufferSha256,
  computeSha256,
  extractPassportPayloadFromRawPdf,
  generateCanonicalJson,
  normalizePassportData,
  type CanonicalPassportData,
} from "@/lib/passportCrypto";
import { getDbPassportByHash, type DbPassport } from "@/lib/pocketbase";

interface VerificationReport {
  status: "verified" | "tampered" | "not_found" | "idle" | "error";
  title: string;
  message: string;
  batteryId?: string;
  claimedPayload?: CanonicalPassportData;
  registeredPassport?: DbPassport | null;
  computedHash: string;
  extractedHash?: string;
  registeredHash?: string;
  diffs: Array<{ field: string; claimed: string | number; expected: string | number }>;
  isPdfUploaded: boolean;
  fileName?: string;
  fileSize?: number;
}

export default function PassportVerify() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<VerificationReport>({
    status: "idle",
    title: "Ready to Verify",
    message: "Upload a battery passport PDF to verify authenticity and detect tampering.",
    computedHash: "",
    diffs: [],
    isPdfUploaded: false,
  });

  // Process uploaded PDF file
  const processPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setReport({
        status: "error",
        title: "Invalid File Type",
        message: "Please upload a valid Battery Passport .PDF file.",
        computedHash: "",
        diffs: [],
        isPdfUploaded: false,
      });
      return;
    }

    setAnalyzing(true);
    try {
      const buffer = await file.arrayBuffer();
      const fileSha256 = await computeArrayBufferSha256(buffer);

      // 1. Extract hidden cryptographic signature payload & binary document stream body
      const extracted = extractPassportPayloadFromRawPdf(buffer);

      if (!extracted.found || !extracted.payload || !extracted.hash) {
        setReport({
          status: "not_found",
          title: "No Cryptographic Signature Found",
          message: "Could not find a valid VoltPassport cryptographic signature or metadata block in the uploaded PDF.",
          computedHash: fileSha256,
          diffs: [],
          isPdfUploaded: true,
          fileName: file.name,
          fileSize: file.size,
        });
        return;
      }

      // 2. Normalize sealed cryptographic payload
      const sealedPayload = normalizePassportData(extracted.payload);
      const targetHash = extracted.hash.trim().toUpperCase();

      // 3. Recalculate deterministic canonical SHA-256 hash of payload
      const recalculatedHash = await computeSha256(generateCanonicalJson(sealedPayload));

      // 4. Verify cryptographic signature integrity
      if (recalculatedHash !== targetHash) {
        setReport({
          status: "tampered",
          title: "CRITICAL: Digital Signature Mismatch",
          message: "The embedded cryptographic signature does not match the internal telemetry payload. The document has been modified or corrupted.",
          batteryId: sealedPayload.batteryId,
          claimedPayload: sealedPayload,
          computedHash: recalculatedHash,
          extractedHash: targetHash,
          diffs: [{ field: "Digital Signature Checksum", claimed: targetHash.slice(0, 16) + "...", expected: recalculatedHash.slice(0, 16) + "..." }],
          isPdfUploaded: true,
          fileName: file.name,
          fileSize: file.size,
        });
        return;
      }

      // 5. Verify Visual Document Body Digest (Byte-for-byte stream verification)
      // If someone edited any text or numbers in the PDF using Acrobat/Illustrator or a text editor,
      // the document body stream hash will not match the sealed documentDigest.
      if (extracted.documentDigest && extracted.documentBodyBuffer) {
        const computedBodyDigest = await computeArrayBufferSha256(extracted.documentBodyBuffer);
        if (computedBodyDigest !== extracted.documentDigest) {
          setReport({
            status: "tampered",
            title: "CRITICAL: Visual Document Text Edited / Forged",
            message: "An unauthorized edit was detected in the visible document stream! The text, numbers, or layout in this PDF have been altered post-issuance in a document editor.",
            batteryId: sealedPayload.batteryId,
            claimedPayload: sealedPayload,
            computedHash: recalculatedHash,
            extractedHash: targetHash,
            diffs: [{
              field: "Document Content Stream",
              claimed: "Modified / Edited Stream Bytes",
              expected: "Original Cryptographically Sealed Stream",
            }],
            isPdfUploaded: true,
            fileName: file.name,
            fileSize: file.size,
          });
          return;
        }
      }

      // 6. Query PocketBase ledger for exact hash match
      let dbPassport: DbPassport | null = null;
      try {
        dbPassport = await getDbPassportByHash(targetHash);
      } catch {
        // network or db query error
      }

      // 7. Verified Authentic
      setReport({
        status: "verified",
        title: dbPassport ? "Cryptographically Verified & Ledger Registered" : "Cryptographically Verified & Authentic",
        message: dbPassport
          ? "This digital passport is authentic, untampered, and verified in the central ledger."
          : "The digital passport is authentic and sealed with a valid, untouched SHA-256 cryptographic signature.",
        batteryId: sealedPayload.batteryId,
        claimedPayload: sealedPayload,
        registeredPassport: dbPassport,
        computedHash: recalculatedHash,
        extractedHash: targetHash,
        registeredHash: dbPassport?.hash,
        diffs: [],
        isPdfUploaded: true,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch (err: any) {
      setReport({
        status: "error",
        title: "Verification Error",
        message: err.message || "An unexpected error occurred while analyzing the PDF.",
        computedHash: "",
        diffs: [],
        isPdfUploaded: true,
        fileName: file.name,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processPdfFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processPdfFile(e.target.files[0]);
    }
  };

  return (
    <main className="passport-page-react" style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Background ambient lighting */}
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }} />
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }} />

      <AppHeader />

      <section className="passport-source-shell" style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 4vw 60px", borderTop: "none" }}>
        {/* Header */}
        <header className="passport-source-hero" style={{ textAlign: "center", marginBottom: "40px" }}>
          <span className="signal-kicker">
            <span className="signal-line" /> CRYPTOGRAPHIC VERIFICATION & ANTI-TAMPER ENGINE
          </span>
          <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", margin: "16px 0 12px" }}>
            Verify Battery Passport.<br />
            <em>Detect tampering instantly.</em>
          </h1>
          <p style={{ maxWidth: "680px", margin: "0 auto", color: "#9cb2ad", fontSize: "15px", lineHeight: "1.6" }}>
            Upload any exported Battery Passport PDF certificate to verify its authenticity, certified health metrics,
            and database provenance against cryptographically sealed records.
          </p>
        </header>

        {/* Dedicated PDF Upload Zone */}
        <div
          style={{
            background: "rgba(10, 24, 26, 0.85)",
            border: "1px solid rgba(0, 245, 212, 0.22)",
            borderRadius: "12px",
            padding: "32px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            marginBottom: "36px",
          }}
        >
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? "var(--cyan)" : "rgba(0, 245, 212, 0.35)"}`,
              background: isDragging ? "rgba(0, 245, 212, 0.08)" : "rgba(4, 12, 14, 0.6)",
              borderRadius: "10px",
              padding: "54px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,application/pdf"
              style={{ display: "none" }}
            />
            <div
              style={{
                width: "68px",
                height: "68px",
                margin: "0 auto 18px",
                borderRadius: "50%",
                background: "rgba(0, 245, 212, 0.12)",
                border: "1px solid rgba(0, 245, 212, 0.3)",
                display: "grid",
                placeItems: "center",
                color: "var(--cyan)",
              }}
            >
              <UploadCloud size={32} />
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#eef5f3", fontSize: "20px" }}>
              Drop Battery Passport PDF here to verify
            </h3>
            <p style={{ margin: "0 auto 18px", color: "#8aa5a0", fontSize: "14px", maxWidth: "460px", lineHeight: "1.5" }}>
              Drag & drop your downloaded PDF certificate, or click to browse files from your device.
            </p>
            <span
              style={{
                display: "inline-block",
                padding: "7px 16px",
                background: "rgba(0, 245, 212, 0.15)",
                color: "var(--cyan)",
                borderRadius: "4px",
                font: "700 11px var(--mono, monospace)",
                letterSpacing: "0.05em",
              }}
            >
              ACCEPTS .PDF CERTIFICATES
            </span>
          </div>
        </div>

        {/* Verification Status & Forensic Report */}
        {analyzing && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "rgba(10, 24, 26, 0.6)",
              borderRadius: "10px",
              border: "1px solid rgba(0, 245, 212, 0.2)",
            }}
          >
            <RefreshCw
              size={32}
              style={{ animation: "spin 1.5s linear infinite", color: "var(--cyan)", margin: "0 auto 16px" }}
            />
            <h3 style={{ margin: "0 0 6px", color: "#eef5f3" }}>Extracting Cryptographic Proofs & Document Stream...</h3>
            <p style={{ margin: 0, color: "#8aa5a0", fontSize: "13px" }}>
              Inspecting binary document body, computing SHA-256 digests, and verifying digital signature
            </p>
          </div>
        )}

        {!analyzing && report.status !== "idle" && (
          <div
            style={{
              background:
                report.status === "verified"
                  ? "linear-gradient(145deg, rgba(8, 28, 22, 0.95), rgba(4, 14, 11, 0.95))"
                  : report.status === "tampered"
                  ? "linear-gradient(145deg, rgba(38, 12, 12, 0.95), rgba(18, 4, 4, 0.95))"
                  : "linear-gradient(145deg, rgba(20, 24, 26, 0.95), rgba(8, 12, 14, 0.95))",
              border: `2px solid ${
                report.status === "verified"
                  ? "var(--emerald, #10b981)"
                  : report.status === "tampered"
                  ? "var(--red, #ef4444)"
                  : "rgba(0, 245, 212, 0.3)"
              }`,
              borderRadius: "12px",
              padding: "32px",
              boxShadow:
                report.status === "verified"
                  ? "0 0 35px rgba(16, 185, 129, 0.2)"
                  : report.status === "tampered"
                  ? "0 0 35px rgba(239, 68, 68, 0.25)"
                  : "0 20px 50px rgba(0,0,0,0.4)",
            }}
          >
            {/* Top Status Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "20px",
                paddingBottom: "24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background:
                      report.status === "verified"
                        ? "rgba(16, 185, 129, 0.2)"
                        : report.status === "tampered"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(0, 245, 212, 0.15)",
                    color:
                      report.status === "verified"
                        ? "#10b981"
                        : report.status === "tampered"
                        ? "#ef4444"
                        : "var(--cyan)",
                  }}
                >
                  {report.status === "verified" ? (
                    <ShieldCheck size={28} />
                  ) : report.status === "tampered" ? (
                    <ShieldAlert size={28} />
                  ) : (
                    <FileSearch size={28} />
                  )}
                </div>
                <div>
                  <span
                    style={{
                      font: "700 10px var(--mono, monospace)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color:
                        report.status === "verified"
                          ? "#10b981"
                          : report.status === "tampered"
                          ? "#ef4444"
                          : "var(--cyan)",
                    }}
                  >
                    {report.status === "verified"
                      ? "AUTHENTIC & VERIFIED"
                      : report.status === "tampered"
                      ? "SECURITY ALERT: TAMPERED RECORD"
                      : "REGISTRY STATUS"}
                  </span>
                  <h2 style={{ margin: "4px 0", color: "#eef5f3", fontSize: "22px" }}>{report.title}</h2>
                  <p style={{ margin: 0, color: "#9bb5b0", fontSize: "14px" }}>{report.message}</p>
                </div>
              </div>

              {report.batteryId && (
                <div
                  style={{
                    padding: "8px 16px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                    textAlign: "right",
                  }}
                >
                  <span className="small-label" style={{ display: "block", marginBottom: "2px" }}>
                    ASSET ID
                  </span>
                  <strong style={{ color: "var(--cyan)", fontFamily: "var(--mono, monospace)", fontSize: "16px" }}>
                    {report.batteryId}
                  </strong>
                </div>
              )}
            </div>

            {/* Discrepancy / Tamper Warning Details */}
            {report.diffs.length > 0 && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "20px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ff8080", marginBottom: "12px" }}>
                  <AlertTriangle size={18} />
                  <strong style={{ fontSize: "14px" }}>FORENSIC DISCREPANCIES DETECTED</strong>
                </div>
                <p style={{ color: "#e0b0b0", fontSize: "13px", margin: "0 0 16px" }}>
                  The PDF certificate fails cryptographic integrity checks:
                </p>

                <div style={{ display: "grid", gap: "8px" }}>
                  {report.diffs.map((diff, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.3)",
                        borderRadius: "4px",
                        fontFamily: "var(--mono, monospace)",
                        fontSize: "12px",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <span style={{ color: "#d0d0d0" }}>
                        Check: <strong style={{ color: "#ffffff" }}>{diff.field}</strong>
                      </span>
                      <div style={{ display: "flex", gap: "20px" }}>
                        <span style={{ color: "#ff7777" }}>
                          Status: <strong>{String(diff.claimed)}</strong>
                        </span>
                        <span style={{ color: "#10b981" }}>
                          Expected: <strong>{String(diff.expected)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Data Inspection */}
            {report.claimedPayload && (
              <div style={{ marginTop: "24px" }}>
                <h4 style={{ margin: "0 0 14px", color: "#eef5f3", fontSize: "13px", letterSpacing: "0.05em" }}>
                  CERTIFIED TELEMETRY & HEALTH SPECS
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">STATE OF HEALTH (SOH)</span>
                    <strong style={{ color: "var(--cyan)", fontSize: "18px", fontFamily: "var(--mono, monospace)" }}>
                      {report.claimedPayload.soh.toFixed(1)}%
                    </strong>
                  </div>
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">HEALTH GRADE</span>
                    <strong
                      style={{
                        color:
                          report.claimedPayload.grade === "A"
                            ? "#10b981"
                            : report.claimedPayload.grade === "B"
                            ? "#f59e0b"
                            : "#ef4444",
                        fontSize: "18px",
                        fontFamily: "var(--mono, monospace)",
                      }}
                    >
                      GRADE {report.claimedPayload.grade}
                    </strong>
                  </div>
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">CYCLE COUNT</span>
                    <strong style={{ color: "#eef5f3", fontSize: "18px", fontFamily: "var(--mono, monospace)" }}>
                      {report.claimedPayload.cycle.toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">PACK VOLTAGE</span>
                    <strong style={{ color: "#eef5f3", fontSize: "18px", fontFamily: "var(--mono, monospace)" }}>
                      {report.claimedPayload.volt.toFixed(3)} V
                    </strong>
                  </div>
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">INTERNAL RESISTANCE</span>
                    <strong style={{ color: "#eef5f3", fontSize: "18px", fontFamily: "var(--mono, monospace)" }}>
                      {(report.claimedPayload.resistance * 1000).toFixed(2)} mΩ
                    </strong>
                  </div>
                  <div style={{ padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                    <span className="small-label">OPERATING TEMP</span>
                    <strong style={{ color: "#eef5f3", fontSize: "18px", fontFamily: "var(--mono, monospace)" }}>
                      {report.claimedPayload.temp.toFixed(1)} °C
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Verification Audit Card */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                background: "rgba(0, 0, 0, 0.4)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <Fingerprint size={16} style={{ color: "var(--cyan)" }} />
                <span style={{ font: "700 11px var(--mono, monospace)", color: "#8fa5a1", letterSpacing: "0.08em" }}>
                  CRYPTOGRAPHIC PROVENANCE & INTEGRITY AUDIT
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", fontSize: "12px", fontFamily: "var(--mono, monospace)" }}>
                <div>
                  <span style={{ color: "#7a9591" }}>Digital Seal: </span>
                  <strong style={{ color: report.status === "verified" ? "#10b981" : report.status === "tampered" ? "#ef4444" : "var(--cyan)" }}>
                    {report.status === "verified" ? "Verified & Authentic" : report.status === "tampered" ? "Tampered / Invalid" : "Validated"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#7a9591" }}>Ledger Record: </span>
                  <strong style={{ color: report.registeredPassport ? "#10b981" : "#eab308" }}>
                    {report.registeredPassport ? "Database Backed" : "Offline Sealed Record"}
                  </strong>
                </div>
                {report.fileName && (
                  <div>
                    <span style={{ color: "#7a9591" }}>File Source: </span>
                    <span style={{ color: "#eef5f3" }}>
                      {report.fileName} ({report.fileSize ? `${(report.fileSize / 1024).toFixed(1)} KB` : ""})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <AppFooter />
    </main>
  );
}
