// Lot 28c (BUD-10, décision D6) — export du budget d'un événement en XLSX ou en
// PDF. Contrôles côté serveur : session, rôle planner, organisation, module
// Budget souscrit, identifiant valide, événement de l'organisation (sinon la
// réponse d'un objet inexistant, SEC-13). Mise en forme des documents de
// l'organisation : logo et nom (hub), couleur des réglages des documents
// (module Devis) ; sans module Devis, la couleur de départ. L'export va au
// journal (famille « exports ») avec son format, sans donnée personnelle.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { starterDocumentStyle } from "@symbola/starter-templates";
import { refusedResponse } from "@/lib/access-refusals";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { createXlsx } from "@/lib/xlsx-workbook";
import { listBudgetLines } from "@/modules/budget/service";
import { getEvent } from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { getDocumentSettings } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";
import { budgetPdfPayments, budgetPdfRows, budgetXlsxSheets, buildBudgetExport, EXPORT_AMOUNTS, type BudgetExportLabels } from "./budget-export";
import { BudgetPdfDocument } from "./budget-pdf";

const formatSchema = z.enum(["xlsx", "pdf"]);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isBudgetModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const { eventId } = await params;
  const format = formatSchema.safeParse(new URL(request.url).searchParams.get("format"));
  if (!isValidId(eventId) || !format.success) return new Response(null, { status: 404 });
  const event = await getEvent(organizationId, eventId);
  if (!event) return refusedResponse(request);

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Budget");
  const db = appDatabase();
  const [view, header, quotesEnabled] = await Promise.all([listBudgetLines(organizationId, eventId), getDocumentHeader(db, organizationId), isQuotesModuleEnabled(organizationId)]);
  const color = (quotesEnabled ? (await getDocumentSettings(organizationId)).color : null) ?? starterDocumentStyle(locale).defaultColor;

  const labels: BudgetExportLabels = {
    sheetBudget: t("exportSheetBudget"),
    sheetPayments: t("exportSheetPayments"),
    category: t("exportCategory"),
    line: t("exportLine"),
    vendor: t("exportVendor"),
    vatRate: t("exportVatRate"),
    amounts: {
      estimated: t("amounts.estimated"),
      quoted: t("amounts.quoted"),
      committed: t("amounts.committed"),
      paid: t("amounts.paid"),
      remaining: t("amounts.remaining"),
      variance: t("variance"),
    },
    ttc: (label) => t("exportTtc", { label }),
    ht: (label) => t("exportHt", { label }),
    categoryTotal: t("exportCategoryTotal"),
    total: t("total"),
    payment: t("exportPayment"),
    paymentAmount: t("exportPaymentAmount"),
    dueOn: t("paymentDueOn"),
    status: t("exportStatus"),
    paidOn: t("exportPaidOn"),
    statuses: { due: t("exportStatusDue"), overdue: t("exportStatusOverdue"), paid: t("exportStatusPaid") },
  };
  const model = buildBudgetExport(view, labels);
  const names = event.clients.map((client) => client.firstName).join(" & ") || t("noClient");
  const heading = event.eventDate ? `${names} — ${formatCalendarDate(event.eventDate, locale)}` : names;
  const organizationName = header?.organizationName ?? "";
  const today = parisToday();
  const filename = `${t("exportFileName")}-${today}.${format.data}`;

  // SEC-19 : l'export au journal, avec son format et le nombre de lignes, aucun nom.
  await recordAudit(db, { organizationId, action: "budget.budget.exported", objectId: eventId, details: { format: format.data, lines: view.lines.length } });

  if (format.data === "xlsx") {
    const workbook = createXlsx({ title: `${t("title")} — ${heading}`, author: organizationName, headerColor: color, sheets: budgetXlsxSheets(model, labels) });
    return new Response(new Uint8Array(workbook), {
      headers: { "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
    });
  }

  const amount = (cents: number) => formatAmount(cents, locale);
  const pdfModel = pdfSafe({
    language: locale,
    organizationName,
    color,
    title: t("title"),
    heading,
    generated: t("exportGenerated", { date: formatCalendarDate(today, locale) }),
    mode: t(model.professional ? "vatModeProfessional" : "vatModeIndividual"),
    columns: [labels.line, ...EXPORT_AMOUNTS.map((key) => labels.ttc(labels.amounts[key]))],
    rows: budgetPdfRows(model, { amount, ht: (value) => t("htAmount", { amount: value }) }),
    paymentsTitle: t("scheduleTitle"),
    paymentColumns: [labels.vendor, labels.line, labels.payment, labels.paymentAmount, labels.dueOn, labels.status, labels.paidOn],
    payments: budgetPdfPayments(model, labels, { amount, date: (date) => formatCalendarDate(date, locale) }),
    noPayments: t("noPayments"),
    watermark: event.isDemo ? t("exportDemoWatermark") : null,
  });
  // Le logo (octets) ne passe pas par pdfSafe.
  const logo = await loadDocumentLogo(organizationId, header?.logoKey ?? null);
  const element = createElement(BudgetPdfDocument, { model: { ...pdfModel, logo } }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
