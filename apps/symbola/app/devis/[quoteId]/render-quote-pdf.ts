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
import { starterDocumentStyle, starterLatePenalty } from "@symbola/starter-templates";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getContactsByIds, getOrganizationProfile } from "@/modules/hub/service";
import { currentQuoteSeller, type QuoteDetail, type QuoteVersionView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { quotePdfLabels, type Translate } from "../document-labels";
import { QuotePdfDocument } from "./quote-pdf";
import { buildQuotePdfModel, type QuotePdfModel } from "./quote-pdf-model";

export async function renderQuotePdf(input: {
  organizationId: string;
  quote: QuoteDetail;
  version: QuoteVersionView;
  signatureSlots?: { role: string; tag: string }[];
}): Promise<Buffer> {
  const element = createElement(QuotePdfDocument, { model: pdfSafe(await quotePdfModelFor(input)) }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

// Lot 31b (D9) : le modèle seul, pour le PDF qui fait suivre le devis de son contrat.
export async function quotePdfModelFor(input: {
  organizationId: string;
  quote: QuoteDetail;
  version: QuoteVersionView;
  signatureSlots?: { role: string; tag: string }[];
}): Promise<QuotePdfModel> {
  const { organizationId, quote, version } = input;
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  // Lot 31c (D18) : le brouillon d'un professionnel montre ses conditions de paiement.
  const draftSeller = await currentQuoteSeller(organizationId, quote.clientKind);
  const event = await getEvent(organizationId, quote.eventId);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  const seller = version.sentAt && version.seller ? version.seller : draftSeller;
  // Lot 36b (CRM-03, SC-11) : un client entreprise montre ses identifiants sous son nom.
  const clientContacts = await getContactsByIds(organizationId, (event?.clients ?? []).map((client) => client.contactId).filter((id): id is string => id !== null));
  const clientDetails = [...clientContacts.values()]
    .filter((contact) => contact.kind === "company" && !contact.anonymized)
    .flatMap((contact) => [
      ...(contact.companyIdNumber ? [contact.companyIdNumber.length === 14 ? t("pdfSiret", { siret: contact.companyIdNumber }) : t("pdfSiren", { siren: contact.companyIdNumber })] : []),
      ...(contact.vatNumber ? [t("pdfVatNumber", { vatNumber: contact.vatNumber })] : []),
    ]);

  const model = buildQuotePdfModel({
    quote,
    version,
    draftSeller,
    draftLegalMention: computeLegalMention(profile) || null,
    clientNames: event?.clients.map((client) => client.firstName).join(" & ") || tQuotes("noClient"),
    clientDetails,
    eventDate: event?.eventDate ?? null,
    logo: await loadDocumentLogo(organizationId, seller.logoKey),
    locale,
    watermark: quote.isDemo ? tQuotes("demoWatermark") : null,
    defaultColor: starterDocumentStyle(locale).defaultColor,
    ...(input.signatureSlots ? { signatureSlots: input.signatureSlots } : {}),
    latePenalty: starterLatePenalty(),
    labels: quotePdfLabels(t as unknown as Translate, tQuotes as unknown as Translate),
  });
  return model;
}
