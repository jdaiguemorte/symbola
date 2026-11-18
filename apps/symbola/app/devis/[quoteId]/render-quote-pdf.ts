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
import { clientTermForEvent, getEvent } from "@/modules/events/service";

import { computeLegalMention, getContactsByIds, getOrganizationProfile } from "@/modules/hub/service";
import { currentQuoteSeller, operationCategory, type QuoteDetail, type QuoteVersionView } from "@/modules/quotes/service";
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
  // Lot 43 (FAC-02) : le PDF de la proposition s'ouvre sur le mot d'accueil figé de la version.
  greeting?: string | null;
}): Promise<Buffer> {
  const model = await quotePdfModelFor(input);
  const withGreeting = input.greeting ? { ...model, intro: [input.greeting, model.intro].filter(Boolean).join("\n\n") } : model;
  const element = createElement(QuotePdfDocument, { model: pdfSafe(withGreeting) }) as unknown as ReactElement<DocumentProps>;
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

  // Lot 41 (JUR-02, D6) : l'acheteur entreprise désigné, avec son SIREN, sa TVA et son adresse.
  const buyerContact = quote.buyer.buyerContactId ? (await getContactsByIds(organizationId, [quote.buyer.buyerContactId])).get(quote.buyer.buyerContactId) : undefined;
  const buyerLines =
    buyerContact && buyerContact.kind === "company" && !buyerContact.anonymized
      ? [
          buyerContact.displayName,
          [buyerContact.addressLine, [buyerContact.postalCode, buyerContact.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          ...(buyerContact.companyIdNumber ? [buyerContact.companyIdNumber.length === 14 ? t("pdfSiret", { siret: buyerContact.companyIdNumber }) : t("pdfSiren", { siren: buyerContact.companyIdNumber })] : []),
          ...(buyerContact.vatNumber ? [t("pdfVatNumber", { vatNumber: buyerContact.vatNumber })] : []),
        ].filter(Boolean)
      : null;
  const included = version.lines.filter((line) => !line.isOption || line.optionChosen);
  // Lot 53 (HUB-24, D8) : le terme des clients titre le bloc du client — celui figé à l'envoi pour un
  // devis envoyé (un document émis garde son texte), le terme réglé pour un brouillon.
  const labels = quotePdfLabels(t as unknown as Translate, tQuotes as unknown as Translate);
  const term = version.sentAt ? (version.seller?.clientTerm?.[locale === "en" ? "en" : "fr"] ?? null) : await currentClientTerm(organizationId, quote.eventId, locale === "en" ? "en" : "fr");
  const clientHeading = term ? term.charAt(0).toLocaleUpperCase(locale) + term.slice(1) : null;

  const model = buildQuotePdfModel({
    buyerLines,
    category: operationCategory(included.map((line) => line.nature)),
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
    labels: { ...labels, clientHeading: clientHeading ?? labels.clientHeading },
  });
  return model;
}

async function currentClientTerm(organizationId: string, eventId: string, locale: "fr" | "en"): Promise<string | null> {
  const term = await clientTermForEvent(organizationId, eventId, locale);
  return term.custom ? term.term : null;
}
