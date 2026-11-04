// PRE-02 (lot 11, ADR 0031 § 3) — valeurs des champs propres à un type de
// prestataire : chaque valeur est validée selon le format du champ. Les
// montants sont des centimes entiers (CLAUDE.md § 5), les heures « HH:MM ».
import type { VendorFieldFilter, VendorFieldKind, VendorFieldValue, VendorTypeField } from "@symbola/contracts";

export class InvalidVendorFieldValueError extends Error {
  constructor(readonly fieldId: string) {
    super("valeur de champ invalide");
    this.name = "InvalidVendorFieldValueError";
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Valeur saisie dans un formulaire (texte) → valeur typée, ou null si vide.
// Montant saisi en euros (« 1 200,50 ») → centimes.
export function parseFieldInput(kind: VendorFieldKind, raw: string): VendorFieldValue | null {
  const value = raw.trim();
  if (value === "") return null;
  switch (kind) {
    case "number": {
      const number = Number(value.replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(number) ? number : Number.NaN;
    }
    case "amount": {
      const euros = Number(value.replace(/[\s€]/g, "").replace(",", "."));
      return Number.isFinite(euros) ? Math.round(euros * 100) : Number.NaN;
    }
    case "boolean":
      return value === "true" || value === "on" || value === "oui" || value === "yes";
    default:
      return value;
  }
}

function isValid(field: VendorTypeField, value: VendorFieldValue): boolean {
  switch (field.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "amount":
      return typeof value === "number" && Number.isInteger(value) && value >= 0;
    case "boolean":
      return typeof value === "boolean";
    case "time":
      return typeof value === "string" && TIME.test(value);
    case "choice":
      return typeof value === "string" && field.choices.includes(value);
    case "text":
      return typeof value === "string" && value.length <= 2000;
  }
}

// Garde seulement les champs du type, refuse une valeur mal formée.
export function cleanFieldValues(fields: VendorTypeField[], values: Record<string, VendorFieldValue | null>): Record<string, VendorFieldValue> {
  const cleaned: Record<string, VendorFieldValue> = {};
  for (const field of fields) {
    const value = values[field.id];
    if (value === undefined || value === null) continue;
    if (!isValid(field, value)) throw new InvalidVendorFieldValueError(field.id);
    cleaned[field.id] = value;
  }
  return cleaned;
}

// Filtre applicable à un champ ? (≥ / ≤ pour nombres, montants et heures ;
// « égal » pour les choix, oui/non et textes.)
export function isUsableFilter(field: VendorTypeField, filter: VendorFieldFilter): boolean {
  if (!field.isFilter || !isValid(field, filter.value)) return false;
  if (filter.op === "eq") return true;
  return field.kind === "number" || field.kind === "amount" || field.kind === "time";
}
