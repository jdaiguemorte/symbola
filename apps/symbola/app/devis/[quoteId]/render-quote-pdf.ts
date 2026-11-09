// DEV-01/02 — production du PDF A4 d'une version de devis, partagée entre
// le téléchargement (route pdf) et l'envoi en signature (avec un bloc
// « Bon pour accord » portant une balise par signataire). L'appelant a déjà
// vérifié la session et l'organisation. Lot 17 (ADR 0046) : un brouillon
// prend le vendeur et l'apparence courants, un devis envoyé sa copie figée.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { starterDocumentStyle } from "@symbola/starter-templates";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getOrganizationProfile } from "@/modules/hub/service";
import { currentQuoteSeller, type QuoteDetail, type QuoteVersionView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { quotePdfLabels, type Translate } from "../document-labels";
import { QuotePdfDocument } from "./quote-pdf";
import { buildQuotePdfModel } from "./quote-pdf-model";

export async function renderQuotePdf(input: {
  organizationId: string;
  quote: QuoteDetail;
  version: QuoteVersionView;
  signatureSlots?: { role: string; tag: string }[];
}): Promise<Buffer> {
  const { organizationId, quote, version } = input;
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  const draftSeller = await currentQuoteSeller(organizationId);
  const event = await getEvent(organizationId, quote.eventId);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  const seller = version.sentAt && version.seller ? version.seller : draftSeller;

  const model = buildQuotePdfModel({
    quote,
    version,
    draftSeller,
    draftLegalMention: computeLegalMention(profile) || null,
    clientNames: event?.clients.map((client) => client.firstName).join(" & ") || tQuotes("noClient"),
    eventDate: event?.eventDate ?? null,
    logo: await loadDocumentLogo(organizationId, seller.logoKey),
    locale,
    watermark: quote.isDemo ? tQuotes("demoWatermark") : null,
    defaultColor: starterDocumentStyle(locale).defaultColor,
    ...(input.signatureSlots ? { signatureSlots: input.signatureSlots } : {}),
    labels: quotePdfLabels(t as unknown as Translate, tQuotes as unknown as Translate),
  });

  const element = createElement(QuotePdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
