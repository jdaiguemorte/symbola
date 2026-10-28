// IMP-01 — lecture d'un fichier d'import. Le type est reconnu par le contenu
// (ADR 0022), jamais par l'extension. Aucune entrée réseau ni disque : le
// fichier arrive en mémoire, déjà passé à l'antivirus par l'appelant.
import { detectDelimiter, parseDelimited } from "./csv";
import { looksLikeJson, readJson } from "./json";
import { buildTable } from "./table";
import { decodeText } from "./text-decode";
import { DEFAULT_TECHNICAL_LIMITS, ReadError, type ReadLimits, type ReadResult } from "./types";
import { readXlsx } from "./xlsx";
import { isZip } from "./zip";

// Conteneur OLE : ancien Excel (.xls) ou classeur protégé par mot de passe.
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const BINARY_SIGNATURES = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF8
  [0x1f, 0x8b], // gzip
];

export function readImportFile(bytes: Uint8Array, readLimits: ReadLimits): ReadResult {
  const limits = { ...DEFAULT_TECHNICAL_LIMITS, ...readLimits };
  if (bytes.length > limits.maxBytes) return { ok: false, reason: "too_large" };
  if (bytes.length === 0) return { ok: false, reason: "empty" };

  try {
    if (startsWith(bytes, OLE_SIGNATURE)) throw new ReadError("unsupported_format", "xls");
    if (BINARY_SIGNATURES.some((signature) => startsWith(bytes, signature))) {
      throw new ReadError("unsupported_format", "binary");
    }

    if (isZip(bytes)) {
      const lines = readXlsx(bytes, {
        maxRows: limits.maxRows,
        maxColumns: limits.maxColumns,
        maxUncompressedBytes: limits.maxUncompressedBytes,
      });
      return { ok: true, table: buildTable(lines, { format: "xlsx" }, limits) };
    }

    const { text, encoding } = decodeText(bytes);
    if (text.trim() === "") return { ok: false, reason: "empty" };

    if (looksLikeJson(text)) {
      const lines = readJson(text, { maxRows: limits.maxRows, maxColumns: limits.maxColumns, maxDepth: limits.maxJsonDepth });
      return { ok: true, table: buildTable(lines, { format: "json", encoding }, limits) };
    }

    const delimiter = detectDelimiter(text);
    const lines = parseDelimited(text, delimiter);
    return { ok: true, table: buildTable(lines, { format: "csv", encoding, delimiter }, limits) };
  } catch (error) {
    if (error instanceof ReadError) {
      return error.hint ? { ok: false, reason: error.reason, hint: error.hint } : { ok: false, reason: error.reason };
    }
    throw error;
  }
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}
