// DEV-04 — contenu du PDF d'une facture ou d'un avoir, construit à partir
// de la copie figée à l'émission (jamais des données courantes) ; même mise
// en page que le devis (QuotePdfDocument). Mentions de départ d'une facture
// à un particulier : numéro, dates d'émission, de prestation ou d'acompte et
// d'échéance, vendeur, acheteurs, désignation, quantités, prix HT, TVA ou
// mention de franchise, totaux, acomptes déjà versés.
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { CreditNoteView, InvoiceTotalsView, InvoiceView } from "@/modules/quotes/service";
import type { QuotePdfLogo, QuotePdfModel } from "../[quoteId]/quote-pdf-model";
import { formatRate } from "../quote-display";

export type InvoicePdfLabels = {
  invoiceTitle: (number: string) => string;
  depositInvoice: string;
  balanceInvoice: string;
  creditNoteTitle: (number: string) => string;
  creditNoteFor: (invoiceNumber: string) => string;
  reason: (reason: string) => string;
  issuedOn: (date: string) => string;
  serviceDate: (date: string) => string;
  depositDate: (date: string) => string;
  dueOn: (date: string) => string;
  siren: (siren: string) => string;
  buyers: (lines: string) => string;
  depositLine: (label: string, quoteNumber: string) => string;
  creditNoteLine: (invoiceNumber: string) => string;
  columns: { label: string; quantity: string; unitPrice: string; discount: string; vatRate: string; total: string };
  totalHt: string;
  vatAtRate: (rate: string) => string;
  totalTtc: string;
  quoteTotalTtc: string;
  deduction: (number: string) => string;
  amountDue: string;
};

function totalRows(totals: InvoiceTotalsView, vat: boolean, labels: InvoicePdfLabels, locale: Locale): QuotePdfModel["totals"] {
  const rows: QuotePdfModel["totals"] = [{ label: labels.totalHt, value: formatAmount(totals.totalHtCents, locale), strong: !vat }];
  if (vat) {
    for (const line of totals.vatByRate) rows.push({ label: labels.vatAtRate(formatRate(line.rateBasisPoints, locale)), value: formatAmount(line.vatCents, locale) });
    rows.push({ label: labels.totalTtc, value: formatAmount(totals.totalTtcCents, locale), strong: true });
  }
  return rows;
}

function sellerOf(seller: InvoiceView["seller"], labels: InvoicePdfLabels) {
  return {
    name: seller.organizationName,
    lines: [seller.address, seller.siren ? labels.siren(seller.siren) : null].filter((line): line is string => Boolean(line)),
  };
}

function columnsFor(vat: boolean, labels: InvoicePdfLabels): string[] {
  const columns = [labels.columns.label, labels.columns.quantity, labels.columns.unitPrice, labels.columns.discount];
  if (vat) columns.push(labels.columns.vatRate);
  columns.push(labels.columns.total);
  return columns;
}

function quantity(milli: number, unit: string, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 3 }).format(milli / 1000)} ${unit}`;
}

export function buildInvoicePdfModel(input: {
  invoice: InvoiceView;
  labels: InvoicePdfLabels;
  locale: Locale;
  logo: QuotePdfLogo | null;
  watermark: string | null;
}): QuotePdfModel {
  const { invoice, labels, locale } = input;
  const vat = invoice.vatApplicable;
  const dates = [labels.issuedOn(formatCalendarDate(invoice.issuedOn, locale))];
  if (invoice.serviceDate) {
    const date = formatCalendarDate(invoice.serviceDate, locale);
    dates.push(invoice.kind === "deposit" ? labels.depositDate(date) : labels.serviceDate(date));
  }
  dates.push(labels.dueOn(formatCalendarDate(invoice.paymentDueOn, locale)));

  const rows =
    invoice.kind === "balance"
      ? invoice.lines.map((line) => {
          const cells = [
            line.label,
            quantity(line.quantityMilli, line.unit, locale),
            formatAmount(line.unitPriceCents, locale),
            line.discountBasisPoints > 0 ? `${formatRate(line.discountBasisPoints, locale)} %` : "—",
          ];
          if (vat) cells.push(`${formatRate(line.vatRateBasisPoints, locale)} %`);
          cells.push(formatAmount(line.netCents, locale));
          return { cells, description: line.description };
        })
      : [
          {
            cells: [
              labels.depositLine(invoice.depositLabel ?? "", invoice.quoteNumber),
              "1",
              formatAmount(invoice.totals.totalHtCents, locale),
              "—",
              ...(vat ? [invoice.totals.vatByRate.map((line) => `${formatRate(line.rateBasisPoints, locale)} %`).join(", ")] : []),
              formatAmount(invoice.totals.totalHtCents, locale),
            ],
            description: null,
          },
        ];

  const totals =
    invoice.kind === "balance"
      ? [
          { label: labels.quoteTotalTtc, value: formatAmount(invoice.quoteTotals.totalTtcCents, locale) },
          ...invoice.deductions.map((deduction) => ({
            label: labels.deduction(deduction.number),
            value: `− ${formatAmount(deduction.amountCents, locale)}`,
          })),
          ...totalRows(invoice.totals, vat, labels, locale),
          { label: labels.amountDue, value: formatAmount(invoice.amountCents, locale), strong: true },
        ]
      : totalRows(invoice.totals, vat, labels, locale);

  return {
    language: locale,
    title: labels.invoiceTitle(invoice.number),
    status: invoice.kind === "deposit" ? labels.depositInvoice : labels.balanceInvoice,
    seller: sellerOf(invoice.seller, labels),
    logo: input.logo,
    client: labels.buyers(invoice.buyers.map((buyer) => `${buyer.name}, ${buyer.billingAddress}`).join("\n")),
    dates,
    columns: columnsFor(vat, labels),
    rows,
    totals,
    legalMention: [invoice.legalMention, invoice.mentions].filter(Boolean).join("\n") || null,
    watermark: input.watermark,
    signature: null,
  };
}

export function buildCreditNotePdfModel(input: {
  creditNote: CreditNoteView;
  vatApplicable: boolean;
  labels: InvoicePdfLabels;
  locale: Locale;
  logo: QuotePdfLogo | null;
  watermark: string | null;
}): QuotePdfModel {
  const { creditNote, labels, locale, vatApplicable } = input;
  return {
    language: locale,
    title: labels.creditNoteTitle(creditNote.number),
    status: labels.creditNoteFor(creditNote.invoiceNumber),
    seller: sellerOf(creditNote.seller, labels),
    logo: input.logo,
    client: labels.buyers(creditNote.buyers.map((buyer) => `${buyer.name}, ${buyer.billingAddress}`).join("\n")),
    dates: [labels.issuedOn(formatCalendarDate(creditNote.issuedOn, locale)), labels.reason(creditNote.reason)],
    columns: columnsFor(vatApplicable, labels),
    rows: [
      {
        cells: [
          labels.creditNoteLine(creditNote.invoiceNumber),
          "1",
          formatAmount(creditNote.totals.totalHtCents, locale),
          "—",
          ...(vatApplicable ? [creditNote.totals.vatByRate.map((line) => `${formatRate(line.rateBasisPoints, locale)} %`).join(", ")] : []),
          formatAmount(creditNote.totals.totalHtCents, locale),
        ],
        description: null,
      },
    ],
    totals: totalRows(creditNote.totals, vatApplicable, labels, locale),
    legalMention: creditNote.legalMention,
    watermark: input.watermark,
    signature: null,
  };
}
