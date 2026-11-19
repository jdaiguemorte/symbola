// Lot 48a (DAT-08 ; D5, ADR 0093) — IBAN et BIC de la planner (quotes.quote_settings), chiffrés au
// niveau du champ (field-box, ADR 0079). La migration 0176 et son étape de données ont chiffré les
// valeurs existantes ; ce fichier chiffre à l'écriture et déchiffre à la lecture, pour l'affichage et
// les documents (l'écran « Régler l'acompte » du lot 43 compris). Une valeur encore en clair (étape
// de données pas encore passée) se lit telle quelle, et se chiffre au prochain enregistrement.
import { randomUUID } from "node:crypto";
import { openField, sealField, type FieldPlace } from "@symbola/auth";
import type { quoteSettings } from "@symbola/db/schema/quotes";

type RawSettings = typeof quoteSettings.$inferSelect;
export type OpenQuoteSettings = Omit<RawSettings, "ibanSealed" | "bicSealed">;

// Même place que l'étape de données (packages/db/scripts/data-steps.ts, quoteSettingsBankPlace).
export function quoteSettingsBankPlace(organizationId: string, settingsId: string, column: "iban_sealed" | "bic_sealed"): FieldPlace {
  return { organizationId, table: "quotes.quote_settings", column, rowId: settingsId };
}

export function openQuoteSettings(row: RawSettings): OpenQuoteSettings {
  const { ibanSealed, bicSealed, ...rest } = row;
  return {
    ...rest,
    iban: ibanSealed ? openField(ibanSealed, quoteSettingsBankPlace(row.organizationId, row.id, "iban_sealed")) : row.iban,
    bic: bicSealed ? openField(bicSealed, quoteSettingsBankPlace(row.organizationId, row.id, "bic_sealed")) : row.bic,
  };
}

// Colonnes à écrire pour un IBAN et un BIC en clair : chiffrés, colonnes en clair vidées.
export function sealedBankColumns(organizationId: string, settingsId: string, values: { iban: string | null; bic: string | null }) {
  return {
    ibanSealed: values.iban ? sealField(values.iban, quoteSettingsBankPlace(organizationId, settingsId, "iban_sealed")) : null,
    bicSealed: values.bic ? sealField(values.bic, quoteSettingsBankPlace(organizationId, settingsId, "bic_sealed")) : null,
    iban: null,
    bic: null,
  };
}

export function newSettingsId(): string {
  return randomUUID();
}
