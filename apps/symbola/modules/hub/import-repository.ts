// Accès aux imports (lot 5, ADR 0022) — jamais importé hors de modules/hub/.
// Contrairement aux tables d'identité du hub, hub.imports porte des données
// métier : chaque requête passe par withOrganization (RLS forcée).
import { and, desc, eq, lt } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { imports, type ImportColumnChoice } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";

export type ImportRow = typeof imports.$inferSelect;
export type NewImportRow = typeof imports.$inferInsert;

export async function insertImport(db: AppDatabase, values: NewImportRow): Promise<ImportRow> {
  return withOrganization(db, values.organizationId, async (tx) => {
    const [row] = await tx.insert(imports).values(values).returning();
    if (!row) throw new Error("création de l'import échouée");
    return row;
  });
}

export async function findImport(db: AppDatabase, organizationId: string, importId: string): Promise<ImportRow | null> {
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(imports).where(eq(imports.id, importId));
    return row ?? null;
  });
}

export async function findImports(db: AppDatabase, organizationId: string): Promise<ImportRow[]> {
  return withOrganization(db, organizationId, (tx) => tx.select().from(imports).orderBy(desc(imports.createdAt)));
}

// Abandon d'un import en cours : les lignes en attente sont effacées, l'entrée
// reste au journal.
export async function markDraftCancelled(db: AppDatabase, organizationId: string, importId: string, now: Date): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const updated = await tx
      .update(imports)
      .set({ status: "cancelled", rows: null, sourceLineNumbers: null, updatedAt: now })
      .where(and(eq(imports.id, importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    return updated.length > 0;
  });
}

export async function cancelExpiredDrafts(db: AppDatabase, organizationId: string, now: Date): Promise<number> {
  return withOrganization(db, organizationId, async (tx) => {
    const updated = await tx
      .update(imports)
      .set({ status: "cancelled", rows: null, sourceLineNumbers: null, updatedAt: now })
      .where(and(eq(imports.status, "draft"), lt(imports.expiresAt, now)))
      .returning({ id: imports.id });
    return updated.length;
  });
}

export async function updateDraftMapping(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  mapping: ImportColumnChoice[],
  now: Date,
): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const updated = await tx
      .update(imports)
      .set({ mapping, updatedAt: now })
      .where(and(eq(imports.id, importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    return updated.length > 0;
  });
}
