// DEV-04 — export e-reporting d'une période (CSV), hors données d'essai.
// Contrôles côté serveur : session planner, organisation, module souscrit.
import { getTranslations } from "next-intl/server";
import { getEReporting } from "@/modules/quotes/service";
import { authorizedPlanner } from "../../planner-access";
import { eReportingCsv } from "../csv";
import { requestedPeriod } from "../period";

export async function GET(request: Request): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const params = new URL(request.url).searchParams;
  const period = requestedPeriod({ from: params.get("from") ?? undefined, to: params.get("to") ?? undefined });
  let view;
  try {
    view = await getEReporting(planner.organizationId, period);
  } catch (error) {
    if (error instanceof RangeError) return new Response(null, { status: 400 });
    throw error;
  }
  const t = await getTranslations("Quotes");
  const csv = eReportingCsv(view, {
    header: [t("csvType"), t("csvDate"), t("csvNumber"), t("csvReference"), t("csvLabel"), t("csvHt"), t("csvVat"), t("csvTtc"), t("csvMethod")],
    invoice: t("csvInvoice"),
    creditNote: t("csvCreditNote"),
    payment: t("csvPayment"),
    total: t("csvTotal"),
    deposit: t("invoiceKindDeposit"),
    balance: t("invoiceKindBalance"),
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="e-reporting-${view.from}-${view.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
