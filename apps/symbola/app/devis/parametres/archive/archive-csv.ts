// Lot 23b (JUR-06, ADR 0061) — CSV des écritures d'une année : lisible dans dix
// ans par un tableur, sans donnée personnelle (numéros, montants, empreintes).
import { formatAmount, type Locale } from "@symbola/i18n";
import { toCsv } from "@symbola/privacy";
import type { LedgerArchiveEntry } from "@/modules/quotes/service";

export type ArchiveCsvLabels = {
  header: string[];
  kind: (kind: LedgerArchiveEntry["kind"]) => string;
  yes: string;
};

export function ledgerCsv(entries: LedgerArchiveEntry[], labels: ArchiveCsvLabels, locale: Locale): string {
  return toCsv([
    labels.header,
    ...entries.map((entry) => [
      String(entry.sequence),
      entry.recordedAt.toISOString(),
      labels.kind(entry.kind),
      entry.number ?? "",
      entry.quoteNumber ?? "",
      entry.amountCents === null ? "" : formatAmount(entry.amountCents, locale),
      entry.paymentMethodLabel ?? "",
      entry.isBackfill ? labels.yes : "",
      entry.hash,
      entry.previousHash,
    ]),
  ]);
}
