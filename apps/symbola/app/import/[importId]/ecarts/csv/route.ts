import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getRejectedRowsForExport } from "@/lib/import/gaps";
import { rejectedRowsCsv, rejectedRowsFileName } from "@/lib/import/report-csv";
import { isValidId } from "../../../access";
import { reasonText } from "../reasons";

// IMP-04 — « Ce rapport se télécharge en CSV pour corriger et réimporter. »
// Réservé à la planner de l'organisation ; jamais mis en cache.
export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const { importId } = await params;
  if (!isValidId(importId)) return new Response(null, { status: 404 });

  const exported = await getRejectedRowsForExport(auth.user.organizationId, importId);
  if (!exported) return new Response(null, { status: 404 });

  const t = await getTranslations("Import");
  const translate = (key: string, values?: Record<string, string>) => t(key, values);
  const csv = rejectedRowsCsv({
    headers: exported.headers.map((header, index) => header || t("unnamedColumn", { number: index + 1 })),
    reasonHeader: t("rejectedReasonHeader"),
    rows: exported.rows.map((row) => ({ cells: row.cells, reason: row.reasons.map((reason) => reasonText(translate, reason)).join(" ; ") })),
  });
  const fileName = rejectedRowsFileName(exported.fileName, t("rejectedFileSuffix"));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
