// DEV-01/02 — production du PDF A4 d'une version de devis, partagée entre
// le téléchargement (route pdf) et l'envoi en signature (avec un bloc
// « Bon pour accord » portant une balise par signataire). L'appelant a déjà
// vérifié la session et l'organisation.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getDocumentHeader, getOrganizationProfile } from "@/modules/hub/service";
import type { QuoteDetail, QuoteVersionView } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { QuotePdfDocument } from "./quote-pdf";
import { buildQuotePdfModel } from "./quote-pdf-model";

export async function renderQuotePdf(input: {
  organizationId: string;
  quote: QuoteDetail;
  version: QuoteVersionView;
  signatureSlots?: { role: string; tag: string }[];
}): Promise<Buffer> {
  const { organizationId, quote, version } = input;
  const { sql, db } = createAppConnection();
  let header;
  let profile;
  try {
    header = await getDocumentHeader(db, organizationId);
    profile = await getOrganizationProfile(db, organizationId);
  } finally {
    await sql.end();
  }
  const event = await getEvent(organizationId, quote.eventId);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Quotes");
  const logoKey = version.sentAt && version.seller ? version.seller.logoKey : profile.logoKey;

  const model = buildQuotePdfModel({
    quote,
    version,
    draftSeller: {
      organizationName: header?.organizationName ?? "",
      address: profile.address,
      siren: profile.siren,
      logoKey: profile.logoKey,
    },
    draftLegalMention: computeLegalMention(profile) || null,
    clientNames: event?.clients.map((client) => client.firstName).join(" & ") || t("noClient"),
    logo: await loadDocumentLogo(organizationId, logoKey),
    locale,
    watermark: quote.isDemo ? t("demoWatermark") : null,
    ...(input.signatureSlots ? { signatureSlots: input.signatureSlots } : {}),
    labels: {
      title: (number, versionNumber) => t("pdfTitle", { number, version: versionNumber }),
      draft: t("pdfDraft"),
      issuedOn: (date) => t("pdfIssuedOn", { date }),
      validUntil: (date) => t("validUntil", { date }),
      siren: (siren) => t("pdfSiren", { siren }),
      client: (names) => t("pdfClient", { names }),
      columns: {
        label: t("itemLabel"),
        quantity: t("quantity"),
        unitPrice: t("itemUnitPrice"),
        discount: t("lineDiscount"),
        vatRate: t("itemVatRate"),
        total: t("lineTotal"),
      },
      subtotal: t("subtotal"),
      globalDiscount: t("globalDiscount"),
      totalHt: t("totalHt"),
      vatAtRate: (rate) => t("vatAtRate", { rate }),
      totalTtc: t("totalTtc"),
      signatureTitle: t("pdfSignatureTitle"),
    },
  });

  const element = createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
