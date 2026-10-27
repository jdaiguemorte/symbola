// EVT-05/06 — production du PDF du programme, partagée entre la fiche de
// la planner (deux variantes) et l'espace du marié (variante « mariés »
// seulement). L'appelant a déjà vérifié la session et l'accès.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { EventProgram, EventSummary, ProgramVariant } from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { ProgramPdfDocument } from "./program-pdf";
import { loadDocumentLogo } from "@/lib/document-logo";
import { buildProgramPdfModel } from "./program-pdf-model";

export async function renderProgramPdfResponse(input: {
  organizationId: string;
  event: EventSummary;
  program: EventProgram;
  variant: ProgramVariant;
}): Promise<Response> {
  const { sql, db } = createAppConnection();
  let header;
  try {
    header = await getDocumentHeader(db, input.organizationId);
  } finally {
    await sql.end();
  }

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Events");
  const names = input.event.clients.map((client) => client.firstName).join(" & ") || t("noClient");
  const heading = input.event.eventDate ? `${names} — ${formatCalendarDate(input.event.eventDate, locale)}` : names;

  const model = buildProgramPdfModel({
    program: input.program,
    variant: input.variant,
    locale,
    heading,
    organizationName: header?.organizationName ?? "",
    logo: await loadDocumentLogo(input.organizationId, header?.logoKey ?? null),
    watermark: input.event.isDemo ? t("demoWatermark") : null,
    labels: {
      title: t("programTitle"),
      variant: input.variant === "couple" ? t("programPdfCouple") : t("programPdfVendors"),
      version: (date) => t("programPdfVersion", { date }),
      time: t("programTime"),
      item: t("programItemLabel"),
      location: t("programLocation"),
      participants: t("programParticipants"),
      note: t("programInternalNote"),
      empty: t("noProgramItems"),
    },
  });

  const element = createElement(ProgramPdfDocument, { model }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  const filename = input.variant === "couple" ? t("programPdfFileCouple") : t("programPdfFileVendors");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
