// Lot 41 (FAC-10, JUR-02, JUR-12) — textes du fichier structuré, dans la langue de la pièce : les
// libellés viennent des fichiers de traduction, les mentions réglementaires des données
// (packages/starter-templates), jamais du code. Mêmes phrases que le PDF.
import { createTranslator } from "next-intl";
import { formatAmount } from "@symbola/i18n";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { starterInvoiceReform, starterLatePenalty } from "@symbola/starter-templates";
import type { CreditNoteView, InvoiceReform, InvoiceView } from "@symbola/contracts";
import { latePenaltySentence } from "../payment-terms";
import type { FacturXTexts } from "./document";

export type DocumentLocale = "fr" | "en";

function translators(locale: DocumentLocale) {
  const messages = locale === "en" ? enMessages : frMessages;
  return {
    quotes: createTranslator({ locale, messages, namespace: "Quotes" }),
    documents: createTranslator({ locale, messages, namespace: "Documents" }),
  };
}

// Délai d'un professionnel, imprimé et porté dans le fichier (JUR-12).
export function professionalDelayText(terms: NonNullable<InvoiceReform["professionalTerms"]>, locale: DocumentLocale): string {
  const { documents } = translators(locale);
  return terms.endOfMonth ? documents("pdfPaymentTermEndOfMonth", { days: terms.paymentTermDays }) : documents("pdfPaymentTermDays", { days: terms.paymentTermDays });
}

export function discountTermsText(terms: NonNullable<InvoiceReform["professionalTerms"]>, locale: DocumentLocale): string {
  return translators(locale).documents("pdfDiscountTerms", { terms: terms.discountTerms });
}

function recoverySentence(locale: DocumentLocale): string | null {
  const data = starterLatePenalty();
  return data.recoverySentence ? data.recoverySentence[locale].replace("{indemnite}", formatAmount(data.recoveryIndemnityCents, locale)) : null;
}

function common(reform: InvoiceReform | null, legalMention: string | null, locale: DocumentLocale) {
  const { quotes, documents } = translators(locale);
  const terms = reform?.professionalTerms ?? null;
  return {
    depositLine: (label: string, number: string) => quotes("pdfDepositLine", { label, number }),
    deductionLine: (number: string) => quotes("pdfDeduction", { number }),
    creditNoteLine: (number: string) => quotes("pdfCreditNoteLine", { number }),
    globalDiscount: quotes("globalDiscount"),
    lineDiscount: documents("facturxLineDiscount"),
    penalties: terms?.latePenaltyRate ? latePenaltySentence(terms.latePenaltyRate, starterLatePenalty(), locale) : null,
    recovery: terms ? recoverySentence(locale) : null,
    discount: terms ? discountTermsText(terms, locale) : null,
    vatOnDebits: reform?.vatOnDebits ? starterInvoiceReform().vatOnDebitsMention[locale] : null,
    franchiseReason: legalMention ?? documents("facturxFranchiseReason"),
  };
}

export function invoiceFacturXTexts(invoice: InvoiceView, locale: DocumentLocale): FacturXTexts {
  const terms = invoice.reform?.professionalTerms ?? null;
  const paymentTerms = [terms ? professionalDelayText(terms, locale) : null, invoice.mentions].filter((part): part is string => Boolean(part?.trim())).join("\n");
  return { ...common(invoice.reform, invoice.legalMention, locale), paymentTerms: paymentTerms || null };
}

export function creditNoteFacturXTexts(creditNote: CreditNoteView, locale: DocumentLocale): FacturXTexts {
  return { ...common(creditNote.reform, creditNote.legalMention, locale), paymentTerms: null, penalties: null, recovery: null, discount: null };
}
