// DEV-04 — export e-reporting en CSV (séparateur « ; », montants en euros
// avec virgule décimale, UTF-8 avec BOM : lisible tel quel par un tableur
// français). Les cellules de texte qui commencent par = + - @ sont
// neutralisées (injection de formule, CLAUDE.md §5) ; les montants, produits
// par l'app, restent numériques.
import type { EReportingView } from "@/modules/quotes/service";

export type CsvLabels = {
  header: string[];
  invoice: string;
  creditNote: string;
  payment: string;
  total: string;
  deposit: string;
  balance: string;
};

function text(value: string | null | undefined): string {
  const raw = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function euros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}

export function eReportingCsv(view: EReportingView, labels: CsvLabels): string {
  const rows: string[][] = [labels.header.map(text)];
  for (const invoice of view.invoices) {
    rows.push([
      text(labels.invoice),
      invoice.issuedOn,
      text(invoice.number),
      "",
      text(invoice.kind === "deposit" ? labels.deposit : labels.balance),
      euros(invoice.totalHtCents),
      euros(invoice.totalVatCents),
      euros(invoice.totalTtcCents),
      "",
    ]);
  }
  for (const note of view.creditNotes) {
    rows.push([
      text(labels.creditNote),
      note.issuedOn,
      text(note.number),
      text(note.invoiceNumber),
      "",
      euros(-note.totalHtCents),
      euros(-note.totalVatCents),
      euros(-note.totalTtcCents),
      "",
    ]);
  }
  for (const payment of view.payments) {
    rows.push([text(labels.payment), payment.paidOn, "", text(payment.quoteNumber), text(payment.label), "", "", euros(payment.amountCents), text(payment.paymentMethod)]);
  }
  rows.push([
    text(labels.total),
    `${view.from}/${view.to}`,
    "",
    "",
    "",
    euros(view.totals.netHtCents),
    euros(view.totals.netVatCents),
    euros(view.totals.netTtcCents),
    euros(view.totals.collectedCents),
  ]);
  return `﻿${rows.map((row) => row.join(";")).join("\r\n")}\r\n`;
}

// Périodes bimestrielles d'une année (franchise : déclaration tous les deux
// mois, PRD DEV-04 — à confirmer avec le comptable).
export function bimonthlyPeriods(year: number): { from: string; to: string }[] {
  return Array.from({ length: 6 }, (_, index) => {
    const startMonth = index * 2 + 1;
    const endMonth = startMonth + 1;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      to: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  });
}
