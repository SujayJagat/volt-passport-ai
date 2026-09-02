import { describe, it, expect } from "vitest";
import {
  generateCanonicalJson,
  computeSha256,
  generatePassportFingerprint,
  comparePassportPayloads,
  extractPassportPayloadFromRawPdf,
  normalizePassportData,
  type CanonicalPassportData,
} from "./passportCrypto";
import { generateBatteryPassportPdf } from "./passportPdf";

describe("passportCrypto", () => {
  const sampleData: CanonicalPassportData = {
    batteryId: "BAT0001",
    batchId: "Batch-Alpha",
    soh: 92.4,
    grade: "A",
    status: "EV READY",
    lifecycle: "Continue EV operation",
    cycle: 350,
    temp: 28.5,
    volt: 3.84,
    resistance: 0.0185,
    fastCharge: 15.0,
    modelLabel: "Random Forest (100 Trees)",
    issuedAt: "2026-09-02",
    issuer: "VoltPassport AI Authority",
  };

  it("produces deterministic canonical JSON regardless of key insertion order", () => {
    const json1 = generateCanonicalJson(sampleData);
    const shuffled: any = {
      temp: 28.5,
      batteryId: "BAT0001",
      issuer: "VoltPassport AI Authority",
      soh: 92.4,
      issuedAt: "2026-09-02",
      grade: "A",
      resistance: 0.0185,
      cycle: 350,
      modelLabel: "Random Forest (100 Trees)",
      status: "EV READY",
      volt: 3.84,
      batchId: "Batch-Alpha",
      fastCharge: 15.0,
      lifecycle: "Continue EV operation",
    };
    const json2 = generateCanonicalJson(shuffled);
    expect(json1).toBe(json2);
  });

  it("computes consistent SHA-256 hash", async () => {
    const { hash: hash1 } = await generatePassportFingerprint(sampleData);
    const { hash: hash2 } = await generatePassportFingerprint(sampleData);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it("detects tampered values in payload comparison", async () => {
    const original = normalizePassportData(sampleData);
    const tampered = {
      ...sampleData,
      soh: 98.0, // altered from 92.4 to 98.0
      grade: "A",
      cycle: 100, // altered from 350 to 100
    };

    const diffs = comparePassportPayloads(original, tampered);
    expect(diffs).toHaveLength(2);
    expect(diffs.find(d => d.field === "soh")).toEqual({
      field: "soh",
      claimed: 98,
      expected: 92.4,
    });
    expect(diffs.find(d => d.field === "cycle")).toEqual({
      field: "cycle",
      claimed: 100,
      expected: 350,
    });
  });

  it("extracts embedded cryptographic markers from raw PDF text", () => {
    const fakeEmbeddedJson = JSON.stringify({
      hash: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
      data: sampleData,
    });
    const fakePdfText = `
      %PDF-1.4
      1 0 obj
      << /Title (Battery Passport) >>
      VOLTPASSPORT_PAYLOAD_START>>>${fakeEmbeddedJson}<<<VOLTPASSPORT_PAYLOAD_END
      endobj
      %%EOF
    `;

    const extracted = extractPassportPayloadFromRawPdf(fakePdfText);
    expect(extracted.found).toBe(true);
    expect(extracted.hash).toBe("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855");
    expect(extracted.payload?.batteryId).toBe("BAT0001");
  });

  it("generates a valid, non-empty PDF binary buffer with embedded cryptographic signature", async () => {
    const { pdfBytes, hash, filename } = await generateBatteryPassportPdf(sampleData);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(filename).toContain("VoltPassport_BAT0001_");

    // Verify raw bytes begin with standard PDF signature "%PDF-"
    const magicHeader = new TextDecoder().decode(pdfBytes.slice(0, 5));
    expect(magicHeader).toBe("%PDF-");

    // Verify extraction works on the generated PDF bytes
    const extracted = extractPassportPayloadFromRawPdf(pdfBytes);
    expect(extracted.found).toBe(true);
    expect(extracted.hash).toBe(hash);
    expect(extracted.payload?.batteryId).toBe("BAT0001");
    expect(extracted.payload?.soh).toBe(92.4);
  });

  it("verifies authentic PDF passes content digest and payload checks with zero errors", async () => {
    const { generateBatteryPassportPdf } = await import("./passportPdf");
    const { extractPassportPayloadFromRawPdf, computeArrayBufferSha256, computeSha256, generateCanonicalJson, normalizePassportData } = await import("./passportCrypto");

    const { pdfBytes, hash } = await generateBatteryPassportPdf(sampleData);
    const extracted = extractPassportPayloadFromRawPdf(pdfBytes);

    expect(extracted.found).toBe(true);
    expect(extracted.hash).toBe(hash);
    expect(extracted.documentDigest).toBeDefined();
    expect(extracted.documentBodyBuffer).toBeDefined();

    // 1. Check payload SHA-256
    const recalculatedPayloadHash = await computeSha256(generateCanonicalJson(normalizePassportData(extracted.payload!)));
    expect(recalculatedPayloadHash).toBe(hash);

    // 2. Check document content stream digest
    const computedBodyDigest = await computeArrayBufferSha256(extracted.documentBodyBuffer!);
    expect(computedBodyDigest).toBe(extracted.documentDigest);
  });

  it("detects post-issuance text alteration via document stream digest mismatch", async () => {
    const { generateBatteryPassportPdf } = await import("./passportPdf");
    const { extractPassportPayloadFromRawPdf, computeArrayBufferSha256 } = await import("./passportCrypto");

    const { pdfBytes } = await generateBatteryPassportPdf(sampleData);

    // Simulate an attacker editing the text in the PDF stream (e.g. changing SOH or Cycle)
    const decoder = new TextDecoder("utf-8");
    const originalPdfString = decoder.decode(pdfBytes);
    const tamperedPdfString = originalPdfString.replace("92.4% State of Health", "99.9% State of Health");
    const tamperedBytes = new TextEncoder().encode(tamperedPdfString);

    const extracted = extractPassportPayloadFromRawPdf(tamperedBytes);
    expect(extracted.found).toBe(true);
    expect(extracted.documentDigest).toBeDefined();
    expect(extracted.documentBodyBuffer).toBeDefined();

    const tamperedBodyDigest = await computeArrayBufferSha256(extracted.documentBodyBuffer!);
    // The altered stream digest MUST NOT match the sealed documentDigest
    expect(tamperedBodyDigest).not.toBe(extracted.documentDigest);
  });
});

