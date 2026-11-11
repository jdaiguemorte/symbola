// Lot 11 (L11-PRE-11) — export de la sélection courante du carnet (mêmes
// filtres que l'écran) en CSV ou en PDF. Session, organisation et module
// vérifiés ; le PDF ne contient pas les coordonnées personnelles (il peut
// être remis aux clients), le CSV est un outil de travail de l'équipe.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { toCsv } from "@symbola/privacy";
import { getVendor, type Vendor } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { pdfSafe } from "@/lib/pdf-text";
import { isVendorsModuleEnabled } from "../module-access";
import type { BookQuery } from "../filters";
import { loadBookSelection } from "../selection";
import { exportRows, exportTable, type ExportLabels } from "./selection-export";
import { SelectionPdf } from "./selection-pdf";

export async function GET(request: Request): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isVendorsModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const query: BookQuery = Object.fromEntries(url.searchParams.entries());
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const t = await getTranslations("VendorBook");
  const selection = await loadBookSelection(organizationId, query);
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
