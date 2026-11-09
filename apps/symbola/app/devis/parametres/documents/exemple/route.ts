// Lot 17 (DEV-09) — « Télécharger un exemple en PDF » : devis ou facture
// fictifs avec les réglages enregistrés de l'organisation, marqués
// « Exemple ». Rien n'est créé, aucun rang de numérotation n'est consommé.
// Contrôles côté serveur : session planner, organisation, module souscrit.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { starterDocumentStyle } from "@symbola/starter-templates";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { currentInvoiceSeller, currentQuoteSeller, getDocumentSettings } from "@/modules/quotes/service";
import type { Translate } from "../../../document-labels";
import { QuotePdfDocument } from "../../../[quoteId]/quote-pdf";
import { authorizedPlanner } from "../../../planner-access";
import { sampleDocumentModel } from "../sample";
import { sampleContextFor } from "../sample-context";

const typeSchema = z.enum(["devis", "facture"]);

export async function GET(request: Request): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const type = typeSchema.safeParse(new URL(request.url).searchParams.get("type"));
  if (!type.success) return new Response(null, { status: 404 });
  const { organizationId } = planner;
  const kind = type.data === "devis" ? "quote" : "invoice";

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  const seller = kind === "quote" ? await currentQuoteSeller(organizationId) : await currentInvoiceSeller(organizationId);
  // Facture : ses conditions de paiement sont figées à part (DEV-04) ; l'exemple
  // les reprend des réglages.
  const settings = kind === "invoice" ? await getDocumentSettings(organizationId) : null;
  const document = seller.document && settings ? { ...seller.document, terms: settings.invoiceTerms } : seller.document;

  const model = sampleDocumentModel({
    kind,
    seller: { ...seller, ...(document ? { document } : {}) },
    context: await sampleContextFor(organizationId),
    t: t as unknown as Translate,
    tQuotes: tQuotes as unknown as Translate,
    locale,
    defaultColor: starterDocumentStyle(locale).defaultColor,
    logo: await loadDocumentLogo(organizationId, seller.logoKey),
    watermark: t("sampleWatermark"),
  });
  const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${t(kind === "quote" ? "sampleFileQuote" : "sampleFileInvoice")}"`,
      "Cache-Control": "no-store",
    },
  });
}
