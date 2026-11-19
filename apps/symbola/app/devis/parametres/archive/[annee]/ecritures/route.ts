// Lot 23b (JUR-06, ADR 0061) — CSV des écritures d'une année de la chaîne des
// pièces. Titulaire seulement (contrôle côté serveur), module Devis souscrit ;
// chaque export va au journal d'audit.
import { getLocale, getTranslations } from "next-intl/server";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { listLedgerEntries } from "@/modules/quotes/service";
import { authorizedAccountingReader } from "../../../../planner-access";
import { ledgerCsv } from "../../archive-csv";

export async function GET(_request: Request, { params }: { params: Promise<{ annee: string }> }): Promise<Response> {
  // Lot 52 : la Propriétaire et le Comptable (lecture seule) ; une Planner n'y a pas accès.
  const owner = await authorizedAccountingReader({ ownerOnly: true });
  if (!owner) return new Response(null, { status: 403 });
  const { annee } = await params;
  if (!/^\d{4}$/.test(annee)) return new Response(null, { status: 404 });
  const year = Number(annee);
  const entries = await listLedgerEntries(owner.organizationId, year);
  const t = await getTranslations("LedgerArchive");
  const locale = (await getLocale()) as Locale;
  await recordAudit(appDatabase(), { organizationId: owner.organizationId, action: "quotes.archive.exported", details: { year, entries: entries.length } });
  const csv = ledgerCsv(
    entries,
    {
      header: [t("csvSequence"), t("csvDate"), t("csvKind"), t("csvNumber"), t("csvQuote"), t("csvAmount"), t("csvMethod"), t("csvBackfill"), t("csvHash"), t("csvPreviousHash")],
      kind: (kind) => t(`kinds.${kind}`),
      yes: t("yes"),
    },
    locale,
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pieces-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
