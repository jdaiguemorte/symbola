// Lot 11 (L11-PRE-11) — export de la sélection courante du carnet (mêmes
// filtres que l'écran) en CSV ou en PDF. Session, organisation et module
// vérifiés ; le PDF ne contient pas les coordonnées personnelles (il peut
// être remis aux clients), le CSV est un outil de travail de l'équipe.
// Lot 73b (PRE-01, HUB-13 ; § 5.2 critère 7) : « Exporter… » de la sélection, par POST (500 identifiants
// ne tiennent pas dans une adresse) : seules les fiches choisies, toutes de l'organisation, sinon refus.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { toCsv } from "@symbola/privacy";
import { getVendor, getVendorsByIds, VENDOR_BULK_MAX, type Vendor } from "@/modules/vendors/service";
import { isSameOrigin } from "@/lib/uploads/receive";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { pdfSafe } from "@/lib/pdf-text";
import { isVendorsModuleEnabled } from "../module-access";
import type { BookQuery } from "../filters";
import { loadBookSelection } from "../selection";
import { exportRows, exportTable, type ExportLabels } from "./selection-export";
import { SelectionPdf } from "./selection-pdf";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function organizationOf(): Promise<string | Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  if (!(await isVendorsModuleEnabled(auth.user.organizationId))) return new Response(null, { status: 404 });
  return auth.user.organizationId;
}

export async function GET(request: Request): Promise<Response> {
  const organizationId = await organizationOf();
  if (organizationId instanceof Response) return organizationId;
  const url = new URL(request.url);
  const query: BookQuery = Object.fromEntries(url.searchParams.entries());
  return exportSelection(organizationId, query, url.searchParams.get("format") === "pdf" ? "pdf" : "csv", null);
}

export async function POST(request: Request): Promise<Response> {
  const organizationId = await organizationOf();
  if (organizationId instanceof Response) return organizationId;
  if (!isSameOrigin(request.headers)) return new Response(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response(null, { status: 400 });
  const ids = [...new Set(form.getAll("ids").map(String))];
  if (ids.length === 0 || ids.length > VENDOR_BULK_MAX || ids.some((id) => !UUID.test(id))) return new Response(null, { status: 404 });
  // Une fiche d'une autre organisation (ou inconnue) : tout est refusé, comme une fiche inexistante.
  if ((await getVendorsByIds(organizationId, ids)).length !== ids.length) return new Response(null, { status: 404 });
  const query: BookQuery = {};
  for (const key of ["autour", "rayon", "tri", "sens"]) {
    const value = form.get(key);
    if (typeof value === "string" && value) query[key] = value;
  }
  return exportSelection(organizationId, query, form.get("format") === "pdf" ? "pdf" : "csv", ids);
}

async function exportSelection(organizationId: string, query: BookQuery, format: "csv" | "pdf", ids: string[] | null): Promise<Response> {
  const t = await getTranslations("VendorBook");
  const selection = await loadBookSelection(organizationId, query, ids ? { ids } : {});
  const labels: ExportLabels = {
    name: t("exportName"),
    type: t("exportType"),
    contact: t("exportContact"),
    phone: t("exportPhone"),
    email: t("exportEmail"),
    address: t("exportAddress"),
    city: t("exportCity"),
    distance: t("exportTravel"),
    travel: (km, minutes) => t("travel", { km, minutes }),
    tags: t("exportTags"),
  };
  const today = new Date().toISOString().slice(0, 10);
  // Lot 23 (SEC-19) : export du carnet au journal (format et nombre de fiches, aucun nom).
  await recordAudit(appDatabase(), { organizationId, action: "vendors.vendors.exported", details: { format, count: selection.results.length } });

  if (format === "csv") {
    const details = (await Promise.all(selection.results.map((item) => getVendor(organizationId, item.id)))).filter((vendor): vendor is Vendor => vendor !== null);
    const rows = exportRows(selection.results, details, selection.types, selection.tags, labels);
    return new Response(toCsv(exportTable(rows, labels)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prestataires-${today}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const rows = pdfSafe(exportRows(selection.results, [], selection.types, selection.tags, labels));
  const subtitle = selection.center
    ? t("exportPdfAround", { count: rows.length, place: selection.center.label, km: selection.filters.radiusKm })
    : t("results", { count: rows.length });
  const pdf = await renderToBuffer(
    createElement(SelectionPdf, { title: pdfSafe(t("exportPdfTitle")), subtitle: pdfSafe(subtitle), rows, labels: pdfSafe(labels) }) as unknown as ReactElement<DocumentProps>,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prestataires-${today}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
