// Accès aux données du module quotes — jamais importé hors de
// modules/quotes/ (ADR 0011).
import { and, asc, eq, inArray, sql as raw } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  catalogItems,
  numberSeries,
  paymentMethods,
  paymentScheduleItems,
  quoteLines,
  quoteSigners,
  signatureRequests,
  signatureWebhookLog,
  quoteSettings,
  quotes,
  quoteVersions,
} from "@symbola/db/schema/quotes";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { withOrganization } from "@symbola/db/with-organization";

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type QuoteSettingsRow = typeof quoteSettings.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteVersionRow = typeof quoteVersions.$inferSelect;
export type QuoteLineRow = typeof quoteLines.$inferSelect;
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
export type ScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
export type SignatureRequestRow = typeof signatureRequests.$inferSelect;
export type QuoteSignerRow = typeof quoteSigners.$inferSelect;

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
  data: Pick<QuoteSettingsRow, "validityDays" | "quotePrefix" | "invoicePrefix" | "creditNotePrefix" | "upcomingHorizonDays">,
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

export type QuoteAggregate = {
  quote: QuoteRow;
  versions: QuoteVersionRow[];
  lines: QuoteLineRow[];
  scheduleItems: ScheduleItemRow[];
  paymentMethods: PaymentMethodRow[];
  signatureRequests: SignatureRequestRow[];
  signers: QuoteSignerRow[];
};

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
  const scheduleItems =
    versions.length > 0
      ? await tx
          .select()
          .from(paymentScheduleItems)
          .where(inArray(paymentScheduleItems.versionId, versions.map((version) => version.id)))
          .orderBy(asc(paymentScheduleItems.dueDate), asc(paymentScheduleItems.position))
      : [];
  const methodIds = [...new Set(scheduleItems.flatMap((item) => (item.paymentMethodId ? [item.paymentMethodId] : [])))];
  const methods = methodIds.length > 0 ? await tx.select().from(paymentMethods).where(inArray(paymentMethods.id, methodIds)) : [];
  const requests =
    versions.length > 0
      ? await tx.select().from(signatureRequests).where(inArray(signatureRequests.versionId, versions.map((version) => version.id)))
      : [];
  const signers =
    requests.length > 0
      ? await tx
          .select()
          .from(quoteSigners)
          .where(inArray(quoteSigners.requestId, requests.map((request) => request.id)))
          .orderBy(asc(quoteSigners.position))
      : [];
  return { quote, versions, lines, scheduleItems, paymentMethods: methods, signatureRequests: requests, signers };
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
  freeze: (version: QuoteVersionRow, lines: QuoteLineRow[], scheduleItems: ScheduleItemRow[]) => FrozenFields,
): Promise<WriteResult | { status: "empty" }> {
  return inOrganization(organizationId, async (tx) => {
    const draft = await currentDraft(tx, quoteId);
    if (draft.status !== "draft") return { status: draft.status };
    await tx.execute(raw`select 1 from ${quoteVersions} where ${quoteVersions.id} = ${draft.version.id} for update`);
    const lines = await tx.select().from(quoteLines).where(eq(quoteLines.versionId, draft.version.id));
    if (lines.length === 0) return { status: "empty" };
    const items = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.versionId, draft.version.id));
    await tx.update(quoteVersions).set(freeze(draft.version, lines, items)).where(eq(quoteVersions.id, draft.version.id));
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
    // DEV-03 : l'échéancier suit, paiements déjà reçus compris.
    const items = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.versionId, current.id));
    if (items.length > 0) {
      await tx
        .insert(paymentScheduleItems)
        .values(items.map(({ id: _id, versionId: _versionId, ...item }) => ({ ...item, versionId: next.id })));
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
// Renvoie les clés des documents signés stockés, à supprimer du stockage.
export async function deleteEventQuotes(organizationId: string, eventIds: string[]): Promise<string[]> {
  if (eventIds.length === 0) return [];
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select({ id: quotes.id }).from(quotes).where(inArray(quotes.eventId, eventIds));
    const quoteIds = rows.map((row) => row.id);
    if (quoteIds.length === 0) return [];
    const versions = await tx
      .select({ id: quoteVersions.id })
      .from(quoteVersions)
      .where(inArray(quoteVersions.quoteId, quoteIds));
    const versionIds = versions.map((version) => version.id);
    const documentKeys: string[] = [];
    if (versionIds.length > 0) {
      const requests = await tx.select().from(signatureRequests).where(inArray(signatureRequests.versionId, versionIds));
      const requestIds = requests.map((request) => request.id);
      for (const request of requests) {
        if (request.signedDocumentKey) documentKeys.push(request.signedDocumentKey);
        if (request.auditCertificateKey) documentKeys.push(request.auditCertificateKey);
      }
      if (requestIds.length > 0) {
        await tx.delete(signatureWebhookLog).where(inArray(signatureWebhookLog.requestId, requestIds));
        await tx.delete(quoteSigners).where(inArray(quoteSigners.requestId, requestIds));
        await tx.delete(signatureRequests).where(inArray(signatureRequests.id, requestIds));
      }
      await tx.delete(paymentScheduleItems).where(inArray(paymentScheduleItems.versionId, versionIds));
      await tx.delete(quoteLines).where(inArray(quoteLines.versionId, versionIds));
      await tx.delete(quoteVersions).where(inArray(quoteVersions.id, versionIds));
    }
    await tx.delete(quotes).where(inArray(quotes.id, quoteIds));
    return documentKeys;
  });
}

// --- DEV-03 : modes de paiement ---

export async function findPaymentMethods(organizationId: string, includeArchived: boolean): Promise<PaymentMethodRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(paymentMethods)
      .where(includeArchived ? undefined : raw`${paymentMethods.archivedAt} is null`)
      .orderBy(asc(paymentMethods.position), asc(paymentMethods.createdAt)),
  );
}

export async function insertPaymentMethods(organizationId: string, labels: string[]): Promise<PaymentMethodRow[]> {
  return inOrganization(organizationId, async (tx) => {
    const [last] = await tx
      .select({ max: raw<number | null>`max(${paymentMethods.position})` })
      .from(paymentMethods);
    const start = last?.max === null || last?.max === undefined ? 0 : last.max + 1;
    return tx
      .insert(paymentMethods)
      .values(labels.map((label, index) => ({ organizationId, label, position: start + index })))
      .returning();
  });
}

export async function archivePaymentMethodRow(organizationId: string, paymentMethodId: string): Promise<void> {
  await inOrganization(organizationId, (tx) =>
    tx.update(paymentMethods).set({ archivedAt: new Date() }).where(eq(paymentMethods.id, paymentMethodId)),
  );
}

// --- DEV-03 : échéancier ---

export type ScheduleItemData = Pick<ScheduleItemRow, "label" | "dueDate" | "amountCents" | "percentageBasisPoints">;

// Contrôle de l'échéancier complet (somme ≤ total), appelé dans la
// transaction après l'écriture : s'il lève, rien n'est écrit.
export type ScheduleCheck = (version: QuoteVersionRow, lines: QuoteLineRow[], items: ScheduleItemRow[]) => void;

async function checkSchedule(tx: Tx, version: QuoteVersionRow, check: ScheduleCheck): Promise<void> {
  const lines = await tx.select().from(quoteLines).where(eq(quoteLines.versionId, version.id));
  const items = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.versionId, version.id));
  check(version, lines, items);
}

async function lockVersion(tx: Tx, versionId: string): Promise<void> {
  await tx.execute(raw`select 1 from ${quoteVersions} where ${quoteVersions.id} = ${versionId} for update`);
}

export async function insertScheduleItem(
  organizationId: string,
  quoteId: string,
  data: ScheduleItemData,
  check: ScheduleCheck,
): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const draft = await currentDraft(tx, quoteId);
    if (draft.status !== "draft") return { status: draft.status };
    await lockVersion(tx, draft.version.id);
    const [last] = await tx
      .select({ max: raw<number | null>`max(${paymentScheduleItems.position})` })
      .from(paymentScheduleItems)
      .where(eq(paymentScheduleItems.versionId, draft.version.id));
    const position = last?.max === null || last?.max === undefined ? 0 : last.max + 1;
    await tx.insert(paymentScheduleItems).values({ organizationId, versionId: draft.version.id, ...data, position });
    await checkSchedule(tx, draft.version, check);
    return { status: "ok", quoteId };
  });
}

// L'échéance, sa version et son devis ; « draft » seulement si la version
// est la version courante, encore en brouillon.
async function scheduleItemContext(
  tx: Tx,
  scheduleItemId: string,
): Promise<{ item: ScheduleItemRow; version: QuoteVersionRow; quote: QuoteRow } | null> {
  const [item] = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.id, scheduleItemId));
  if (!item) return null;
  const [version] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, item.versionId));
  if (!version) return null;
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, version.quoteId));
  if (!quote) return null;
  return { item, version, quote };
}

export async function updateScheduleItemRow(
  organizationId: string,
  scheduleItemId: string,
  data: ScheduleItemData,
  check: ScheduleCheck,
): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const context = await scheduleItemContext(tx, scheduleItemId);
    if (!context) return { status: "not_found" };
    const { version, quote } = context;
    if (version.sentAt || version.version !== quote.currentVersion) return { status: "locked" };
    await lockVersion(tx, version.id);
    await tx.update(paymentScheduleItems).set(data).where(eq(paymentScheduleItems.id, scheduleItemId));
    await checkSchedule(tx, version, check);
    return { status: "ok", quoteId: quote.id };
  });
}

export async function deleteScheduleItemRow(organizationId: string, scheduleItemId: string): Promise<WriteResult> {
  return inOrganization(organizationId, async (tx) => {
    const context = await scheduleItemContext(tx, scheduleItemId);
    if (!context) return { status: "not_found" };
    const { version, quote } = context;
    if (version.sentAt || version.version !== quote.currentVersion) return { status: "locked" };
    await tx.delete(paymentScheduleItems).where(eq(paymentScheduleItems.id, scheduleItemId));
    return { status: "ok", quoteId: quote.id };
  });
}

export type PaymentResult = WriteResult | { status: "not_payable" | "method_not_found" };

// Paiement (ou annulation) d'une échéance de la version courante d'un devis
// envoyé ou signé ; le mode doit exister et ne pas être archivé.
export async function setScheduleItemPayment(
  organizationId: string,
  scheduleItemId: string,
  payment: { paidOn: string; paymentMethodId: string } | null,
): Promise<PaymentResult> {
  return inOrganization(organizationId, async (tx) => {
    const context = await scheduleItemContext(tx, scheduleItemId);
    if (!context) return { status: "not_found" };
    const { version, quote } = context;
    const payable = (quote.status === "sent" || quote.status === "signed") && version.sentAt !== null;
    if (!payable || version.version !== quote.currentVersion) return { status: "not_payable" };
    if (payment) {
      const [method] = await tx.select().from(paymentMethods).where(eq(paymentMethods.id, payment.paymentMethodId));
      if (!method || method.archivedAt) return { status: "method_not_found" };
    }
    await tx
      .update(paymentScheduleItems)
      .set(
        payment
          ? { paidOn: payment.paidOn, paymentMethodId: payment.paymentMethodId, paidRecordedAt: new Date() }
          : { paidOn: null, paymentMethodId: null, paidRecordedAt: null },
      )
      .where(eq(paymentScheduleItems.id, scheduleItemId));
    return { status: "ok", quoteId: quote.id };
  });
}

export type UnpaidScheduleRow = {
  item: ScheduleItemRow;
  version: QuoteVersionRow;
  quote: QuoteRow;
};

// Échéances non payées de la version courante des devis envoyés ou signés,
// hors essais (ADR 0008 : jamais dans les encaissements ni le tableau de bord).
export async function findUnpaidScheduleItems(organizationId: string): Promise<UnpaidScheduleRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select({ item: paymentScheduleItems, version: quoteVersions, quote: quotes })
      .from(paymentScheduleItems)
      .innerJoin(quoteVersions, eq(quoteVersions.id, paymentScheduleItems.versionId))
      .innerJoin(quotes, and(eq(quotes.id, quoteVersions.quoteId), eq(quotes.currentVersion, quoteVersions.version)))
      .where(
        and(
          raw`${paymentScheduleItems.paidOn} is null`,
          eq(quotes.isDemo, false),
          inArray(quotes.status, ["sent", "signed"]),
        ),
      )
      .orderBy(asc(paymentScheduleItems.dueDate), asc(paymentScheduleItems.position)),
  );
}

// --- DEV-02 : signature en ligne ---

export type NewSigner = Omit<QuoteSignerRow, "organizationId" | "requestId" | "status" | "signedAt">;

// Enregistre la demande créée chez le fournisseur, pour la version courante
// envoyée d'un devis « envoyé » ; « exists » si la version a déjà sa demande.
export async function insertSignatureRequest(
  organizationId: string,
  quoteId: string,
  request: { provider: string; externalId: string; signers: NewSigner[] },
): Promise<WriteResult | { status: "exists" | "not_sent" }> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return { status: "not_found" };
    const [version] = await tx
      .select()
      .from(quoteVersions)
      .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion)));
    if (!version) return { status: "not_found" };
    if (quote.status !== "sent" || !version.sentAt) return { status: "not_sent" };
    await lockVersion(tx, version.id);
    const [existing] = await tx.select({ id: signatureRequests.id }).from(signatureRequests).where(eq(signatureRequests.versionId, version.id));
    if (existing) return { status: "exists" };
    const [row] = await tx
      .insert(signatureRequests)
      .values({ organizationId, versionId: version.id, provider: request.provider, externalId: request.externalId })
      .returning();
    if (!row) throw new Error("création de la demande de signature échouée");
    await tx.insert(quoteSigners).values(request.signers.map((signer) => ({ ...signer, organizationId, requestId: row.id })));
    return { status: "ok", quoteId };
  });
}

export type SignatureContext = {
  request: SignatureRequestRow;
  signers: QuoteSignerRow[];
  version: QuoteVersionRow;
  quote: QuoteRow;
};

export async function findSignatureRequestByExternalId(
  organizationId: string,
  provider: string,
  externalId: string,
): Promise<SignatureContext | null> {
  return inOrganization(organizationId, async (tx) => {
    const [request] = await tx
      .select()
      .from(signatureRequests)
      .where(and(eq(signatureRequests.provider, provider), eq(signatureRequests.externalId, externalId)));
    if (!request) return null;
    const signers = await tx.select().from(quoteSigners).where(eq(quoteSigners.requestId, request.id)).orderBy(asc(quoteSigners.position));
    const [version] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, request.versionId));
    const [quote] = version ? await tx.select().from(quotes).where(eq(quotes.id, version.quoteId)) : [];
    if (!version || !quote) return null;
    return { request, signers, version, quote };
  });
}

export type SignatureStateUpdate = {
  signers: { id: string; status: "pending" | "signed" | "declined"; signedAt: Date | null }[];
  outcome:
    | { kind: "pending" }
    | { kind: "completed"; signedDocumentKey: string; auditCertificateKey: string; completedAt: Date; event: { name: string; version: number; payload: unknown } }
    | { kind: "declined"; completedAt: Date };
};

// Applique l'état relu chez le fournisseur, par différence et sous verrou :
// une demande déjà terminée ne change plus (idempotence, ADR 0021).
// « transitioned » n'est vrai que pour l'appel qui a terminé la demande.
export async function applySignatureStateRows(
  organizationId: string,
  requestId: string,
  update: SignatureStateUpdate,
  eventType: string,
): Promise<{ status: "ok"; transitioned: boolean; changed: boolean } | { status: "not_found" }> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(raw`select 1 from ${signatureRequests} where ${signatureRequests.id} = ${requestId} for update`);
    const [request] = await tx.select().from(signatureRequests).where(eq(signatureRequests.id, requestId));
    if (!request) return { status: "not_found" };
    if (request.status !== "pending") {
      await tx.insert(signatureWebhookLog).values({ organizationId, requestId, eventType, outcome: "duplicate" });
      return { status: "ok", transitioned: false, changed: false };
    }

    const current = await tx.select().from(quoteSigners).where(eq(quoteSigners.requestId, requestId));
    let changed = false;
    for (const signer of update.signers) {
      const row = current.find((candidate) => candidate.id === signer.id);
      if (!row || row.status !== "pending" || signer.status === "pending") continue;
      await tx.update(quoteSigners).set({ status: signer.status, signedAt: signer.signedAt }).where(eq(quoteSigners.id, signer.id));
      changed = true;
    }

    const [version] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, request.versionId));
    let transitioned = false;
    if (version && update.outcome.kind === "completed") {
      await tx
        .update(signatureRequests)
        .set({
          status: "completed",
          signedDocumentKey: update.outcome.signedDocumentKey,
          auditCertificateKey: update.outcome.auditCertificateKey,
          completedAt: update.outcome.completedAt,
        })
        .where(eq(signatureRequests.id, requestId));
      await tx.update(quotes).set({ status: "signed", updatedAt: new Date() }).where(eq(quotes.id, version.quoteId));
      // Outbox : publié dans la même transaction que le passage à « Signé ».
      const [quote] = await tx.select().from(quotes).where(eq(quotes.id, version.quoteId));
      if (quote && !quote.isDemo) {
        await emitDomainEvent(tx, { organizationId, ...update.outcome.event });
      }
      transitioned = true;
    } else if (version && update.outcome.kind === "declined") {
      await tx.update(signatureRequests).set({ status: "declined", completedAt: update.outcome.completedAt }).where(eq(signatureRequests.id, requestId));
      await tx.update(quotes).set({ status: "declined", updatedAt: new Date() }).where(eq(quotes.id, version.quoteId));
      transitioned = true;
    }
    await tx
      .insert(signatureWebhookLog)
      .values({ organizationId, requestId, eventType, outcome: transitioned ? update.outcome.kind : changed ? "signer_updated" : "unchanged" });
    return { status: "ok", transitioned, changed };
  });
}

export async function insertWebhookLog(
  organizationId: string,
  entry: { requestId: string | null; eventType: string; outcome: string },
): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.insert(signatureWebhookLog).values({ organizationId, ...entry }));
}

// Espace du marié : demandes des devis (version courante) d'un événement.
export async function findEventSignatureContexts(organizationId: string, eventId: string): Promise<SignatureContext[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ request: signatureRequests, version: quoteVersions, quote: quotes })
      .from(signatureRequests)
      .innerJoin(quoteVersions, eq(quoteVersions.id, signatureRequests.versionId))
      .innerJoin(quotes, and(eq(quotes.id, quoteVersions.quoteId), eq(quotes.currentVersion, quoteVersions.version)))
      .where(eq(quotes.eventId, eventId))
      .orderBy(asc(quotes.number));
    if (rows.length === 0) return [];
    const signers = await tx
      .select()
      .from(quoteSigners)
      .where(inArray(quoteSigners.requestId, rows.map((row) => row.request.id)))
      .orderBy(asc(quoteSigners.position));
    return rows.map((row) => ({ ...row, signers: signers.filter((signer) => signer.requestId === row.request.id) }));
  });
}
