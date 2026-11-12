// Lot 27b (POR-03, BUD-07, EVT-09) — accès aux données des décisions demandées
// au client. Jamais importé hors de modules/events/ (ADR 0011). Chaque lecture
// et écriture se fait sous RLS, dans l'organisation de la décision.
import { and, asc, eq } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { withOrganization } from "@symbola/db/with-organization";
import { eventActivities, eventDecisions } from "@symbola/db/schema/events";

export type EventDecisionRow = typeof eventDecisions.$inferSelect;

export async function insertDecisionRow(values: typeof eventDecisions.$inferInsert & { organizationId: string; eventId: string }): Promise<EventDecisionRow> {
  const db = appDatabase();
  return await withOrganization(db, values.organizationId, async (tx) => {
    const [row] = await tx.insert(eventDecisions).values(values).returning();
    if (!row) throw new Error("demande de décision échouée");
    await appendAudit(tx, { organizationId: values.organizationId, action: "events.decision.requested", objectId: values.eventId, details: { decisionId: row.id, kind: row.kind } });
    return row;
  });
}

export async function findDecisionRows(organizationId: string, eventId: string): Promise<EventDecisionRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) => tx.select().from(eventDecisions).where(eq(eventDecisions.eventId, eventId)).orderBy(asc(eventDecisions.requestedAt)));
}

export async function findDecisionRow(organizationId: string, decisionId: string): Promise<EventDecisionRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => (await tx.select().from(eventDecisions).where(eq(eventDecisions.id, decisionId)))[0] ?? null);
}

// Réponse d'un lien : seulement une décision encore en attente (la première
// réponse décide) ; la réponse va au fil d'activité et au journal. L'appelant
// fixe l'auteur (le lien) par withActor.
export async function answerDecisionRow(input: {
  organizationId: string;
  decisionId: string;
  status: "approved" | "declined";
  choiceId: string | null;
  comment: string | null;
  linkId: string;
  personName: string;
  now: Date;
}): Promise<EventDecisionRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(eventDecisions)
      .set({ status: input.status, choiceId: input.choiceId, comment: input.comment, decidedByLinkId: input.linkId, decidedByName: input.personName, decidedAt: input.now })
      .where(and(eq(eventDecisions.id, input.decisionId), eq(eventDecisions.status, "pending")))
      .returning();
    if (!row) return null;
    await tx.insert(eventActivities).values({ organizationId: input.organizationId, eventId: row.eventId, actorLinkId: input.linkId, kind: "decision_made", taskLabel: row.title, createdAt: input.now });
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.decision.answered", objectId: row.eventId, details: { decisionId: row.id, status: input.status } });
    return row;
  });
}

export async function withdrawDecisionRow(organizationId: string, decisionId: string): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx
      .update(eventDecisions)
      .set({ status: "withdrawn" })
      .where(and(eq(eventDecisions.id, decisionId), eq(eventDecisions.status, "pending")))
      .returning({ eventId: eventDecisions.eventId });
    if (!row) return false;
    await appendAudit(tx, { organizationId, action: "events.decision.withdrawn", objectId: row.eventId, details: { decisionId } });
    return true;
  });
}

// Décisions remplacées par d'autres (pour « remplacée par »).
export function replacementsOf(rows: Pick<EventDecisionRow, "id" | "replacesDecisionId">[]): Map<string, string> {
  return new Map(rows.flatMap((row) => (row.replacesDecisionId ? [[row.replacesDecisionId, row.id] as const] : [])));
}

