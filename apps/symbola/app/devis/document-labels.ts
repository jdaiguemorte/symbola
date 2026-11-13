// Lot 17 (DEV-12, ADR 0046) — libellés des PDF de devis, facture et avoir,
// tirés des fichiers de traduction. Partagés par le rendu PDF (serveur,
// getTranslations) et par l'aperçu de l'écran Documents (client,
// useTranslations) : les deux affichent les mêmes mots.
import type { LegalFormCode } from "@symbola/contracts";
import type { InvoicePdfLabels } from "./factures/invoice-pdf-model";
import type { DocumentCommonLabels, QuotePdfLabels } from "./[quoteId]/quote-pdf-model";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

const LEGAL_FORMS: LegalFormCode[] = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"];

// t : section « Documents » ; tQuotes : section « Quotes ».
export function documentCommonLabels(t: Translate, tQuotes: Translate): DocumentCommonLabels {
  return {
    sellerHeading: t("pdfSellerHeading"),
    clientHeading: t("pdfClientHeading"),
    legal: {
      soleTrader: t("pdfSoleTrader"),
      legalForms: Object.fromEntries(LEGAL_FORMS.map((form) => [form, t(`pdfLegalForm_${form}`)])) as Record<LegalFormCode, string>,
      capital: (form, amount) => t("pdfCapital", { form, amount }),
      siret: (siret) => t("pdfSiret", { siret }),
      siren: (siren) => t("pdfSiren", { siren }),
      vatNumber: (vatNumber) => t("pdfVatNumber", { vatNumber }),
    },
    // Gabarit complété page par page au rendu.
    page: t("pdfPage", { page: "{page}", total: "{total}" }),
    iban: (iban) => t("pdfIban", { iban }),
    bic: (bic) => t("pdfBic", { bic }),
    columns: {
      label: tQuotes("itemLabel"),
      quantity: tQuotes("quantity"),
      unitPrice: tQuotes("itemUnitPrice"),
      discount: tQuotes("lineDiscount"),
      vatRate: tQuotes("itemVatRate"),
      total: tQuotes("lineTotal"),
    },
    totalHt: tQuotes("totalHt"),
    vatAtRate: (rate) => tQuotes("vatAtRate", { rate }),
    totalTtc: tQuotes("totalTtc"),
  };
}

export function quotePdfLabels(t: Translate, tQuotes: Translate): QuotePdfLabels {
  return {
    ...documentCommonLabels(t, tQuotes),
    title: (number, version) => tQuotes("pdfTitle", { number, version }),
    kind: t("pdfQuoteKind"),
    version: (version) => t("pdfQuoteVersion", { version }),
    draft: tQuotes("pdfDraft"),
    dates: { issuedOn: t("pdfQuoteIssuedOn"), validUntil: t("pdfValidUntil"), eventDate: t("pdfEventDate") },
    scheduleTitle: t("pdfScheduleTitle"),
    paymentTitle: t("pdfPaymentTitle"),
    scheduleLine: (label, date) => t("pdfScheduleLine", { label, date }),
    balance: t("pdfBalance"),
    subtotal: tQuotes("subtotal"),
    globalDiscount: tQuotes("globalDiscount"),
    signatureTitle: tQuotes("pdfSignatureTitle"),
    // Lot 31a (FAC-01, JUR-08, JUR-09).
    sectionSubtotal: (title) => tQuotes("sectionSubtotal", { title }),
    optionChosen: tQuotes("pdfOptionChosen"),
    optionNotChosen: tQuotes("pdfOptionNotChosen"),
    scheduleTitleEarnest: t("pdfScheduleTitleEarnest"),
    scheduleTitleDeposit: t("pdfScheduleTitleDeposit"),
    insurance: (insurer, policy, coverage) => (coverage ? t("pdfInsuranceCoverage", { insurer, policy, coverage }) : t("pdfInsurance", { insurer, policy })),
    mediator: (name, url) => t("pdfMediator", { name, url }),
    generalTermsTitle: t("pdfGeneralTermsTitle"),
  };
}

export function invoicePdfLabels(t: Translate, tQuotes: Translate): InvoicePdfLabels {
  return {
    ...documentCommonLabels(t, tQuotes),
    invoiceTitle: (number) => tQuotes("pdfInvoiceTitle", { number }),
    invoiceKind: t("pdfInvoiceKind"),
    creditNoteKind: t("pdfCreditNoteKind"),
    depositInvoice: tQuotes("invoiceKindDeposit"),
    earnestInvoice: tQuotes("invoiceKindEarnest"),
    balanceInvoice: tQuotes("invoiceKindBalance"),
    creditNoteTitle: (number) => tQuotes("pdfCreditNoteTitle", { number }),
    creditNoteFor: (number) => tQuotes("pdfCreditNoteFor", { number }),
    reason: (reason) => tQuotes("pdfReason", { reason }),
    dates: { issuedOn: t("pdfInvoiceIssuedOn"), serviceDate: t("pdfServiceDate"), depositDate: t("pdfDepositDate"), dueOn: t("pdfDueOn") },
    paymentTitle: t("pdfPaymentTitle"),
    payBefore: (date) => t("pdfPayBefore", { date }),
    payBeforeByTransfer: (date) => t("pdfPayBeforeByTransfer", { date }),
    reference: (number) => t("pdfReference", { number }),
    depositLine: (label, quoteNumber) => tQuotes("pdfDepositLine", { label, number: quoteNumber }),
    creditNoteLine: (number) => tQuotes("pdfCreditNoteLine", { number }),
    quoteTotalTtc: tQuotes("pdfQuoteTotalTtc"),
    deduction: (number) => tQuotes("pdfDeduction", { number }),
    amountDue: tQuotes("pdfAmountDue"),
  };
}
