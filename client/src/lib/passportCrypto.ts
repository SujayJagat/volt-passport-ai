/**
 * Cryptographic utility functions for Battery Passport verification and tamper detection.
 * Uses standard Web Crypto API for deterministic SHA-256 hashing and document content digests.
 */

export interface CanonicalPassportData {
  batteryId: string;
  batchId?: string;
  soh: number;
  grade: string;
  status: string;
  lifecycle: string;
  cycle: number;
  temp: number;
  volt: number;
  resistance: number;
  fastCharge: number;
  modelLabel: string;
  issuedAt: string; // ISO 8601 or YYYY-MM-DD
  issuer?: string;
}

export interface VerificationResult {
  isValid: boolean;
  tampered: boolean;
  computedHash: string;
  expectedHash?: string;
  discrepancies: Array<{
    field: string;
    claimed: string | number;
    expected: string | number;
  }>;
  payload?: CanonicalPassportData;
  isRegisteredDb?: boolean;
  message: string;
}

export interface ExtractedPassportSignature {
  found: boolean;
  hash?: string;
  documentDigest?: string;
  payload?: CanonicalPassportData;
  rawJson?: string;
  documentBodyBuffer?: ArrayBuffer;
}

/**
 * Normalizes passport data into a deterministic canonical object.
 * Numerical values are rounded to standard precisions to prevent floating point discrepancies across platforms.
 */
export function normalizePassportData(data: Partial<CanonicalPassportData>): CanonicalPassportData {
  return {
    batteryId: (data.batteryId || "UNKNOWN").trim().toUpperCase(),
    batchId: (data.batchId || "Standard Pack").trim(),
    soh: Number(Number(data.soh ?? 0).toFixed(2)),
    grade: String(data.grade || "A").trim().toUpperCase(),
    status: String(data.status || "EV READY").trim(),
    lifecycle: String(data.lifecycle || "Continue EV operation").trim(),
    cycle: Math.round(Number(data.cycle ?? 0)),
    temp: Number(Number(data.temp ?? 25).toFixed(1)),
    volt: Number(Number(data.volt ?? 3.8).toFixed(3)),
    resistance: Number(Number(data.resistance ?? 0.02).toFixed(5)),
    fastCharge: Number(Number(data.fastCharge ?? 0).toFixed(1)),
    modelLabel: String(data.modelLabel || "VoltPassport AI Engine").trim(),
    issuedAt: data.issuedAt ? String(data.issuedAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
    issuer: String(data.issuer || "VoltPassport AI Authority").trim(),
  };
}

/**
 * Produces a deterministic sorted JSON string from canonical passport data.
 */
export function generateCanonicalJson(data: Partial<CanonicalPassportData>): string {
  const normalized = normalizePassportData(data);
  const keys = Object.keys(normalized).sort() as Array<keyof CanonicalPassportData>;
  const orderedObj: Record<string, any> = {};
  for (const k of keys) {
    orderedObj[k] = normalized[k];
  }
  return JSON.stringify(orderedObj);
}

/**
 * Computes SHA-256 hash using Web Crypto API.
 */
export async function computeSha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Computes SHA-256 hash of an ArrayBuffer (e.g. uploaded PDF file or binary stream).
 */
export async function computeArrayBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Generates the full verifiable passport fingerprint.
 */
export async function generatePassportFingerprint(data: Partial<CanonicalPassportData>): Promise<{
  hash: string;
  shortHash: string;
  canonicalJson: string;
  normalizedData: CanonicalPassportData;
}> {
  const normalized = normalizePassportData(data);
  const canonicalJson = generateCanonicalJson(normalized);
  const hash = await computeSha256(canonicalJson);
  const shortHash = `SHA-256:${hash.slice(0, 16)}...${hash.slice(-8)}`;
  return {
    hash,
    shortHash,
    canonicalJson,
    normalizedData: normalized,
  };
}

/**
 * Compares two passport data objects and flags any tampered fields.
 */
export function comparePassportPayloads(
  original: CanonicalPassportData,
  claimed: Partial<CanonicalPassportData>
): Array<{ field: string; claimed: string | number; expected: string | number }> {
  const diffs: Array<{ field: string; claimed: string | number; expected: string | number }> = [];
  const normalizedClaimed = normalizePassportData(claimed);

  const keys: Array<keyof CanonicalPassportData> = [
    "batteryId",
    "soh",
    "grade",
    "cycle",
    "temp",
    "volt",
    "resistance",
    "fastCharge",
  ];

  for (const k of keys) {
    if (original[k] !== normalizedClaimed[k]) {
      diffs.push({
        field: k,
        claimed: normalizedClaimed[k] ?? "N/A",
        expected: original[k] ?? "N/A",
      });
    }
  }

  return diffs;
}

/**
 * Extracts embedded cryptographic payload and separates the document stream body.
 */
export function extractPassportPayloadFromRawPdf(pdfContent: string | ArrayBuffer): ExtractedPassportSignature {
  let text = "";
  let fullBuffer: ArrayBuffer | null = null;

  if (typeof pdfContent === "string") {
    text = pdfContent;
    fullBuffer = new TextEncoder().encode(pdfContent).buffer;
  } else {
    fullBuffer = pdfContent;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    text = decoder.decode(new Uint8Array(pdfContent));
  }

  // Look for the embedded cryptographic payload marker:
  const markerString = "VOLTPASSPORT_PAYLOAD_START>>>";
  const markerIndex = text.indexOf(markerString);

  if (markerIndex !== -1) {
    const endMarkerString = "<<<VOLTPASSPORT_PAYLOAD_END";
    const endIndex = text.indexOf(endMarkerString, markerIndex);

    if (endIndex !== -1) {
      const jsonStr = text.slice(markerIndex + markerString.length, endIndex).trim();
      let documentBodyBuffer: ArrayBuffer | undefined = undefined;

      if (fullBuffer) {
        // Extract exact binary body up to the start of the cryptographic trailer
        // In the PDF, the trailer begins with "\n% VOLTPASSPORT_PAYLOAD_START>>>"
        const fullTrailerMarker = "\n% VOLTPASSPORT_PAYLOAD_START>>>";
        const markerBytes = new TextEncoder().encode(
          text.includes(fullTrailerMarker) ? fullTrailerMarker : markerString
        );
        const u8 = new Uint8Array(fullBuffer);
        let bytePos = -1;

        for (let i = 0; i <= u8.length - markerBytes.length; i++) {
          let match = true;
          for (let j = 0; j < markerBytes.length; j++) {
            if (u8[i + j] !== markerBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            bytePos = i;
            break;
          }
        }

        if (bytePos !== -1) {
          documentBodyBuffer = fullBuffer.slice(0, bytePos);
        }
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.hash && parsed.data) {
          return {
            found: true,
            hash: String(parsed.hash).toUpperCase(),
            documentDigest: parsed.documentDigest ? String(parsed.documentDigest).toUpperCase() : undefined,
            payload: parsed.data,
            rawJson: jsonStr,
            documentBodyBuffer,
          };
        }
      } catch {
        // continue to fallback
      }
    }
  }

  // Fallback: search regex for standalone 64-hex SHA-256
  const hashRegex = /SHA-256[:\s]*([A-Fa-f0-9]{64})/i;
  const hashMatch = text.match(hashRegex);
  if (hashMatch && hashMatch[1]) {
    return {
      found: true,
      hash: hashMatch[1].toUpperCase(),
    };
  }

  return { found: false };
}
