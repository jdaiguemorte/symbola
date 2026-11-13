// Lot 31c (JUR-08 ; réponse 7 bis de l'expert-comptable, décision D21) — contenu du PDF d'un reçu
// d'arrhes, depuis sa copie figée : non fiscal (il le dit, sous le titre), de sa propre série ;
// vendeur (« EI » compris) et clients figés à l'encaissement, date et montant reçus, mode de
// paiement ; un encaissement annulé est marqué, le reçu reste. Même mise en page que les factures.
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { ReceiptView } from "@/modules/quotes/service";
import {
  appearanceOf,
  columnsFor,
  documentFooter,
  sellerBlock,
  type DocumentCommonLabels,
  type QuotePdfLogo,
  type QuotePdfModel,
} from "../[quoteId]/quote-pdf-model";

export type ReceiptPdfLabels = DocumentCommonLabels & {
  title: (number: string) => string;
  kind: string;
  notInvoice: string;
  dates: { issuedOn: string; paidOn: string };
  line: (label: string, quoteNumber: string) => string;
  amount: string;
  paymentTitle: string;
  method: (method: string) => string;
  mention: string;
  cancelled: string;
};

export function buildReceiptPdfModel(input: {
  receipt: ReceiptView;
  labels: ReceiptPdfLabels;
  locale: Locale;
  logo: QuotePdfLogo | null;
  watermark: string | null;
  defaultColor: string;
}): QuotePdfModel {
  const { receipt, labels, locale } = input;
  const amount = formatAmount(receipt.amountCents, locale);
  return {
    language: locale,
    title: labels.title(receipt.number),
    kind: labels.kind,
    number: receipt.number,
    subtitle: labels.notInvoice,
    status: receipt.cancelled ? labels.cancelled : null,
    appearance: appearanceOf(receipt.seller, input.defaultColor),
    logo: input.logo,
    seller: sellerBlock(receipt.seller, labels),
    client: { heading: labels.clientHeading, lines: receipt.buyers.flatMap((buyer) => [buyer.name, buyer.billingAddress]).filter(Boolean) },
    dates: [
      { label: labels.dates.issuedOn, value: formatCalendarDate(receipt.issuedOn, locale) },
      { label: labels.dates.paidOn, value: formatCalendarDate(receipt.paidOn, locale) },
    ],
    intro: null,
    // Les arrhes sont hors TVA tant qu'elles ne sont pas imputées sur le prix : aucune colonne de taux.
    columns: columnsFor(false, labels),
    rows: [{ cells: [labels.line(receipt.label, receipt.quoteNumber), "1", amount, "—", amount], description: null }],
    totals: [{ label: labels.amount, value: amount, strong: true }],
    payment: receipt.paymentMethodLabel ? { title: labels.paymentTitle, lines: [{ label: labels.method(receipt.paymentMethodLabel), amount: null }] } : null,
    legalMention: labels.mention,
    terms: null,
    professional: [],
    generalTerms: null,
    footer: documentFooter(receipt.seller, labels, locale),
    watermark: input.watermark,
    signature: null,
  };
}
