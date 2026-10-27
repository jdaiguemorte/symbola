// Accès aux données du module quotes — jamais importé hors de
// modules/quotes/ (ADR 0011).
import { and, asc, eq, inArray, sql as raw } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  catalogItems,
  numberSeries,
  quoteLines,
  quoteSettings,
  quotes,
  quoteVersions,
} from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type QuoteSettingsRow = typeof quoteSettings.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteVersionRow = typeof quoteVersions.$inferSelect;
export type QuoteLineRow = typeof quoteLines.$inferSelect;

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

// DEV-01 — catalogue.
export async function findCatalogItems(organizationId: string, includeArchived: boolean): Promise<CatalogItemRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(catalogItems)
      .where(includeArchived ? undefined : raw`${catalogItems.archivedAt} is null`)
      .orderBy(asc(catalogItems.category), asc(catalogItems.label)),
  );
}

export async function findCatalogItem(organizationId: string, itemId: string): Promise<CatalogItemRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(catalogItems).where(eq(catalogItems.id, itemId));
    return row ?? null;
  });
}

export type CatalogItemData = Pick<
  CatalogItemRow,
  "label" | "description" | "unit" | "unitPriceCents" | "vatRateBasisPoints" | "category"
>;

export async function insertCatalogItem(organizationId: string, data: CatalogItemData): Promise<CatalogItemRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.insert(catalogItems).values({ organizationId, ...data }).returning();
    if (!row) throw new Error("création de l'article échouée");
    return row;
  });
}

export async function updateCatalogItemRow(
  organizationId: string,
  itemId: string,
  data: CatalogItemData,
): Promise<CatalogItemRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.update(catalogItems).set(data).where(eq(catalogItems.id, itemId)).returning();
    return row ?? null;
  });
}

export async function archiveCatalogItemRow(organizationId: string, itemId: string): Promise<void> {
  await inOrganization(organizationId, (tx) =>
    tx.update(catalogItems).set({ archivedAt: new Date() }).where(eq(catalogItems.id, itemId)),
  );
}

// Réglages : valeurs par défaut tant que l'organisation n'a rien changé.
export async function findQuoteSettings(organizationId: string): Promise<QuoteSettingsRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(quoteSettings);
    return row ?? null;
  });
}

export async function upsertQuoteSettings(
  organizationId: string,
  data: Pick<QuoteSettingsRow, "validityDays" | "quotePrefix" | "invoicePrefix" | "creditNotePrefix">,
): Promise<QuoteSettingsRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(quoteSettings)
      .values({ organizationId, ...data })
      .onConflictDoUpdate({ target: quoteSettings.organizationId, set: { ...data, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error("enregistrement des réglages échoué");
    return row;
  });
}

// Rang suivant d'une série, dans la transaction appelante : l'insertion ou
// l'incrément verrouille la ligne de la série jusqu'à la fin de la
// transaction, donc deux émissions simultanées ne reçoivent jamais le même
// rang, et un échec du document annule aussi le rang (aucun trou).
export async function nextSeriesRank(
  tx: Tx,
  organizationId: string,
  kind: "quote" | "invoice" | "credit_note",
  isDemo: boolean,
  year: number,
): Promise<number> {
  const [row] = await tx
    .insert(numberSeries)
    .values({ organizationId, kind, isDemo, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [numberSeries.organizationId, numberSeries.kind, numberSeries.isDemo, numberSeries.year],
      set: { lastNumber: raw`${numberSeries.lastNumber} + 1` },
    })
    .returning({ lastNumber: numberSeries.lastNumber });
  if (!row) throw new Error("attribution du numéro échouée");
  return row.lastNumber;
}

// DEV-01 — un devis et sa première version, numéro attribué dans la même
// transaction.
export async function insertQuote(input: {
  organizationId: string;
  eventId: string;
  isDemo: boolean;
  createdByUserId: string;
  year: number;
  formatNumber: (rank: number) => string;
}): Promise<QuoteRow> {
  return inOrganization(input.organizationId, async (tx) => {
    const rank = await nextSeriesRank(tx, input.organizationId, "quote", input.isDemo, input.year);
    const [quote] = await tx
      .insert(quotes)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        number: input.formatNumber(rank),
        isDemo: input.isDemo,
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (!quote) throw new Error("création du devis échouée");
    await tx.insert(quoteVersions).values({ organizationId: input.organizationId, quoteId: quote.id, version: 1 });
    return quote;
  });
}

export async function findEventQuotes(organizationId: string, eventId: string): Promise<QuoteRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx.select().from(quotes).where(eq(quotes.eventId, eventId)).orderBy(asc(quotes.createdAt), asc(quotes.number)),
  );
}

export type QuoteAggregate = { quote: QuoteRow; versions: QuoteVersionRow[]; lines: QuoteLineRow[] };

async function loadAggregate(tx: Tx, quote: QuoteRow): Promise<QuoteAggregate> {
  const versions = await tx
    .select()
    .from(quoteVersions)
    .where(eq(quoteVersions.quoteId, quote.id))
    .orderBy(asc(quoteVersions.version));
  const lines =
    versions.length > 0
      ? await tx
          .select()
          .from(quoteLines)
          .where(inArray(quoteLines.versionId, versions.map((version) => version.id)))
          .orderBy(asc(quoteLines.position))
      : [];
  return { quote, versions, lines };
}

export async function findQuoteAggregate(organizationId: string, quoteId: string): Promise<QuoteAggregate | null> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    return quote ? loadAggregate(tx, quote) : null;
  });
}

export async function findQuoteAggregates(organizationId: string, quoteIds: string[]): Promise<QuoteAggregate[]> {
  if (quoteIds.length === 0) return [];
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(quotes).where(inArray(quotes.id, quoteIds));
    return Promise.all(rows.map((quote) => loadAggregate(tx, quote)));
  });
}

// Version courante d'un devis, à condition qu'elle soit encore un
// brouillon : sinon « locked » (une version envoyée est immuable).
type DraftLookup = { status: "draft"; quote: QuoteRow; version: QuoteVersionRow } | { status: "not_found" | "locked" };

async function currentDraft(tx: Tx, quoteId: string): Promise<DraftLookup> {
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote) return { status: "not_found" };
  const [version] = await tx
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion)));
  if (!version) return { status: "not_found" };
  if (version.sentAt) return { status: "locked" };
  return { status: "draft", quote, version };
}

export type LineData = Omit<QuoteLineRow, "id" | "organizationId" | "versionId" | "position">;

export type WriteResult = { status: "ok"; quoteId: string } | { status: "not_found" | "locked" };

export async function insertQuoteLine(organizationId: string, quoteId: string, data: LineData): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const draft = await currentDraft(tx, quoteId);
    if (draft.status !== "draft") return { status: draft.status };
    const [last] = await tx
      .select({ max: raw<number | null>`max(${quoteLines.position})` })
      .from(quoteLines)
      .where(eq(quoteLines.versionId, draft.version.id));
    const position = last?.max === null || last?.max === undefined ? 0 : last.max + 1;
    await tx.insert(quoteLines).values({ organizationId, versionId: draft.version.id, ...data, position });
    return { status: "ok", quoteId };
  });
}

async function draftOfLine(tx: Tx, lineId: string): Promise<{ status: "draft"; line: QuoteLineRow; quoteId: string } | { status: "not_found" | "locked" }> {
  const [line] = await tx.select().from(quoteLines).where(eq(quoteLines.id, lineId));
  if (!line) return { status: "not_found" };
  const [version] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, line.versionId));
  if (!version) return { status: "not_found" };
  const draft = await currentDraft(tx, version.quoteId);
  if (draft.status !== "draft") return { status: draft.status };
  // Une ligne d'une ancienne version n'est jamais modifiable.
  if (draft.version.id !== version.id) return { status: "locked" };
  return { status: "draft", line, quoteId: version.quoteId };
}

export async function updateQuoteLineRow(
  organizationId: string,
  lineId: string,
  data: (current: QuoteLineRow) => LineData,
): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const found = await draftOfLine(tx, lineId);
    if (found.status !== "draft") return { status: found.status };
    await tx.update(quoteLines).set(data(found.line)).where(eq(quoteLines.id, lineId));
    return { status: "ok", quoteId: found.quoteId };
  });
}

export async function deleteQuoteLine(organizationId: string, lineId: string): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const found = await draftOfLine(tx, lineId);
    if (found.status !== "draft") return { status: found.status };
    await tx.delete(quoteLines).where(eq(quoteLines.id, lineId));
    return { status: "ok", quoteId: found.quoteId };
  });
}

export async function setGlobalDiscountRow(
  organizationId: string,
  quoteId: string,
  kind: "none" | "percent" | "amount",
  value: number,
): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const draft = await currentDraft(tx, quoteId);
    if (draft.status !== "draft") return { status: draft.status };
    await tx
      .update(quoteVersions)
      .set({ globalDiscountKind: kind, globalDiscountValue: value })
      .where(eq(quoteVersions.id, draft.version.id));
    return { status: "ok", quoteId };
  });
}

// Envoi : la version courante reçoit ses copies figées et devient immuable.
// Les lignes sont relues et la version verrouillée dans la même transaction
// que l'écriture : les totaux figés correspondent toujours aux lignes figées.
export type FrozenFields = Pick<
  QuoteVersionRow,
  "validUntil" | "vatRegime" | "legalMention" | "sellerSnapshot" | "totalsSnapshot"
> & { sentAt: Date };

export async function freezeCurrentVersion(
  organizationId: string,
  quoteId: string,
  freeze: (version: QuoteVersionRow, lines: QuoteLineRow[]) => FrozenFields,
): Promise<WriteResult | { status: "empty" }> {
  return inOrganization(organizationId, async (tx) => {
    const draft = await currentDraft(tx, quoteId);
    if (draft.status !== "draft") return { status: draft.status };
    await tx.execute(raw`select 1 from ${quoteVersions} where ${quoteVersions.id} = ${draft.version.id} for update`);
    const lines = await tx.select().from(quoteLines).where(eq(quoteLines.versionId, draft.version.id));
    if (lines.length === 0) return { status: "empty" };
    await tx.update(quoteVersions).set(freeze(draft.version, lines)).where(eq(quoteVersions.id, draft.version.id));
    await tx.update(quotes).set({ status: "sent", updatedAt: new Date() }).where(eq(quotes.id, quoteId));
    return { status: "ok", quoteId };
  });
}

// Nouvelle version (V+1) en brouillon, copie des lignes et de la remise de
// la version envoyée ; les précédentes restent intactes.
export async function insertNextVersion(organizationId: string, quoteId: string): Promise<WriteResult | { status: "draft_exists" }> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return { status: "not_found" };
    const [current] = await tx
      .select()
      .from(quoteVersions)
      .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion)));
    if (!current) return { status: "not_found" };
    if (!current.sentAt) return { status: "draft_exists" };
    if (quote.status === "signed") return { status: "locked" };

    const [next] = await tx
      .insert(quoteVersions)
      .values({
        organizationId,
        quoteId,
        version: current.version + 1,
        globalDiscountKind: current.globalDiscountKind,
        globalDiscountValue: current.globalDiscountValue,
      })
      .returning();
    if (!next) throw new Error("création de la version échouée");
    const lines = await tx.select().from(quoteLines).where(eq(quoteLines.versionId, current.id));
    if (lines.length > 0) {
      await tx.insert(quoteLines).values(
        lines.map(({ id: _id, versionId: _versionId, ...line }) => ({ ...line, versionId: next.id })),
      );
    }
    await tx
      .update(quotes)
      .set({ currentVersion: next.version, status: "draft", updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));
    return { status: "ok", quoteId };
  });
}

// AIDE-02 — suppression des devis d'événements d'essai (lignes, versions,
// devis). Les séries DEMO restent : elles ne servent qu'aux essais.
export async function deleteEventQuotes(organizationId: string, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await inOrganization(organizationId, async (tx) => {
    const rows = await tx.select({ id: quotes.id }).from(quotes).where(inArray(quotes.eventId, eventIds));
    const quoteIds = rows.map((row) => row.id);
    if (quoteIds.length === 0) return;
    const versions = await tx
      .select({ id: quoteVersions.id })
      .from(quoteVersions)
      .where(inArray(quoteVersions.quoteId, quoteIds));
    const versionIds = versions.map((version) => version.id);
    if (versionIds.length > 0) {
      await tx.delete(quoteLines).where(inArray(quoteLines.versionId, versionIds));
      await tx.delete(quoteVersions).where(inArray(quoteVersions.id, versionIds));
    }
    await tx.delete(quotes).where(inArray(quotes.id, quoteIds));
  });
}
