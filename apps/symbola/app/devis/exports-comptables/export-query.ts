// Lot 58 (FAC-11 ; D1 ; ADR 0097) — lecture de la période et du format demandés (adresse de l'écran ou
// du téléchargement), et mots des fichiers tirés des traductions. Toute valeur inconnue retombe sur une
// valeur sûre ; aucune donnée personnelle dans l'adresse.
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { ACCOUNTING_FAMILIES, type AccountingFamily } from "@symbola/starter-templates";
import { ACCOUNTING_FORMATS, PERIOD_KINDS, periodBounds, type AccountingFormat, type ExportWords, type Period, type PeriodKind } from "@/modules/quotes/service";

export type ExportQuery = { type?: string; annee?: string; index?: string; famille?: string; format?: string };

export function parsePeriod(query: ExportQuery, fiscalYearStartMonth: number, today: string = parisToday()): Period {
  const kind: PeriodKind = PERIOD_KINDS.includes(query.type as PeriodKind) ? (query.type as PeriodKind) : "month";
  const currentYear = Number(today.slice(0, 4));
  const year = /^\d{4}$/.test(query.annee ?? "") ? Number(query.annee) : currentYear;
  const month = Number(today.slice(5, 7));
  const fallbackIndex = kind === "quarter" ? Math.ceil(month / 3) : month;
  const index = /^\d{1,2}$/.test(query.index ?? "") ? Number(query.index) : fallbackIndex;
  try {
    return periodBounds(kind, year, index, fiscalYearStartMonth);
  } catch {
    return periodBounds("month", currentYear, month, fiscalYearStartMonth);
  }
}

export function parseFamily(value: string | undefined, fallback: AccountingFamily): AccountingFamily {
  return ACCOUNTING_FAMILIES.includes(value as AccountingFamily) ? (value as AccountingFamily) : fallback;
}

export function parseFormat(value: string | null | undefined): AccountingFormat | null {
  return ACCOUNTING_FORMATS.includes(value as AccountingFormat) ? (value as AccountingFormat) : null;
}

export function periodIndex(period: Period): number {
  const month = Number(period.start.slice(5, 7));
  return period.kind === "quarter" ? Math.ceil(month / 3) : month;
}

export function periodSearch(period: Period, family: AccountingFamily): string {
  return new URLSearchParams({ type: period.kind, annee: period.start.slice(0, 4), index: String(periodIndex(period)), famille: family }).toString();
}

export async function exportWords(period: Period, organization: string, locale: Locale): Promise<ExportWords> {
  const t = await getTranslations("AccountingExports");
  return {
    header: { period: t("header.period"), organization: t("header.organization"), exportedOn: t("header.exportedOn") },
    periodLabel: t("periodLabel", { start: formatCalendarDate(period.start, locale), end: formatCalendarDate(period.end, locale) }),
    organization,
    exportedOn: formatCalendarDate(parisToday(), locale),
    receipts: { columns: [t("receiptsColumns.date"), t("receiptsColumns.method"), t("receiptsColumns.invoice"), t("receiptsColumns.client"), t("receiptsColumns.amount")], total: t("total") },
    journal: {
      columns: [t("journalColumns.journal"), t("journalColumns.date"), t("journalColumns.entry"), t("journalColumns.piece"), t("journalColumns.account"), t("journalColumns.label"), t("journalColumns.debit"), t("journalColumns.credit")],
      total: t("total"),
    },
    lines: { invoice: t("lines.invoice"), creditNote: t("lines.creditNote"), payment: t("lines.payment"), reversal: t("lines.reversal") },
  };
}
