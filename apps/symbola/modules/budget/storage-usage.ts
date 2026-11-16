// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — ce que le module budget rend au relevé de stockage : les
// documents joints aux lignes (devis, contrats, factures des prestataires), en nombre et en volume,
// par évènement ; une image compte dans « images », le reste dans « dépôts ». Tailles lues en base ;
// jamais un nom de fichier. Exposé seulement par service.ts (ADR 0011).
import { eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { budgetLineAttachments, budgetLines } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import type { StorageNature, StorageUsageRow } from "@symbola/contracts";

export async function measureBudgetStorage(organizationId: string): Promise<StorageUsageRow[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const nature = sql<StorageNature>`case when ${budgetLineAttachments.mime} like 'image/%' then 'images' else 'uploads' end`;
    const rows = await tx
      .select({ eventId: budgetLines.eventId, nature, files: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${budgetLineAttachments.sizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(budgetLineAttachments)
      .innerJoin(budgetLines, eq(budgetLines.id, budgetLineAttachments.lineId))
      .groupBy(budgetLines.eventId, nature);
    return rows.map((row) => ({ nature: row.nature, eventId: row.eventId, files: row.files, bytes: row.bytes }));
  });
}
