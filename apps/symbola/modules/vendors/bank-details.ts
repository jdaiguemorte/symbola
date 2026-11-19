// Lot 48a (PRE-10, SEC-27, DAT-08 ; D5, ADR 0093) — IBAN et BIC d'un prestataire : contrôle de la clé
// (ISO 13616), forme masquée montrée partout (« FR76 •••• •••• 1234 ») et place des valeurs chiffrées
// au niveau du champ (field-box, ADR 0079). Une erreur ne reprend jamais la valeur (SEC-20).
import type { FieldPlace } from "@symbola/auth";

const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
const BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export class InvalidBankDetailsError extends Error {
  constructor(readonly field: "iban" | "bic") {
    super(field === "iban" ? "IBAN invalide" : "BIC invalide ou sans IBAN");
    this.name = "InvalidBankDetailsError";
  }
}

export function normalizeBankCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  const iban = normalizeBankCode(value);
  if (!IBAN_PATTERN.test(iban)) return false;
  const digits = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function isValidBic(value: string): boolean {
  return BIC_PATTERN.test(normalizeBankCode(value));
}

export function maskIban(value: string): string {
  const iban = normalizeBankCode(value);
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

export function cleanBankDetails(input: { iban: string | null | undefined; bic: string | null | undefined }): { iban: string | null; bic: string | null } {
  const iban = input.iban ? normalizeBankCode(input.iban) || null : null;
  const bic = input.bic ? normalizeBankCode(input.bic) || null : null;
  if (iban !== null && !isValidIban(iban)) throw new InvalidBankDetailsError("iban");
  if (bic !== null && (iban === null || !isValidBic(bic))) throw new InvalidBankDetailsError("bic");
  return { iban, bic };
}

export function vendorBankPlace(organizationId: string, vendorId: string, column: "iban_sealed" | "bic_sealed"): FieldPlace {
  return { organizationId, table: "vendors.vendors", column, rowId: vendorId };
}

export function vendorNotePlace(organizationId: string, vendorId: string): FieldPlace {
  return { organizationId, table: "vendors.vendors", column: "internal_note_sealed", rowId: vendorId };
}
