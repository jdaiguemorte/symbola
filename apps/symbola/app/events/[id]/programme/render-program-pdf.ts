// PRD-EVT-05/06 — production du PDF du programme, partagée entre la fiche de
// la planner (deux variantes) et l'espace du marié (variante « mariés »
// seulement). L'appelant a déjà vérifié la session et l'accès.
// Lot 37b (CHR-07, DAT-14 ; D8, D9, D10) : une version diffusée se rend avec son numéro (clients,
// liste des versions de la fiche) ; le prestataire reçoit sa vue de la version diffusée.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import type { EventProgram, ProgramVariant, PublishedProgramItem, VendorProgramView } from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { ProgramPdfDocument } from "./program-pdf";
import { loadDocumentLogo } from "@/lib/document-logo";
import { buildProgramPdfModel, publishedPdfProgram, vendorPdfProgram } from "./program-pdf-model";
import { pdfSafe } from "@/lib/pdf-text";
import { programSpanWords } from "@/lib/program-span-words";

// Ce que le PDF dit de l'évènement : prénoms des clients, date, essai.
type PdfEvent = { clients: { firstName: string }[]; eventDate: string | null; isDemo: boolean };

type PdfVersion = { number: number; publishedAt: string };

type Translate = Awaited<ReturnType<typeof getTranslations>>;

async function renderPdf(input: {
  organizationId: string;
  event: PdfEvent;
  program: EventProgram;
  variant: ProgramVariant;
  variantLabel: (t: Translate) => string;
  participantsLabel?: (t: Translate) => string;
  version?: PdfVersion;
  filename: (t: Translate) => string;
  disposition: "inline" | "attachment";
}): Promise<Response> {
  const db = appDatabase();
  const header = await getDocumentHeader(db, input.organizationId);

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Events");
  const names = input.event.clients.map((client) => client.firstName).join(" & ") || t("noClient");
  const heading = input.event.eventDate ? `${names} — ${formatCalendarDate(input.event.eventDate, locale)}` : names;
  const version = input.version;

  const model = buildProgramPdfModel({
    program: input.program,
    variant: input.variant,
    locale,
    heading,
    organizationName: header?.organizationName ?? "",
    logo: await loadDocumentLogo(input.organizationId, header?.logoKey ?? null),
    watermark: input.event.isDemo ? t("demoWatermark") : null,
    ...(version ? { versionLabel: t("programPdfPublishedVersion", { number: version.number, date: formatDateTime(new Date(version.publishedAt), locale) }) } : {}),
    labels: {
      title: t("programTitle"),
      variant: input.variantLabel(t),
      version: (date) => t("programPdfVersion", { date }),
      time: t("programTime"),
      item: t("programItemLabel"),
      location: t("programLocation"),
      participants: input.participantsLabel ? input.participantsLabel(t) : t("programParticipants"),
      note: t("programInternalNote"),
      empty: t("noProgramItems"),
      words: await programSpanWords(),
      responsible: (name) => t("programResponsibleLine", { name }),
    },
  });

  const element = createElement(ProgramPdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${input.disposition}; filename="${input.filename(t)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// Le programme en cours (fiche de la planner, écran du jour J) : « mariés » sans note interne, ou
// « équipe » avec les notes internes.
export async function renderProgramPdfResponse(input: { organizationId: string; event: PdfEvent; program: EventProgram; variant: ProgramVariant }): Promise<Response> {
  return renderPdf({
    ...input,
    variantLabel: (t) => (input.variant === "couple" ? t("programPdfCouple") : t("programPdfVendors")),
    filename: (t) => (input.variant === "couple" ? t("programPdfFileCouple") : t("programPdfFileVendors")),
    disposition: "attachment",
  });
}

// Une version diffusée (clients, liste des versions de la fiche) : sans note interne, avec son numéro.
export async function renderPublishedProgramPdfResponse(input: {
  organizationId: string;
  event: PdfEvent;
  items: PublishedProgramItem[];
  version: PdfVersion;
  disposition: "inline" | "attachment";
}): Promise<Response> {
  return renderPdf({
    organizationId: input.organizationId,
    event: input.event,
    program: publishedPdfProgram(input.items, input.version.publishedAt),
    variant: "couple",
    version: input.version,
    variantLabel: (t) => t("programPdfPublished"),
    filename: (t) => t("programPdfFilePublished", { number: input.version.number }),
    disposition: input.disposition,
  });
}

// La vue d'un prestataire dans la version diffusée : ses séquences en entier, le déroulé du jour en
// titres et horaires (D9).
export async function renderVendorProgramPdfResponse(input: {
  organizationId: string;
  event: PdfEvent;
  program: VendorProgramView & { version: PdfVersion };
  slotLabel: string;
}): Promise<Response> {
  return renderPdf({
    organizationId: input.organizationId,
    event: input.event,
    program: vendorPdfProgram(input.program, input.slotLabel, input.program.version.publishedAt),
    variant: "couple",
    version: input.program.version,
    variantLabel: (t) => t("programPdfVendor", { slot: input.slotLabel }),
    participantsLabel: (t) => t("programPdfYourRole"),
    filename: (t) => t("programPdfFilePublished", { number: input.program.version.number }),
    disposition: "attachment",
  });
}
