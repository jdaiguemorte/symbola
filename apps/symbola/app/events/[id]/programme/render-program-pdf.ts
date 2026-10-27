// EVT-05/06 — production du PDF du programme, partagée entre la fiche de
// la planner (deux variantes) et l'espace du marié (variante « mariés »
// seulement). L'appelant a déjà vérifié la session et l'accès.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { createStorageClient, detectFileType, getPrivateObject } from "@symbola/files";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { EventProgram, EventSummary, ProgramVariant } from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { ProgramPdfDocument } from "./program-pdf";
import { buildProgramPdfModel, type ProgramPdfLogo } from "./program-pdf-model";

// Le logo est facultatif : s'il manque ou ne se lit pas, le PDF porte le
// nom de l'organisation à la place (jamais d'erreur pour la planner).
async function loadLogo(organizationId: string, logoKey: string | null): Promise<ProgramPdfLogo | null> {
  if (!logoKey) return null;
  try {
    const data = await getPrivateObject(createStorageClient(), logoKey);
    const type = detectFileType(data);
    if (type?.mime === "image/png") return { data, format: "png" };
    if (type?.mime === "image/jpeg") return { data, format: "jpg" };
    return null;
  } catch {
    console.warn(`logo illisible pour l'organisation ${organizationId}`);
    return null;
  }
}

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
    logo: await loadLogo(input.organizationId, header?.logoKey ?? null),
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
