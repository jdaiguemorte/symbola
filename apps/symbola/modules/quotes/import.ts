// IMP-05 — import d'articles du catalogue et de modes de paiement (lot 5,
// ADR 0022), exposé par service.ts : un lot en une transaction, relecture,
// annulation. Un article déjà utilisé dans un devis, un mode de paiement déjà
// utilisé dans un échéancier, ne sont jamais supprimés par une annulation.
import { eq, sql } from "drizzle-orm";
import { sameImportValue, type ImportApplyResult, type ImportApplyRow, type ImportedItem, type ImportUndoItem, type ImportUndoOutcome } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { catalogItems, paymentMethods, paymentScheduleItems, quoteLines } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Values = Record<string, unknown>;

async function inTransaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await pg.end();
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const same = sameImportValue;

// Colonne du fichier → champ de l'article.
const CATALOG_FIELDS = {
  label: "label",
  description: "description",
  unit: "unit",
  unitPrice: "unitPriceCents",
  vatRate: "vatRateBasisPoints",
  category: "category",
} as const;

async function catalogItemState(tx: Tx, id: string): Promise<Values | null> {
  const [item] = await tx.select().from(catalogItems).where(eq(catalogItems.id, id));
  if (!item) return null;
  return {
    label: item.label,
    description: item.description,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    vatRateBasisPoints: item.vatRateBasisPoints,
    category: item.category,
    importedFields: item.importedFields,
  };
}

export async function importCatalogItemRows(input: {
  organizationId: string;
  rows: ImportApplyRow[];
  // Taux appliqué à un article sans colonne de TVA : taux par défaut de
  // l'organisation (0 en franchise), lu par l'orchestrateur dans le hub.
  defaultVatRateBasisPoints: number;
}): Promise<ImportApplyResult> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    for (const row of input.rows) {
      const wanted: Values = {};
      for (const [column, field] of Object.entries(CATALOG_FIELDS)) {
        const value = row.values[column];
        if (value !== null && value !== undefined && value !== "") wanted[field] = typeof value === "string" ? value.trim() : value;
      }
      const current = row.matchId ? await catalogItemState(tx, row.matchId) : null;
      if (row.matchId && current) {
        const importedFields = Object.keys(row.importedFields).length > 0 ? { ...((current.importedFields as Record<string, string> | null) ?? {}), ...row.importedFields } : current.importedFields;
        if (!same(importedFields, current.importedFields)) wanted.importedFields = importedFields;
        const keys = Object.keys(wanted).filter((key) => !same(current[key], wanted[key]));
        if (keys.length === 0) {
          unchanged += 1;
          continue;
        }
        const written = Object.fromEntries(keys.map((key) => [key, wanted[key]]));
        await tx.update(catalogItems).set(written as Partial<typeof catalogItems.$inferInsert>).where(eq(catalogItems.id, row.matchId));
        const previous = Object.fromEntries(keys.map((key) => [key, current[key] ?? null]));
        items.push({ rowIndex: row.rowIndex, module: "quotes", kind: "catalog_item", elementId: row.matchId, action: "updated", previous, written });
        continue;
      }
      const [item] = await tx
        .insert(catalogItems)
        .values({
          organizationId: input.organizationId,
          label: text(row.values.label) ?? "",
          description: text(row.values.description),
          unit: text(row.values.unit) ?? "",
          unitPriceCents: row.values.unitPrice as number,
          vatRateBasisPoints: (row.values.vatRate as number | null) ?? input.defaultVatRateBasisPoints,
          category: text(row.values.category),
          importedFields: Object.keys(row.importedFields).length > 0 ? row.importedFields : null,
        })
        .returning();
      if (!item) throw new Error("création de l'article échouée");
      items.push({ rowIndex: row.rowIndex, module: "quotes", kind: "catalog_item", elementId: item.id, action: "created", previous: null, written: (await catalogItemState(tx, item.id)) ?? {} });
    }
    return { items, unchanged };
  });
}

export async function importPaymentMethodRows(input: { organizationId: string; rows: ImportApplyRow[] }): Promise<ImportApplyResult> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const existing = await tx.select({ label: paymentMethods.label }).from(paymentMethods);
    const labels = new Set(existing.map((method) => normalized(method.label)));
    let position = existing.length;
    for (const row of input.rows) {
      const label = text(row.values.label);
      if (!label || row.matchId || labels.has(normalized(label))) {
        unchanged += 1;
        continue;
      }
      labels.add(normalized(label));
      const [method] = await tx.insert(paymentMethods).values({ organizationId: input.organizationId, label, position: position++ }).returning();
      if (!method) throw new Error("création du mode de paiement échouée");
      items.push({ rowIndex: row.rowIndex, module: "quotes", kind: "payment_method", elementId: method.id, action: "created", previous: null, written: { label } });
    }
    return { items, unchanged };
  });
}

async function stateOf(tx: Tx, kind: string, id: string): Promise<Values | null> {
  if (kind === "catalog_item") return catalogItemState(tx, id);
  const [method] = await tx.select({ label: paymentMethods.label }).from(paymentMethods).where(eq(paymentMethods.id, id));
  return method ? { label: method.label } : null;
}

function modifiedSince(current: Values, written: Values | null): boolean {
  return Object.keys(written ?? {}).some((key) => !same(current[key], (written ?? {})[key]));
}

async function inUse(tx: Tx, kind: string, id: string): Promise<boolean> {
  const [row] =
    kind === "catalog_item"
      ? await tx.select({ n: sql<number>`count(*)::int` }).from(quoteLines).where(eq(quoteLines.catalogItemId, id))
      : await tx.select({ n: sql<number>`count(*)::int` }).from(paymentScheduleItems).where(eq(paymentScheduleItems.paymentMethodId, id));
  return (row?.n ?? 0) > 0;
}

export async function findModifiedImportedQuotesElements(
  organizationId: string,
  items: Pick<ImportUndoItem, "kind" | "elementId" | "action" | "written">[],
): Promise<boolean[]> {
  return inTransaction(organizationId, async (tx) => {
    const result: boolean[] = [];
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      result.push(current ? modifiedSince(current, item.written) : false);
    }
    return result;
  });
}

export async function undoImportedQuotesElements(organizationId: string, items: ImportUndoItem[]): Promise<ImportUndoOutcome[]> {
  return inTransaction(organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      if (!current) {
        outcomes.push("missing");
        continue;
      }
      if (modifiedSince(current, item.written) && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      if (item.action === "created") {
        if (await inUse(tx, item.kind, item.elementId)) {
          outcomes.push("kept_in_use");
          continue;
        }
        if (item.kind === "catalog_item") await tx.delete(catalogItems).where(eq(catalogItems.id, item.elementId));
        else await tx.delete(paymentMethods).where(eq(paymentMethods.id, item.elementId));
      } else if (item.kind === "catalog_item") {
        await tx
          .update(catalogItems)
          .set((item.previous ?? {}) as Partial<typeof catalogItems.$inferInsert>)
          .where(eq(catalogItems.id, item.elementId));
      }
      outcomes.push("undone");
    }
    return outcomes;
  });
}
