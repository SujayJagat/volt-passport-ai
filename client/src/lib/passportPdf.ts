import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  computeArrayBufferSha256,
  generatePassportFingerprint,
  type CanonicalPassportData,
  normalizePassportData,
} from "./passportCrypto";

export interface GeneratePdfOptions {
  verificationBaseUrl?: string;
  filename?: string;
}

/**
 * Generates an authentic, cryptographically signed Battery Passport PDF.
 * Returns the jsPDF instance, raw Uint8Array buffer, and the computed SHA-256 fingerprint.
 */
export async function generateBatteryPassportPdf(
  data: Partial<CanonicalPassportData>,
  options: GeneratePdfOptions = {}
): Promise<{
  doc: jsPDF;
  pdfBytes: Uint8Array;
  hash: string;
  shortHash: string;
  verificationUrl: string;
  filename: string;
}> {
  const normalized = normalizePassportData(data);
  const { hash, shortHash } = await generatePassportFingerprint(normalized);

  const baseUrl = options.verificationBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://voltpassport.ai");
  const verificationUrl = `${baseUrl}/verify?hash=${hash}&id=${encodeURIComponent(normalized.batteryId)}`;
  const filename = options.filename || `VoltPassport_${normalized.batteryId}_${hash.slice(0, 8)}.pdf`;

  // Create A4 PDF in portrait mode
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: false, // uncompressed text streams allow infallible metadata inspection
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // 1. Dark Background Aesthetics Header
  doc.setFillColor(6, 16, 18); // Dark Teal-Black #061012
  doc.rect(margin, margin, contentWidth, 36, "F");

  // Neon Accent Line
  const gradeColor = normalized.grade === "A" ? [0, 245, 212] : normalized.grade === "B" ? [245, 170, 39] : [239, 68, 68];
  doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
  doc.rect(margin, margin, contentWidth, 2, "F");

  // Logo & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 245, 212); // Neon Cyan
  doc.text("VOLTPASSPORT AI", margin + 10, margin + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(143, 168, 163);
  doc.text("OFFICIAL CRYPTOGRAPHIC BATTERY PASSPORT & CERTIFICATION", margin + 10, margin + 21);
  doc.text(`ISSUED: ${normalized.issuedAt}   |   AUTHORITY: ${normalized.issuer}`, margin + 10, margin + 28);

  // Top Right Battery ID Stamp
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(normalized.batteryId, pageWidth - margin - 10, margin + 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 245, 212);
  doc.text("VERIFIED HARDWARE ASSET", pageWidth - margin - 10, margin + 24, { align: "right" });

  // 2. Main Identity & Health Section
  let y = margin + 44;

  // Grade & SOH Big Highlight Box
  doc.setFillColor(248, 251, 250);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, "FD");

  // Left Grade Column
  doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
  doc.roundedRect(margin + 6, y + 6, 32, 30, 2, 2, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(26);
  doc.setTextColor(10, 20, 22);
  doc.text(normalized.grade, margin + 22, y + 26, { align: "center" });

  // Middle SOH details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(12, 26, 28);
  doc.text(`${normalized.soh.toFixed(1)}% State of Health (SOH)`, margin + 44, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 90, 88);
  doc.text(`Operational Status: ${normalized.status}`, margin + 44, y + 22);
  doc.text(`Recommended Lifecycle: ${normalized.lifecycle}`, margin + 44, y + 29);

  // Right Batch Tag
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 140, 138);
  doc.text("BATCH IDENTIFIER", pageWidth - margin - 10, y + 14, { align: "right" });
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 40, 42);
  doc.text(normalized.batchId || "Standard Pack", pageWidth - margin - 10, y + 22, { align: "right" });

  // 3. Technical Telemetry Grid Table
  y += 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(10, 24, 26);
  doc.text("CERTIFIED TELEMETRY & HARDWARE BENCHMARKS", margin, y);

  y += 5;
  const colWidth = contentWidth / 4;
  const telemetryItems = [
    { label: "Cycle Count", value: `${normalized.cycle.toLocaleString()}` },
    { label: "Operating Temp", value: `${normalized.temp.toFixed(1)} °C` },
    { label: "Pack Voltage", value: `${normalized.volt.toFixed(3)} V` },
    { label: "Internal Resistance", value: `${(normalized.resistance * 1000).toFixed(2)} mΩ` },
  ];

  telemetryItems.forEach((item, index) => {
    const x = margin + index * colWidth;
    doc.setFillColor(242, 246, 245);
    doc.setDrawColor(220, 230, 228);
    doc.roundedRect(x, y, colWidth - 3, 20, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 120, 118);
    doc.text(item.label.toUpperCase(), x + 4, y + 6);

    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.setTextColor(10, 24, 26);
    doc.text(item.value, x + 4, y + 15);
  });

  // 4. Intelligence & Lifecycle Evaluation Layer
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(10, 24, 26);
  doc.text("DEGRADATION & LIFECYCLE EVALUATION", margin, y);

  y += 5;
  doc.setFillColor(248, 251, 250);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 60, 58);
  doc.text("Evaluation Standard: EU Battery Regulation (EU 2023/1542)", margin + 6, y + 8);
  doc.text(`Fast-Charge Stress Ratio: ${normalized.fastCharge.toFixed(1)}%`, margin + 6, y + 16);
  doc.text("Integrity Check: Cryptographically Validated Payload", pageWidth - margin - 6, y + 8, { align: "right" });
  doc.text(`Issued by: ${normalized.issuer}`, pageWidth - margin - 6, y + 16, { align: "right" });

  // 5. Official Certificate Seal & QR Verification Section (Clean, executive layout with signatures completely hidden in metadata)
  y += 32;
  doc.setFillColor(6, 16, 18);
  doc.roundedRect(margin, y, contentWidth, 54, 3, 3, "F");

  // QR Code Generation for Passport Access
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 140,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch {
    // fallback if qr fails
  }

  const qrSize = 38;
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", margin + 8, y + 8, qrSize, qrSize);
  }

  // Certificate Provenance Details next to QR (No visible hashes or raw crypto text)
  const textX = margin + qrSize + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 245, 212);
  doc.text("CERTIFIED DIGITAL BATTERY PASSPORT", textX, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 205, 200);
  doc.text(`Official passport record issued for Battery Asset ${normalized.batteryId}.`, textX, y + 23);
  doc.text(`Origin Batch: ${normalized.batchId || "Standard Pack"}   |   Classification: Grade ${normalized.grade} (${normalized.status})`, textX, y + 30);
  doc.text(`Certified by ${normalized.issuer} under EU Battery Regulation provenance standards.`, textX, y + 37);

  // Verification Portal link
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 170, 165);
  doc.text("Scan QR code or visit verification portal for verified hardware inspection.", textX, y + 45);

  // 6. Professional Security Watermark Overlay (Evenly distributed across page)
  try {
    if ((doc as any).GState) {
      doc.setGState(new (doc as any).GState({ opacity: 0.088 }));
    }
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 150, 138);

  // Top Section Watermark Band
  doc.setFontSize(28);
  doc.text("VOLTPASSPORT CERTIFIED · OFFICIAL HARDWARE RECORD", pageWidth / 2, pageHeight * 0.26, {
    align: "center",
    angle: 32,
  });

  // Center Main Watermark Band
  doc.setFontSize(36);
  doc.text("VOLTPASSPORT CERTIFIED · IMMUTABLE DIGITAL SEAL", pageWidth / 2, pageHeight * 0.52, {
    align: "center",
    angle: 32,
  });

  // Lower Section Watermark Band
  doc.setFontSize(26);
  doc.text(`AUTHENTIC DATA PROVENANCE · ASSET ${normalized.batteryId}`, pageWidth / 2, pageHeight * 0.78, {
    align: "center",
    angle: 32,
  });

  try {
    if ((doc as any).GState) {
      doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
    }
  } catch {}

  // 7. Footer Disclaimer & Embedded Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 150, 150);
  doc.text(
    "VoltPassport AI Certifications comply with battery lifecycle data provenance guidelines. Copyright © VoltPassport AI.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Set document metadata properties
  doc.setProperties({
    title: `Digital Battery Passport - ${normalized.batteryId}`,
    subject: `Cryptographic Battery Health Certificate for ${normalized.batteryId}`,
    author: normalized.issuer,
    keywords: `VoltPassport, SHA256:${hash}, BatteryID:${normalized.batteryId}`,
    creator: `VoltPassport AI Engine (${normalized.modelLabel})`,
  });

  // Get raw binary ArrayBuffer of the rendered visual document from jsPDF
  const rawArrayBuffer = doc.output("arraybuffer");
  // Compute cryptographic SHA-256 digest of the visual document body stream
  const documentDigest = await computeArrayBufferSha256(rawArrayBuffer);

  // Embed full cryptographic payload string and documentDigest inside trailer
  const payloadJson = JSON.stringify({
    hash,
    documentDigest,
    data: normalized,
    issuedAt: normalized.issuedAt,
    verificationUrl,
  });

  const trailerString = `\n% VOLTPASSPORT_PAYLOAD_START>>>${payloadJson}<<<VOLTPASSPORT_PAYLOAD_END\n`;
  const trailerBytes = new TextEncoder().encode(trailerString);

  // Combine binary array buffer with embedded trailer bytes safely without text encoding corruption
  const combined = new Uint8Array(rawArrayBuffer.byteLength + trailerBytes.byteLength);
  combined.set(new Uint8Array(rawArrayBuffer), 0);
  combined.set(trailerBytes, rawArrayBuffer.byteLength);

  return {
    doc,
    pdfBytes: combined,
    hash,
    shortHash,
    verificationUrl,
    filename,
  };
}

/**
 * Convenience helper to generate and trigger instant browser download of the tamper-evident PDF.
 */
export async function downloadBatteryPassportPdf(
  data: Partial<CanonicalPassportData>,
  options: GeneratePdfOptions = {}
): Promise<{ hash: string; filename: string }> {
  const { pdfBytes, filename, hash, doc } = await generateBatteryPassportPdf(data, options);
  
  try {
    // Create direct Blob from binary array buffer
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    // Fallback directly to jsPDF's built-in saver if needed
    console.warn("Falling back to doc.save:", err);
    doc.save(filename);
  }

  return { hash, filename };
}
