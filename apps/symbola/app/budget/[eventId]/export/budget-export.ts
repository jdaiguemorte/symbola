// Lot 28c (BUD-10, décision D6) — contenu de l'export du budget, commun au
// classeur XLSX et au PDF, séparé du rendu pour être testé. Feuille « Budget » :
// catégories, lignes, cinq montants et écart, totaux ; HT et TTC côte à côte
// pour un client professionnel (BUD-09). Feuille « Échéances » : les échéances
// des prestataires, par date.
import type { BudgetLine, BudgetLinesView, VendorPaymentStatus } from "@symbola/contracts";
import type { XlsxCell, XlsxSheet } from "@/lib/xlsx-workbook";

export const EXPORT_AMOUNTS = ["estimated", "quoted", "committed", "paid", "remaining", "variance"] as const;
export type ExportAmount = (typeof EXPORT_AMOUNTS)[number];
type Amounts = Record<ExportAmount, number | null>;

export type BudgetExportLabels = {
  sheetBudget: string;
  sheetPayments: string;
  category: string;
  line: string;
  vendor: string;
  vatRate: string;
  amounts: Record<ExportAmount, string>;
  ttc: (label: string) => string;
  ht: (label: string) => string;
  categoryTotal: string;
  total: string;
  payment: string;
  paymentAmount: string;
  dueOn: string;
  status: string;
  paidOn: string;
  statuses: Record<VendorPaymentStatus, string>;
};

export type BudgetExportRow = {
  kind: "category" | "line" | "total";
  category: string;
  line: string;
  vendor: string;
  vatRateBasisPoints: number | null;
  ttc: Amounts;
  ht: Amounts;
};

export type BudgetExportPayment = {
  vendor: string;
  category: string;
  line: string;
  label: string;
  amountCents: number;
  dueOn: string;
  status: VendorPaymentStatus;
  paidOn: string | null;
};

export type BudgetExportModel = {
  professional: boolean;
  rows: BudgetExportRow[];
  payments: BudgetExportPayment[];
};

type TotalsSource = { estimatedCents: number; quotedCents: number; committedCents: number; paidCents: number; remainingCents: number; varianceCents: number };

function totals(source: TotalsSource): Amounts {
  return {
    estimated: source.estimatedCents,
    quoted: source.quotedCents,
    committed: source.committedCents,
    paid: source.paidCents,
    remaining: source.remainingCents,
    variance: source.varianceCents,
  };
}

function lineAmounts(line: BudgetLine): Amounts {
  return {
    estimated: line.estimatedAmountCents,
    quoted: line.quotedAmountCents,
    committed: line.committedAmountCents,
    paid: line.paidAmountCents,
    remaining: line.remainingAmountCents,
    variance: line.varianceCents,
  };
}

function lineHt(line: BudgetLine): Amounts {
  const ht = line.ht;
  return { estimated: ht.estimatedCents, quoted: ht.quotedCents, committed: ht.committedCents, paid: ht.paidCents, remaining: ht.remainingCents, variance: ht.varianceCents };
}

export function buildBudgetExport(view: BudgetLinesView, labels: Pick<BudgetExportLabels, "categoryTotal" | "total">): BudgetExportModel {
  const rows: BudgetExportRow[] = [];
  const payments: BudgetExportPayment[] = [];
  for (const category of view.categories) {
    rows.push({ kind: "category", category: category.label, line: labels.categoryTotal, vendor: "", vatRateBasisPoints: null, ttc: totals(category), ht: totals(category.ht) });
    for (const line of category.lines) {
      rows.push({
        kind: "line",
        category: category.label,
        line: line.label,
        vendor: line.vendorName ?? "",
        vatRateBasisPoints: line.vatRateBasisPoints,
        ttc: lineAmounts(line),
        ht: lineHt(line),
      });
      for (const payment of line.payments) {
        payments.push({
          vendor: line.vendorName ?? "",
          category: category.label,
          line: line.label,
          label: payment.label,
          amountCents: payment.amountCents,
          dueOn: payment.dueOn,
          status: payment.status,
          paidOn: payment.paidOn,
        });
      }
    }
  }
  rows.push({
    kind: "total",
    category: labels.total,
    line: "",
    vendor: "",
    vatRateBasisPoints: null,
    ttc: totals({
      estimatedCents: view.totalEstimatedCents,
      quotedCents: view.totalQuotedCents,
      committedCents: view.totalCommittedCents,
      paidCents: view.totalPaidCents,
      remainingCents: view.totalRemainingCents,
      varianceCents: view.totalVarianceCents,
    }),
    ht: totals(view.totalHt),
  });
  payments.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.vendor.localeCompare(b.vendor));
  return { professional: view.clientKind === "professional", rows, payments };
}

const money = (cents: number | null, bold: boolean): XlsxCell => (cents === null ? null : { kind: "money", cents, bold });

export function budgetXlsxSheets(model: BudgetExportModel, labels: BudgetExportLabels): XlsxSheet[] {
  const amountColumns = EXPORT_AMOUNTS.flatMap((amount) =>
    model.professional
      ? [
          { header: labels.ht(labels.amounts[amount]), width: 15 },
          { header: labels.ttc(labels.amounts[amount]), width: 15 },
        ]
      : [{ header: labels.ttc(labels.amounts[amount]), width: 15 }],
  );
  const budget: XlsxSheet = {
    name: labels.sheetBudget,
    columns: [
      { header: labels.category, width: 24 },
      { header: labels.line, width: 30 },
      { header: labels.vendor, width: 24 },
      ...(model.professional ? [{ header: labels.vatRate, width: 12 }] : []),
      ...amountColumns,
    ],
    rows: model.rows.map((row): XlsxCell[] => {
      const bold = row.kind !== "line";
      const rate: XlsxCell[] = model.professional ? [row.vatRateBasisPoints === null ? null : { kind: "percent", basisPoints: row.vatRateBasisPoints }] : [];
      return [
        { kind: "text", value: row.category, bold },
        { kind: "text", value: row.line, bold },
        { kind: "text", value: row.vendor },
        ...rate,
        ...EXPORT_AMOUNTS.flatMap((amount) => (model.professional ? [money(row.ht[amount], bold), money(row.ttc[amount], bold)] : [money(row.ttc[amount], bold)])),
      ];
    }),
  };
  const schedule: XlsxSheet = {
    name: labels.sheetPayments,
    columns: [
      { header: labels.vendor, width: 24 },
      { header: labels.category, width: 20 },
      { header: labels.line, width: 26 },
      { header: labels.payment, width: 24 },
      { header: labels.paymentAmount, width: 15 },
      { header: labels.dueOn, width: 14 },
      { header: labels.status, width: 12 },
      { header: labels.paidOn, width: 14 },
    ],
    rows: model.payments.map((payment): XlsxCell[] => [
      { kind: "text", value: payment.vendor },
      { kind: "text", value: payment.category },
      { kind: "text", value: payment.line },
      { kind: "text", value: payment.label },
      { kind: "money", cents: payment.amountCents },
      { kind: "date", value: payment.dueOn },
      { kind: "text", value: labels.statuses[payment.status] },
      payment.paidOn ? { kind: "date", value: payment.paidOn } : null,
    ]),
  };
  return [budget, schedule];
}

// PDF : montants déjà formatés ; « — » pour un montant inconnu ; le HT sous le
// TTC pour un client professionnel.
export function budgetPdfRows(
  model: BudgetExportModel,
  format: { amount: (cents: number) => string; ht: (amount: string) => string },
): { kind: BudgetExportRow["kind"]; label: string; vendor: string; amounts: string[]; ht: string[] }[] {
  return model.rows.map((row) => ({
    kind: row.kind,
    label: row.kind === "category" ? row.category : row.kind === "total" ? row.category : row.line,
    vendor: row.vendor,
    amounts: EXPORT_AMOUNTS.map((amount) => (row.ttc[amount] === null ? "—" : format.amount(row.ttc[amount]!))),
    ht: EXPORT_AMOUNTS.map((amount) => (model.professional && row.ht[amount] !== null ? format.ht(format.amount(row.ht[amount]!)) : "")),
  }));
}

export function budgetPdfPayments(
  model: BudgetExportModel,
  labels: Pick<BudgetExportLabels, "statuses">,
  format: { amount: (cents: number) => string; date: (date: string) => string },
): string[][] {
  return model.payments.map((payment) => [
    payment.vendor,
    payment.line,
    payment.label,
    format.amount(payment.amountCents),
    format.date(payment.dueOn),
    labels.statuses[payment.status],
    payment.paidOn ? format.date(payment.paidOn) : "",
  ]);
}
