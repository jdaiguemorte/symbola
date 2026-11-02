// Accès aux imports (lot 5, ADR 0022) — jamais importé hors de modules/hub/.
// Contrairement aux tables d'identité du hub, hub.imports porte des données
// métier : chaque requête passe par withOrganization (RLS forcée).
import { and, asc, desc, eq, isNotNull, lt } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { importItems, imports, type ImportColumnChoice, type ImportMatching, type ImportResult } from "@symbola/db/schema/hub";
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
      // Les rapprochements dépendent des colonnes : à recalculer.
      .set({ mapping, matching: null, updatedAt: now })
      .where(and(eq(imports.id, importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    return updated.length > 0;
  });
}

export async function updateDraftMatching(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  matching: ImportMatching,
  now: Date,
): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const updated = await tx
      .update(imports)
      .set({ matching, updatedAt: now })
      .where(and(eq(imports.id, importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    return updated.length > 0;
  });
}

// IMP-04 : décisions sur les colonnes sans équivalent — les rapprochements
// ne dépendent pas des champs libres, ils sont gardés.
export async function updateDraftMappingKeepingMatches(
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

export type ImportItemRow = typeof importItems.$inferSelect;
export type NewImportItem = Omit<typeof importItems.$inferInsert, "id" | "organizationId" | "importId" | "position" | "createdAt">;

// IMP-05 : l'import en cours devient l'entrée du journal ; ses lignes en
// attente sont effacées (les éléments écrits gardent leurs valeurs pour
// l'annulation). Ne vaut que pour un import encore « en cours ».
export async function markImportApplied(
  db: AppDatabase,
  input: { organizationId: string; importId: string; items: NewImportItem[]; result: ImportResult; now: Date },
): Promise<boolean> {
  return withOrganization(db, input.organizationId, async (tx) => {
    const updated = await tx
      .update(imports)
      .set({ status: "applied", appliedAt: input.now, result: input.result, rows: null, sourceLineNumbers: null, updatedAt: input.now })
      .where(and(eq(imports.id, input.importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    if (updated.length === 0) return false;
    if (input.items.length > 0) {
      await tx.insert(importItems).values(
        input.items.map((item, position) => ({ ...item, organizationId: input.organizationId, importId: input.importId, position })),
      );
    }
    return true;
  });
}

export async function findImportItems(db: AppDatabase, organizationId: string, importId: string): Promise<ImportItemRow[]> {
  return withOrganization(db, organizationId, (tx) =>
    tx.select().from(importItems).where(eq(importItems.importId, importId)).orderBy(asc(importItems.position)),
  );
}

export async function recordUndoOutcomes(
  db: AppDatabase,
  input: { organizationId: string; importId: string; outcomes: { itemId: string; outcome: NonNullable<ImportItemRow["undoOutcome"]> }[]; complete: boolean; now: Date },
): Promise<void> {
  await withOrganization(db, input.organizationId, async (tx) => {
    for (const { itemId, outcome } of input.outcomes) {
      await tx.update(importItems).set({ undoOutcome: outcome }).where(and(eq(importItems.id, itemId), eq(importItems.importId, input.importId)));
    }
    if (input.complete) {
      await tx
        .update(imports)
        .set({ status: "undone", undoneAt: input.now, updatedAt: input.now })
        .where(and(eq(imports.id, input.importId), eq(imports.status, "applied")));
    }
  });
}

// Passé le délai d'annulation : valeurs précédentes et écrites effacées.
export async function clearExpiredUndoValues(db: AppDatabase, organizationId: string, appliedBefore: Date): Promise<number> {
  return withOrganization(db, organizationId, async (tx) => {
    const expired = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(and(eq(imports.status, "applied"), isNotNull(imports.appliedAt), lt(imports.appliedAt, appliedBefore)));
    let cleared = 0;
    for (const { id } of expired) {
      const rows = await tx
        .update(importItems)
        .set({ previous: null, written: null })
        .where(and(eq(importItems.importId, id), isNotNull(importItems.written)))
        .returning({ id: importItems.id });
      cleared += rows.length;
    }
    return cleared;
  });
}
