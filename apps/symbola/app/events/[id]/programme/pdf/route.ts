// EVT-05 — export PDF A4 du programme du jour J, en deux variantes :
// « mariés » (sans notes internes) et « prestataires ». Contrôles côté
// serveur : session, organisation, module souscrit, identifiant valide.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { createStorageClient, detectFileType, getPrivateObject } from "@symbola/files";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { EventNotFoundError, getEvent, getEventProgram, type ProgramVariant } from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { ProgramPdfDocument } from "../program-pdf";
import { buildProgramPdfModel, type ProgramPdfLogo } from "../program-pdf-model";

const variantSchema = z.enum(["couple", "vendors"]);

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const { id } = await params;
  const variant = variantSchema.safeParse(new URL(request.url).searchParams.get("variant"));
  if (!isValidId(id) || !variant.success) return new Response(null, { status: 404 });

  const event = await getEvent(organizationId, id);
  if (!event) return new Response(null, { status: 404 });
  let program;
  try {
    program = await getEventProgram(organizationId, id);
  } catch (error) {
    if (error instanceof EventNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }

  const { sql, db } = createAppConnection();
  let header;
  try {
    header = await getDocumentHeader(db, organizationId);
  } finally {
    await sql.end();
  }

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Events");
  const names = event.clients.map((client) => client.firstName).join(" & ") || t("noClient");
  const heading = event.eventDate ? `${names} — ${formatCalendarDate(event.eventDate, locale)}` : names;
  const chosen: ProgramVariant = variant.data;

  const model = buildProgramPdfModel({
    program,
    variant: chosen,
    locale,
    heading,
    organizationName: header?.organizationName ?? "",
    logo: await loadLogo(organizationId, header?.logoKey ?? null),
    labels: {
      title: t("programTitle"),
      variant: chosen === "couple" ? t("programPdfCouple") : t("programPdfVendors"),
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
  const filename = chosen === "couple" ? t("programPdfFileCouple") : t("programPdfFileVendors");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
