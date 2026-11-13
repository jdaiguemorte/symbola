// DEV-04, lot 17 (DEV-07 à DEV-12, ADR 0046) — contenu du PDF d'une facture
// ou d'un avoir, construit à partir de la copie figée à l'émission (jamais
// des données courantes) ; même mise en page que le devis (QuotePdfDocument).
// Mentions de départ d'une facture à un particulier : numéro, dates
// d'émission, de prestation ou d'acompte et d'échéance, vendeur, acheteurs,
// désignation, quantités, prix HT, TVA ou mention de franchise, totaux,
// acomptes déjà versés ; encadré de règlement avec l'IBAN s'il est renseigné.
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { CreditNoteView, InvoiceBuyer, InvoiceTotalsView, InvoiceView } from "@/modules/quotes/service";
import {
  appearanceOf,
  bankLines,
  columnsFor,
  documentFooter,
  lineCells,
  sellerBlock,
  type DocumentCommonLabels,
  type QuotePdfLogo,
  type QuotePdfModel,
} from "../[quoteId]/quote-pdf-model";
import { formatRate } from "../quote-display";

export type InvoicePdfLabels = DocumentCommonLabels & {
  invoiceTitle: (number: string) => string;
  invoiceKind: string;
  creditNoteKind: string;
  depositInvoice: string;
  // Lot 31a (JUR-08) : une facture d'arrhes se dit telle.
  earnestInvoice: string;
  balanceInvoice: string;
  creditNoteTitle: (number: string) => string;
  creditNoteFor: (invoiceNumber: string) => string;
  reason: (reason: string) => string;
  dates: { issuedOn: string; serviceDate: string; depositDate: string; dueOn: string };
  paymentTitle: string;
  payBefore: (date: string) => string;
  payBeforeByTransfer: (date: string) => string;
  reference: (number: string) => string;
  depositLine: (label: string, quoteNumber: string) => string;
  creditNoteLine: (invoiceNumber: string) => string;
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

function buyersBlock(buyers: InvoiceBuyer[], labels: InvoicePdfLabels): QuotePdfModel["client"] {
  return { heading: labels.clientHeading, lines: buyers.flatMap((buyer) => [buyer.name, buyer.billingAddress]).filter(Boolean) };
}

// Une seule ligne au total des acomptes et des avoirs : le taux de TVA, ou
// les taux s'il y en a plusieurs.
function singleLine(label: string, totals: InvoiceTotalsView, vat: boolean, locale: Locale): QuotePdfModel["rows"][number] {
  return {
    cells: [
      label,
      "1",
      formatAmount(totals.totalHtCents, locale),
      "—",
      ...(vat ? [totals.vatByRate.map((line) => `${formatRate(line.rateBasisPoints, locale)} %`).join(", ")] : []),
      formatAmount(totals.totalHtCents, locale),
    ],
    description: null,
  };
}

export function buildInvoicePdfModel(input: {
  invoice: InvoiceView;
  labels: InvoicePdfLabels;
  locale: Locale;
  logo: QuotePdfLogo | null;
  watermark: string | null;
  defaultColor: string;
}): QuotePdfModel {
  const { invoice, labels, locale } = input;
  const vat = invoice.vatApplicable;
  const document = invoice.seller.document;
  const dueOn = formatCalendarDate(invoice.paymentDueOn, locale);
  const dates: QuotePdfModel["dates"] = [{ label: labels.dates.issuedOn, value: formatCalendarDate(invoice.issuedOn, locale) }];
  if (invoice.serviceDate) {
    dates.push({
      label: invoice.kind === "deposit" ? labels.dates.depositDate : labels.dates.serviceDate,
      value: formatCalendarDate(invoice.serviceDate, locale),
    });
  }
  dates.push({ label: labels.dates.dueOn, value: dueOn });

  const rows =
    invoice.kind === "balance"
      ? invoice.lines.map((line) => ({ cells: lineCells(line, vat, locale), description: line.description }))
      : [singleLine(labels.depositLine(invoice.depositLabel ?? "", invoice.quoteNumber), invoice.totals, vat, locale)];

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

  // DEV-11 : échéance, IBAN et BIC s'ils sont renseignés, référence du virement.
  const bank = bankLines(document, labels);
  const payment = {
    title: labels.paymentTitle,
    lines: [
      { label: bank.length > 0 ? labels.payBeforeByTransfer(dueOn) : labels.payBefore(dueOn), amount: null },
      ...bank,
      { label: labels.reference(invoice.number), amount: null },
    ],
  };

  return {
    language: locale,
    title: labels.invoiceTitle(invoice.number),
    kind: labels.invoiceKind,
    number: invoice.number,
    subtitle: invoice.kind === "deposit" ? (invoice.advanceKind === "earnest" ? labels.earnestInvoice : labels.depositInvoice) : labels.balanceInvoice,
    status: invoice.kind === "deposit" ? (invoice.advanceKind === "earnest" ? labels.earnestInvoice : labels.depositInvoice) : labels.balanceInvoice,
    appearance: appearanceOf(invoice.seller, input.defaultColor),
    logo: input.logo,
    seller: sellerBlock(invoice.seller, labels),
    client: buyersBlock(invoice.buyers, labels),
    dates,
    intro: document?.intro ?? null,
    columns: columnsFor(vat, labels),
    rows,
    totals,
    payment,
    legalMention: invoice.legalMention,
    terms: invoice.mentions,
    professional: [],
    generalTerms: null,
    footer: documentFooter(invoice.seller, labels, locale),
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
  defaultColor: string;
}): QuotePdfModel {
  const { creditNote, labels, locale, vatApplicable } = input;
  return {
    language: locale,
    title: labels.creditNoteTitle(creditNote.number),
    kind: labels.creditNoteKind,
    number: creditNote.number,
    subtitle: labels.creditNoteFor(creditNote.invoiceNumber),
    status: labels.creditNoteFor(creditNote.invoiceNumber),
    // L'avoir reprend l'instantané de sa facture, donc son apparence.
    appearance: appearanceOf(creditNote.seller, input.defaultColor),
    logo: input.logo,
    seller: sellerBlock(creditNote.seller, labels),
    client: buyersBlock(creditNote.buyers, labels),
    dates: [{ label: labels.dates.issuedOn, value: formatCalendarDate(creditNote.issuedOn, locale) }],
    intro: labels.reason(creditNote.reason),
    columns: columnsFor(vatApplicable, labels),
    rows: [singleLine(labels.creditNoteLine(creditNote.invoiceNumber), creditNote.totals, vatApplicable, locale)],
    totals: totalRows(creditNote.totals, vatApplicable, labels, locale),
    payment: null,
    legalMention: creditNote.legalMention,
    terms: null,
    professional: [],
    generalTerms: null,
    footer: documentFooter(creditNote.seller, labels, locale),
    watermark: input.watermark,
    signature: null,
  };
}
