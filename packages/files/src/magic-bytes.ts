// Vérification du type de fichier PAR LE CONTENU (SOC-08, CLAUDE.md §5) —
// jamais par l'extension ou le Content-Type déclaré, qui sont falsifiables.
// Liste volontairement limitée aux formats mentionnés par le PRD (BUD-03 :
// « PDF ou image ») ; pas de dépendance à une lib de détection pour un
// besoin aussi restreint.
export type DetectedFileType = {
  mime: string;
  extension: string;
};

type Signature = {
  mime: string;
  extension: string;
  matches: (bytes: Uint8Array) => boolean;
};

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

const SIGNATURES: Signature[] = [
  { mime: "application/pdf", extension: "pdf", matches: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]) }, // %PDF
  { mime: "image/png", extension: "png", matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { mime: "image/jpeg", extension: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: "image/gif", extension: "gif", matches: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) }, // GIF8
  {
    mime: "image/webp",
    extension: "webp",
    matches: (b) =>
      startsWith(b, [0x52, 0x49, 0x46, 0x46]) && // RIFF
      b.length >= 12 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50, // WEBP
  },
];

export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  const signature = SIGNATURES.find((candidate) => candidate.matches(bytes));
  return signature ? { mime: signature.mime, extension: signature.extension } : null;
}

export const ALLOWED_MIME_TYPES = SIGNATURES.map((s) => s.mime);
