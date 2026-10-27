// DEV-01 — PDF A4 d'une version de devis (courante ou ancienne : les
// versions précédentes restent téléchargeables). Contrôles côté serveur :
// session planner, organisation, module souscrit, identifiants valides.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getDocumentHeader, getOrganizationProfile } from "@/modules/hub/service";
import { getQuote, QuoteNotFoundError, type QuoteDetail } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { isValidId } from "../../module-access";
import { authorizedPlanner } from "../../planner-access";
import { QuotePdfDocument } from "../quote-pdf";
import { buildQuotePdfModel } from "../quote-pdf-model";

const versionSchema = z.coerce.number().int().min(1).max(10_000);

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { organizationId } = planner;

  const { quoteId } = await params;
  const requested = versionSchema.safeParse(new URL(request.url).searchParams.get("version"));
  if (!isValidId(quoteId) || !requested.success) return new Response(null, { status: 404 });

  let quote: QuoteDetail;
  try {
    quote = await getQuote(organizationId, quoteId);
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const version = quote.versions.find((candidate) => candidate.version === requested.data);
  if (!version) return new Response(null, { status: 404 });

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
    },
  });

  const element = createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.number}-V${version.version}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
