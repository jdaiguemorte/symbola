// Lot 51 (PAR-08, étape 7 ; ADR 0091) — le bilan du lendemain en PDF : équipe de l'organisation
// seulement (jamais un client ni un prestataire par son lien), module Évènements souscrit, évènement
// de l'organisation, bilan prêt (le lendemain du dernier jour dans le fuseau de l'évènement).
// Téléchargé, jamais en cache ; le téléchargement est tracé, sans son contenu.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { eventNames, getDayReport, getEvent } from "@/modules/events/service";
import { listDayHandovers } from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { pdfSafe } from "@/lib/pdf-text";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { DayReportPdf } from "./day-report-pdf";
import { dayReportSections, reportHandovers } from "./day-report-view";
import { dayReportWords } from "./report-words";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const event = await getEvent(organizationId, id);
  if (!event) return new Response(null, { status: 404 });
  const handovers = (await isBudgetModuleEnabled(organizationId)) ? reportHandovers(await listDayHandovers(organizationId, id)) : [];
  const report = await getDayReport({ organizationId, eventId: id, handovers });
  if (!report?.ready) return new Response(null, { status: 404 });
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("DayReport");
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: event.timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const amount = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  const sections = dayReportSections(report, dayReportWords(t as never), { time, amount });
  const labels = {
    title: t("title"),
    heading: t("heading", { event: eventNames(event.clients, event.name) || t("event"), date: event.eventDate ? formatCalendarDate(event.eventDate, locale) : "" }),
    preparedAt: t("preparedAt", { date: formatDateTime(new Date(report.preparedAt ?? Date.now()), locale) }),
    footer: t("footer"),
    page: (page: number, total: number) => t("page", { page, total }),
  };
  const element = createElement(DayReportPdf, { labels: pdfSafe(labels), sections: pdfSafe(sections), language: locale }) as unknown as ReactElement<DocumentProps>;
  const body = new Uint8Array(await renderToBuffer(element));
  await recordAudit(appDatabase(), { organizationId, action: "events.day_report.downloaded", objectId: id, details: { format: "pdf" } });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bilan-jour-j-${event.eventDate ?? id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
