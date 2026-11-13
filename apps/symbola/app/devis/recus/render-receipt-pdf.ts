// Lot 31c (JUR-08, D21) — rendu du PDF d'un reçu d'arrhes, à la demande, depuis sa copie figée.
// L'appelant a déjà vérifié la session et l'organisation. Le reçu n'est pas une pièce comptable :
// pas d'original déposé, il se rend à chaque téléchargement.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { starterDocumentStyle } from "@symbola/starter-templates";
import type { ReceiptView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { receiptPdfLabels, type Translate } from "../document-labels";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { buildReceiptPdfModel } from "./receipt-pdf-model";

export async function renderReceiptPdf(organizationId: string, receipt: ReceiptView): Promise<Buffer> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  const model = buildReceiptPdfModel({
    receipt,
    labels: receiptPdfLabels(t as unknown as Translate, tQuotes as unknown as Translate),
    locale,
    logo: await loadDocumentLogo(organizationId, receipt.seller.logoKey),
    watermark: receipt.isDemo ? tQuotes("demoWatermark") : null,
    defaultColor: starterDocumentStyle(locale).defaultColor,
  });
  return renderToBuffer(createElement(QuotePdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
}
