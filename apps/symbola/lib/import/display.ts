import { decodeHtmlEntities } from "@symbola/import-engine";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";

// Lot 69 (UX-10, HUB-14, HUB-19 ; C-56 et C-60 de l'audit UX) — ce que la planner lit d'une valeur
// importée : un affichage seulement, le fichier et ce qui s'écrit en base ne changent pas.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Un montant et rien d'autre, au moins quatre chiffres entiers (sous mille, il n'y a rien à espacer ;
// un numéro, un SIRET ou un téléphone n'a pas de « € »).
const AMOUNT_TEXT = /^(\d{4,12})(?:[.,](\d{1,2}))?\s?(?:€|EUR)$/i;

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// « 21650,50 € » → « 21 650,50 € » ; toute autre valeur est rendue telle quelle.
export function formatImportedAmountText(value: string, locale: Locale): string {
  const match = AMOUNT_TEXT.exec(value.trim());
  if (!match) return value;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return formatAmount(cents, locale);
}

export type DisplayImportCellOptions = {
  locale: Locale;
  // Libellé d'un code de statut, ou null s'il n'en est pas un : fourni seulement quand le fichier est
  // une fiche d'évènement (ailleurs, « confirmed » est une donnée de la planner).
  statusLabel?: ((value: string) => string | null) | undefined;
};

export function displayImportCell(raw: string, { locale, statusLabel }: DisplayImportCellOptions): string {
  if (raw.trim() === "") return raw;
  const decoded = decodeHtmlEntities(raw);
  const iso = ISO_DATE.exec(decoded.trim());
  if (iso && isRealDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return formatCalendarDate(decoded.trim(), locale);
  const status = statusLabel?.(decoded.trim());
  if (status) return status;
  return formatImportedAmountText(decoded, locale);
}
