// Lot 17 (DEV-09 à DEV-11, ADR 0046) — règles pures de l'apparence et des
// textes des documents : validation des réglages, contrôle de l'IBAN et du
// BIC, copie figée dans l'instantané vendeur selon le document.
import type { DocumentFont, DocumentSettings, DocumentSnapshot } from "@symbola/contracts";

export type DocumentSettingsField = "color" | "font" | "iban" | "bic" | "quoteIntro" | "quoteTerms" | "invoiceIntro" | "invoiceTerms" | "footer";

export class InvalidDocumentSettingsError extends Error {
  constructor(readonly field: DocumentSettingsField) {
    super(`réglage de document invalide : ${field}`);
    this.name = "InvalidDocumentSettingsError";
  }
}

export const DOCUMENT_INTRO_MAX_LENGTH = 600;
export const DOCUMENT_TERMS_MAX_LENGTH = 2000;

const FONTS: DocumentFont[] = ["modern", "classic"];
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export const EMPTY_DOCUMENT_SETTINGS: DocumentSettings = {
  color: null,
  font: "modern",
  iban: null,
  bic: null,
  quoteIntro: null,
  quoteTerms: null,
  invoiceIntro: null,
  invoiceTerms: null,
  footer: null,
};

// Espaces tolérés à la saisie, majuscules imposées.
export function normalizeBankCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

// Clé de contrôle ISO 13616 : les quatre premiers caractères passent à la
// fin, chaque lettre devient un nombre (A = 10… Z = 35), le reste de la
// division par 97 doit valoir 1. Calcul par morceaux, sans grand entier.
export function isValidIban(value: string): boolean {
  const iban = normalizeBankCode(value);
  if (!IBAN_PATTERN.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidBic(value: string): boolean {
  return BIC_PATTERN.test(normalizeBankCode(value));
}

// Affichage par groupes de quatre caractères (FR76 3000 6000 …).
export function formatIban(iban: string): string {
  return normalizeBankCode(iban).replace(/(.{4})(?=.)/g, "$1 ");
}

function optionalText(value: string | null | undefined, maxLength: number, field: DocumentSettingsField): string | null {
  const text = value?.trim() ?? "";
  if (text === "") return null;
  if (text.length > maxLength) throw new InvalidDocumentSettingsError(field);
  return text;
}

// Réglages nettoyés, ou une erreur qui nomme le champ à corriger.
export function cleanDocumentSettings(input: DocumentSettings): DocumentSettings {
  const color = input.color?.trim().toLowerCase() || null;
  if (color !== null && !COLOR_PATTERN.test(color)) throw new InvalidDocumentSettingsError("color");
  if (!FONTS.includes(input.font)) throw new InvalidDocumentSettingsError("font");
  const iban = input.iban ? normalizeBankCode(input.iban) || null : null;
  if (iban !== null && !isValidIban(iban)) throw new InvalidDocumentSettingsError("iban");
  const bic = input.bic ? normalizeBankCode(input.bic) || null : null;
  if (bic !== null && !isValidBic(bic)) throw new InvalidDocumentSettingsError("bic");
  return {
    color,
    font: input.font,
    iban,
    bic,
    quoteIntro: optionalText(input.quoteIntro, DOCUMENT_INTRO_MAX_LENGTH, "quoteIntro"),
    quoteTerms: optionalText(input.quoteTerms, DOCUMENT_TERMS_MAX_LENGTH, "quoteTerms"),
    invoiceIntro: optionalText(input.invoiceIntro, DOCUMENT_INTRO_MAX_LENGTH, "invoiceIntro"),
    invoiceTerms: optionalText(input.invoiceTerms, DOCUMENT_TERMS_MAX_LENGTH, "invoiceTerms"),
    footer: optionalText(input.footer, DOCUMENT_INTRO_MAX_LENGTH, "footer"),
  };
}

// Copie figée à l'envoi du devis ou à l'émission de la facture (règle 2 du
// lot 17). Les conditions de paiement d'une facture sont figées à part
// (invoices.mentions, DEV-04) : terms reste vide pour une facture.
export function documentSnapshot(settings: DocumentSettings, kind: "quote" | "invoice"): DocumentSnapshot {
  return {
    color: settings.color,
    font: settings.font,
    iban: settings.iban,
    bic: settings.bic,
    intro: kind === "quote" ? settings.quoteIntro : settings.invoiceIntro,
    terms: kind === "quote" ? settings.quoteTerms : null,
    footer: settings.footer,
  };
}
