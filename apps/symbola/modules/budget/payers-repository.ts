// Lot 43 (BUD-06, BUD-11 ; D8, D9 ; ADR 0089) — accès aux payeurs d'un évènement, à leurs parts sur les
// lignes du budget, au payeur désigné des échéances (prestataires et planner). Sous la RLS de
// l'organisation ; jamais importé hors de modules/budget/ (ADR 0011).
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { budgetLinePayerShares, budgetLines, eventPayers, plannerInstalmentPayers, vendorPayments, type EVENT_PAYER_KINDS } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export type EventPayerRow = typeof eventPayers.$inferSelect;
export type PayerShareRow = typeof budgetLinePayerShares.$inferSelect;
export type InstalmentPayerRow = typeof plannerInstalmentPayers.$inferSelect;
type Kind = (typeof EVENT_PAYER_KINDS)[number];

async function inOrganization<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, work);
}

export async function findEventPayers(organizationId: string, eventId: string): Promise<EventPayerRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(eventPayers).where(eq(eventPayers.eventId, eventId)).orderBy(asc(eventPayers.position), asc(eventPayers.createdAt)));
}

// Les mariés, créés à la première lecture (100 % de chaque ligne par défaut) ; une seule fois même en
// lectures concurrentes (verrou consultatif de l'évènement).
export async function ensureCouplePayer(organizationId: string, eventId: string, name: string): Promise<EventPayerRow> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`budget.event_payers.${eventId}`}))`);
    const [existing] = await tx.select().from(eventPayers).where(and(eq(eventPayers.eventId, eventId), eq(eventPayers.kind, "couple")));
    if (existing) return existing;
    const [row] = await tx.insert(eventPayers).values({ organizationId, eventId, name, kind: "couple", ownShareOnly: false, position: 0 }).returning();
    return row!;
  });
}

export async function insertEventPayer(organizationId: string, input: { eventId: string; name: string; kind: Kind; linkId: string | null }): Promise<EventPayerRow> {
  return inOrganization(organizationId, async (tx) => {
    const count = (await tx.select({ id: eventPayers.id }).from(eventPayers).where(eq(eventPayers.eventId, input.eventId))).length;
    const [row] = await tx.insert(eventPayers).values({ organizationId, ...input, position: count }).returning();
    await appendAudit(tx, { organizationId, action: "budget.payers.changed", objectId: input.eventId, details: { payerId: row!.id, change: "added" } });
    return row!;
  });
}

export async function updateEventPayerRow(organizationId: string, payerId: string, input: { name?: string; kind?: Kind; linkId?: string | null; ownShareOnly?: boolean }): Promise<EventPayerRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.update(eventPayers).set({ ...input, updatedAt: new Date() }).where(eq(eventPayers.id, payerId)).returning();
    if (row && input.ownShareOnly !== undefined) {
      await appendAudit(tx, { organizationId, action: "budget.payer_visibility.changed", objectId: row.eventId, details: { payerId, ownShareOnly: input.ownShareOnly } });
    }
    return row ?? null;
  });
}

export async function deleteEventPayerRow(organizationId: string, payerId: string): Promise<EventPayerRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.delete(eventPayers).where(eq(eventPayers.id, payerId)).returning();
    if (row) await appendAudit(tx, { organizationId, action: "budget.payers.changed", objectId: row.eventId, details: { payerId, change: "removed" } });
    return row ?? null;
  });
}

export async function findPayerShares(organizationId: string, lineIds: string[]): Promise<PayerShareRow[]> {
  if (lineIds.length === 0) return [];
  return inOrganization(organizationId, (tx) => tx.select().from(budgetLinePayerShares).where(inArray(budgetLinePayerShares.lineId, lineIds)));
}

// Les parts d'une ligne, remplacées d'un coup.
export async function replaceLinePayerShares(
  organizationId: string,
  input: { eventId: string; lineId: string; shares: { payerId: string; percentageBasisPoints: number | null; amountCents: number | null }[] },
): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const [line] = await tx.select({ id: budgetLines.id }).from(budgetLines).where(and(eq(budgetLines.id, input.lineId), eq(budgetLines.eventId, input.eventId))).for("update");
    if (!line) return false;
    await tx.delete(budgetLinePayerShares).where(eq(budgetLinePayerShares.lineId, input.lineId));
    if (input.shares.length > 0) await tx.insert(budgetLinePayerShares).values(input.shares.map((share) => ({ organizationId, lineId: input.lineId, ...share })));
    await appendAudit(tx, { organizationId, action: "budget.payers.changed", objectId: input.eventId, details: { lineId: input.lineId, change: "shares", count: input.shares.length } });
    return true;
  });
}

export async function setVendorPaymentPayerRow(organizationId: string, input: { eventId: string; paymentId: string; payerId: string | null }): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.update(vendorPayments).set({ payerId: input.payerId, updatedAt: new Date() }).where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId))).returning({ id: vendorPayments.id });
    return rows.length === 1;
  });
}

export async function findInstalmentPayers(organizationId: string, eventId: string): Promise<InstalmentPayerRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(plannerInstalmentPayers).where(eq(plannerInstalmentPayers.eventId, eventId)));
}

export async function setInstalmentPayerRow(organizationId: string, input: { eventId: string; scheduleItemId: string; payerId: string | null }): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    await tx.delete(plannerInstalmentPayers).where(eq(plannerInstalmentPayers.scheduleItemId, input.scheduleItemId));
    if (input.payerId) await tx.insert(plannerInstalmentPayers).values({ organizationId, eventId: input.eventId, scheduleItemId: input.scheduleItemId, payerId: input.payerId });
    await appendAudit(tx, { organizationId, action: "budget.payers.changed", objectId: input.eventId, details: { scheduleItemId: input.scheduleItemId, change: "instalment" } });
  });
}
