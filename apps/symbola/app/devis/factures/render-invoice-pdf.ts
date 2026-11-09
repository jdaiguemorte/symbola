// DEV-04 — rendu des PDF de facture et d'avoir, à la demande, depuis la
// copie figée à l'émission. L'appelant a déjà vérifié session et organisation.
// Lot 17 (ADR 0046) : apparence, textes et IBAN viennent aussi de la copie.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { starterDocumentStyle } from "@symbola/starter-templates";
import type { CreditNoteView, InvoiceView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { invoicePdfLabels, type Translate } from "../document-labels";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { buildCreditNotePdfModel, buildInvoicePdfModel, type InvoicePdfLabels } from "./invoice-pdf-model";

async function context(): Promise<{ locale: Locale; labels: InvoicePdfLabels; watermark: string; defaultColor: string }> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  return {
    locale,
    watermark: tQuotes("demoWatermark"),
    defaultColor: starterDocumentStyle(locale).defaultColor,
    labels: invoicePdfLabels(t as unknown as Translate, tQuotes as unknown as Translate),
  };
}

function toBuffer(model: Parameters<typeof QuotePdfDocument>[0]["model"]): Promise<Buffer> {
  return renderToBuffer(createElement(QuotePdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
}

export async function renderInvoicePdf(organizationId: string, invoice: InvoiceView): Promise<Buffer> {
  const { locale, labels, watermark, defaultColor } = await context();
  return toBuffer(
    buildInvoicePdfModel({
      invoice,
      labels,
      locale,
      defaultColor,
      logo: await loadDocumentLogo(organizationId, invoice.seller.logoKey),
      watermark: invoice.isDemo ? watermark : null,
    }),
  );
}

export async function renderCreditNotePdf(organizationId: string, creditNote: CreditNoteView, vatApplicable: boolean): Promise<Buffer> {
  const { locale, labels, watermark, defaultColor } = await context();
  return toBuffer(
    buildCreditNotePdfModel({
      creditNote,
      vatApplicable,
      labels,
      locale,
      defaultColor,
      logo: await loadDocumentLogo(organizationId, creditNote.seller.logoKey),
      watermark: creditNote.isDemo ? watermark : null,
    }),
  );
}
