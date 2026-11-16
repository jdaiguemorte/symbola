// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — ce que le module vendors rend au relevé de stockage : les
// fichiers du carnet (plaquettes, RIB), en nombre et en volume, hors fiches d'essai ; une image
// compte dans « images », le reste dans « dépôts ». Tailles lues en base ; jamais un nom de
// fichier. Exposé seulement par service.ts (ADR 0011).
import { eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { vendorFiles, vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import type { StorageNature, StorageUsageRow } from "@symbola/contracts";

export async function measureVendorsStorage(organizationId: string): Promise<StorageUsageRow[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const nature = sql<StorageNature>`case when ${vendorFiles.mime} like 'image/%' then 'images' else 'uploads' end`;
    const rows = await tx
      .select({ nature, files: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${vendorFiles.sizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(vendorFiles)
      .innerJoin(vendors, eq(vendors.id, vendorFiles.vendorId))
      .where(eq(vendors.isDemo, false))
      .groupBy(nature);
    return rows.map((row) => ({ nature: row.nature, eventId: null, files: row.files, bytes: row.bytes }));
  });
}
