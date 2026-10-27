// DEV-04 — rendu des PDF de facture et d'avoir, à la demande, depuis la
// copie figée à l'émission. L'appelant a déjà vérifié session et organisation.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import type { CreditNoteView, InvoiceView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { buildCreditNotePdfModel, buildInvoicePdfModel, type InvoicePdfLabels } from "./invoice-pdf-model";

async function labels(): Promise<{ locale: Locale; labels: InvoicePdfLabels; watermark: string }> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Quotes");
  return {
    locale,
    watermark: t("demoWatermark"),
    labels: {
      invoiceTitle: (number) => t("pdfInvoiceTitle", { number }),
      depositInvoice: t("invoiceKindDeposit"),
      balanceInvoice: t("invoiceKindBalance"),
      creditNoteTitle: (number) => t("pdfCreditNoteTitle", { number }),
      creditNoteFor: (number) => t("pdfCreditNoteFor", { number }),
      reason: (reason) => t("pdfReason", { reason }),
      issuedOn: (date) => t("pdfIssuedOn", { date }),
      serviceDate: (date) => t("pdfServiceDate", { date }),
      depositDate: (date) => t("pdfDepositDate", { date }),
      dueOn: (date) => t("pdfDueOn", { date }),
      siren: (siren) => t("pdfSiren", { siren }),
      buyers: (lines) => t("pdfBuyers", { lines }),
      depositLine: (label, quoteNumber) => t("pdfDepositLine", { label, number: quoteNumber }),
      creditNoteLine: (number) => t("pdfCreditNoteLine", { number }),
      columns: {
        label: t("itemLabel"),
        quantity: t("quantity"),
        unitPrice: t("itemUnitPrice"),
        discount: t("lineDiscount"),
        vatRate: t("itemVatRate"),
        total: t("lineTotal"),
      },
      totalHt: t("totalHt"),
      vatAtRate: (rate) => t("vatAtRate", { rate }),
      totalTtc: t("totalTtc"),
      quoteTotalTtc: t("pdfQuoteTotalTtc"),
      deduction: (number) => t("pdfDeduction", { number }),
      amountDue: t("pdfAmountDue"),
    },
  };
}

function toBuffer(model: Parameters<typeof QuotePdfDocument>[0]["model"]): Promise<Buffer> {
  return renderToBuffer(createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
}

export async function renderInvoicePdf(organizationId: string, invoice: InvoiceView): Promise<Buffer> {
  const { locale, labels: text, watermark } = await labels();
  return toBuffer(
    buildInvoicePdfModel({
      invoice,
      labels: text,
      locale,
      logo: await loadDocumentLogo(organizationId, invoice.seller.logoKey),
      watermark: invoice.isDemo ? watermark : null,
    }),
  );
}

export async function renderCreditNotePdf(organizationId: string, creditNote: CreditNoteView, vatApplicable: boolean): Promise<Buffer> {
  const { locale, labels: text, watermark } = await labels();
  return toBuffer(
    buildCreditNotePdfModel({
      creditNote,
      vatApplicable,
      labels: text,
      locale,
      logo: await loadDocumentLogo(organizationId, creditNote.seller.logoKey),
      watermark: creditNote.isDemo ? watermark : null,
    }),
  );
}
