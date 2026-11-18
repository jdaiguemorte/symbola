// Lot 43 (FAC-08 Divergent, ADR 0087 ; D5, D6 ; ADR 0089) — règles pures du règlement par virement :
// la référence de chaque échéance (« SYM-<année>-<six caractères> », alphabet de Crockford sans I, L,
// O ni U, pour se recopier sans erreur, sans aucune donnée personnelle : elle passe par les banques),
// la clé d'un IBAN (ISO 13616), et le contenu du QR code européen de virement (EPC069-12, version
// 002) que lisent une partie des applications bancaires. Aucun prestataire de paiement.
import { randomInt } from "node:crypto";
import QRCode from "qrcode";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REFERENCE_PATTERN = /^SYM-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/;

export function newPaymentReference(year: number, draw: (max: number) => number = randomInt): string {
  const suffix = Array.from({ length: 6 }, () => ALPHABET[draw(ALPHABET.length)]!).join("");
  return `SYM-${String(year).padStart(4, "0")}-${suffix}`;
}

export function isPaymentReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

// Clé de contrôle : le pays et la clé passent à la fin, les lettres deviennent des nombres (A = 10),
// le tout modulo 97 doit valoir 1.
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export type EpcTransfer = { beneficiary: string; iban: string; bic: string | null; amountCents: number; reference: string };

const EPC_MAX_CENTS = 99_999_999_999;

// EPC069-12 : « BCD », version 002, jeu de caractères 1 (UTF-8), « SCT », BIC (facultatif en 002),
// nom (70 caractères au plus), IBAN, montant « EUR123.45 », motif (vide), référence structurée (vide :
// la nôtre n'est pas une RF ISO 11649), puis la référence en texte libre (140 au plus).
export function epcQrPayload(transfer: EpcTransfer): string {
  if (!Number.isInteger(transfer.amountCents) || transfer.amountCents < 1 || transfer.amountCents > EPC_MAX_CENTS) throw new RangeError("montant hors des bornes du QR code");
  if (!isValidIban(transfer.iban)) throw new RangeError("IBAN invalide");
  const name = transfer.beneficiary.replace(/\s+/g, " ").trim().slice(0, 70);
  if (!name) throw new RangeError("bénéficiaire vide");
  const amount = `EUR${Math.floor(transfer.amountCents / 100)}.${String(transfer.amountCents % 100).padStart(2, "0")}`;
  return ["BCD", "002", "1", "SCT", (transfer.bic ?? "").replace(/\s+/g, "").toUpperCase(), name, normalizeIban(transfer.iban), amount, "", "", transfer.reference.slice(0, 140)].join("\n");
}

export function parseEpcQrPayload(payload: string): { bic: string; beneficiary: string; iban: string; amount: string; reference: string } {
  const lines = payload.split("\n");
  if (lines[0] !== "BCD" || lines[3] !== "SCT") throw new RangeError("contenu EPC invalide");
  return { bic: lines[4] ?? "", beneficiary: lines[5] ?? "", iban: lines[6] ?? "", amount: lines[7] ?? "", reference: lines[10] ?? "" };
}

// Le dessin du QR code, en SVG (correction M, exigée par la norme EPC) ; servi dans la page, sans script.
export async function epcQrSvg(transfer: EpcTransfer): Promise<string> {
  return QRCode.toString(epcQrPayload(transfer), { type: "svg", errorCorrectionLevel: "M", margin: 2 });
}
