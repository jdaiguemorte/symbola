// Lot 17 (DEV-12, ADR 0046) — libellés des PDF de devis, facture et avoir,
// tirés des fichiers de traduction. Partagés par le rendu PDF (serveur,
// getTranslations) et par l'aperçu de l'écran Documents (client,
// useTranslations) : les deux affichent les mêmes mots.
import type { LegalFormCode } from "@symbola/contracts";
import type { InvoicePdfLabels } from "./factures/invoice-pdf-model";
import type { DocumentCommonLabels, QuotePdfLabels } from "./[quoteId]/quote-pdf-model";
import type { ContractPdfLabels, EvidencePdfLabels } from "./[quoteId]/contract-pdf-model";
import type { ReceiptPdfLabels } from "./recus/receipt-pdf-model";

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
    // Lot 31c (FAC-05, D20, D21).
    quoteTotalHt: tQuotes("pdfQuoteTotalHt"),
    quoteVatAtRate: (rate) => tQuotes("pdfQuoteVatAtRate", { rate }),
    deductionHt: (number) => tQuotes("pdfDeductionHt", { number }),
    deductionVatAtRate: (number, rate) => tQuotes("pdfDeductionVatAtRate", { number, rate }),
    balanceHt: tQuotes("pdfBalanceHt"),
    balanceVatAtRate: (rate) => tQuotes("pdfBalanceVatAtRate", { rate }),
    earnestSettlement: (date, label) => tQuotes("pdfEarnestSettlement", { date, label }),
  };
}

// Lot 31c (JUR-08, D21) — reçu d'arrhes, non fiscal. t : section « Documents » ; tQuotes : « Quotes ».
export function receiptPdfLabels(t: Translate, tQuotes: Translate): ReceiptPdfLabels {
  return {
    ...documentCommonLabels(t, tQuotes),
    title: (number) => tQuotes("pdfReceiptTitle", { number }),
    kind: t("pdfReceiptKind"),
    notInvoice: tQuotes("pdfReceiptNotInvoice"),
    dates: { issuedOn: tQuotes("pdfReceiptIssuedOn"), paidOn: tQuotes("pdfReceiptPaidOn") },
    line: (label, quoteNumber) => tQuotes("pdfReceiptLine", { label, number: quoteNumber }),
    amount: tQuotes("pdfReceiptAmount"),
    paymentTitle: t("pdfPaymentTitle"),
    method: (method) => tQuotes("pdfReceiptMethod", { method }),
    mention: tQuotes("pdfReceiptMention"),
    cancelled: tQuotes("pdfReceiptCancelled"),
  };
}

// Lot 31b (FAC-04, DOC-03 ; D9, D11, partie N) — contrat et dossier de preuve. t : section
// « Contracts » ; tDocuments : section « Documents » (numéro de page).
const CHANNELS = ["on_premises", "distance", "off_premises", "fair"] as const;
const CATEGORIES = ["individual", "non_professional", "professional"] as const;

export function contractPdfLabels(t: Translate, tDocuments: Translate): ContractPdfLabels {
  return {
    // Lot 31c (D19) : « EI » après le nom d'un entrepreneur individuel.
    legal: {
      soleTrader: tDocuments("pdfSoleTrader"),
      legalForms: Object.fromEntries(LEGAL_FORMS.map((form) => [form, tDocuments(`pdfLegalForm_${form}`)])) as Record<LegalFormCode, string>,
    },
    kind: t("pdfKind"),
    subtitle: (contractVersion, quoteNumber, quoteVersion) => t("pdfSubtitle", { version: contractVersion, number: quoteNumber, quoteVersion }),
    article: (index, title) => t("pdfArticle", { index, title }),
    regimeTitle: t("pdfRegimeTitle"),
    channel: Object.fromEntries(CHANNELS.map((channel) => [channel, t(`pdfChannel_${channel}`)])) as ContractPdfLabels["channel"],
    category: Object.fromEntries(CATEGORIES.map((category) => [category, t(`pdfCategory_${category}`)])) as ContractPdfLabels["category"],
    withdrawalApplies: (days) => t("pdfWithdrawalApplies", { days }),
    withdrawalNotApplies: t("pdfWithdrawalNotApplies"),
    noPaymentBefore: (days) => t("pdfNoPaymentBefore", { days }),
    templateInfo: (version, reviewedOn) => (reviewedOn ? t("pdfTemplateReviewed", { version, date: reviewedOn }) : t("pdfTemplateNotReviewed", { version })),
    signatureTitleWithQuote: t("pdfSignatureWithQuote"),
    signatureTitle: t("pdfSignature"),
    page: tDocuments("pdfPage", { page: "{page}", total: "{total}" }),
  };
}

export function evidencePdfLabels(t: Translate): EvidencePdfLabels {
  const contract = contractPdfLabels(t, () => "");
  return {
    title: t("evidenceTitle"),
    intro: t("evidenceIntro"),
    sections: {
      contract: t("evidenceSectionContract"),
      signature: t("evidenceSectionSignature"),
      signers: t("evidenceSectionSigners"),
      acts: t("evidenceSectionActs"),
      fingerprints: t("evidenceSectionFingerprints"),
    },
    field: (label, value) => t("evidenceField", { label, value }),
    names: {
      quote: t("evidenceQuote"),
      contract: t("evidenceContract"),
      template: t("evidenceTemplate"),
      channel: t("evidenceChannel"),
      category: t("evidenceCategory"),
      withdrawal: t("evidenceWithdrawal"),
      level: t("evidenceLevel"),
      generatedAt: t("evidenceGeneratedAt"),
      provider: t("evidenceProvider"),
      requestedAt: t("evidenceRequestedAt"),
      completedAt: t("evidenceCompletedAt"),
      signedDocument: t("evidenceSignedDocument"),
      certificate: t("evidenceCertificate"),
      evidence: t("evidenceSelf"),
      writtenAt: t("evidenceWrittenAt"),
    },
    channel: contract.channel,
    category: contract.category,
    yes: t("evidenceWithdrawalYes"),
    no: t("evidenceWithdrawalNo"),
    act: { order: t("actOrder"), early_execution: t("actEarlyExecution") },
    signer: (name, email, signedAt) => (signedAt ? t("evidenceSignerSigned", { name, email, date: signedAt }) : t("evidenceSigner", { name, email })),
    actLine: (name, kind, at) => t("evidenceActLine", { name, kind, date: at }),
    presented: (text) => t("evidencePresented", { text }),
  };
}
