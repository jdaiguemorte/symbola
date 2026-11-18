// Lot 44 (CRM-01, CRM-02 ; ADR 0084) — accès aux données du formulaire de contact, des demandes reçues
// et du pipeline. Jamais importé hors de modules/events/ (ADR 0011). Tout se lit et s'écrit sous RLS,
// dans l'organisation ; seule l'adresse publique du formulaire se lit sans organisation (exception
// écrite de la migration 0160, comme la page de réservation du lot 46).
import { and, asc, desc, eq, inArray, isNull, lt, max, or, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { withOrganization } from "@symbola/db/with-organization";
import { contactForms, eventActivities, eventClients, events, pipelineStages, prospectRequests, prospectSources } from "@symbola/db/schema/events";
import { EVT_PROSPECT_RECEIVED, EVT_PROSPECT_RECEIVED_VERSION, type ContactFormField } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type ContactFormRow = typeof contactForms.$inferSelect;
export type PipelineStageRow = typeof pipelineStages.$inferSelect;
export type ProspectRequestRow = typeof prospectRequests.$inferSelect;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// —— Formulaire de contact ——————————————————————————————————————————————————————————————

export function findContactForm(organizationId: string): Promise<ContactFormRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(contactForms).where(eq(contactForms.organizationId, organizationId)))[0] ?? null);
}

// L'adresse publique : la seule lecture sans organisation (politique public_lookup).
export async function findContactFormBySlug(slug: string): Promise<ContactFormRow | null> {
  const [row] = await appDatabase().select().from(contactForms).where(eq(contactForms.slug, slug)).limit(1);
  return row ?? null;
}

export function upsertContactForm(
  organizationId: string,
  values: { active: boolean; slug: string; hiddenFields: ContactFormField[]; privacyPolicyUrl: string | null; allowedOrigins: string[]; notifyOwner: boolean; locale: "fr" | "en" },
): Promise<ContactFormRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(contactForms)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: contactForms.organizationId, set: { ...values, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error("enregistrement du formulaire de contact échoué");
    await appendAudit(tx, { organizationId, action: "events.contact_form.updated", objectId: row.id, details: { active: row.active } });
    return row;
  });
}

// —— Étapes du pipeline ————————————————————————————————————————————————————————————————

export function findPipelineStages(organizationId: string): Promise<PipelineStageRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(pipelineStages).orderBy(asc(pipelineStages.position), asc(pipelineStages.createdAt)));
}

// Première ouverture : les étapes de départ, une seule fois (verrou par organisation).
export function seedPipelineStages(organizationId: string, labels: string[]): Promise<PipelineStageRow[]> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`pipeline-stages:${organizationId}`}, 0))`);
    const existing = await tx.select().from(pipelineStages).orderBy(asc(pipelineStages.position), asc(pipelineStages.createdAt));
    if (existing.length > 0) return existing;
    return tx
      .insert(pipelineStages)
      .values(labels.map((label, position) => ({ organizationId, label, position })))
      .returning();
  });
}

export function insertPipelineStage(organizationId: string, label: string): Promise<PipelineStageRow> {
  return inOrganization(organizationId, async (tx) => {
    const [last] = await tx.select({ position: max(pipelineStages.position) }).from(pipelineStages);
    const [row] = await tx
      .insert(pipelineStages)
      .values({ organizationId, label, position: last?.position === null || last?.position === undefined ? 0 : Number(last.position) + 1 })
      .returning();
    if (!row) throw new Error("ajout de l'étape échoué");
    return row;
  });
}

export function updatePipelineStageLabel(organizationId: string, stageId: string, label: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.update(pipelineStages).set({ label, updatedAt: new Date() }).where(eq(pipelineStages.id, stageId)).returning({ id: pipelineStages.id })).length > 0);
}

// Nouvel ordre complet (identifiants de toutes les étapes, dans l'ordre voulu).
export function reorderPipelineStageRows(organizationId: string, orderedIds: string[]): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    for (const [position, id] of orderedIds.entries()) await tx.update(pipelineStages).set({ position, updatedAt: new Date() }).where(eq(pipelineStages.id, id));
  });
}

// Retire une étape ; ses cartes passent d'abord à la destination (null : aucune carte attendue).
// includeUnstaged : l'étape est la première, qui porte aussi les options sans étape. Rend le nombre
// de cartes déplacées, ou null si l'étape n'existe pas.
export function deletePipelineStage(organizationId: string, stageId: string, destination: { id: string; label: string } | null, actorUserId: string, includeUnstaged: boolean): Promise<number | null> {
  return inOrganization(organizationId, async (tx) => {
    const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, stageId));
    if (!stage) return null;
    const cards = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.status, "option"), includeUnstaged ? or(eq(events.pipelineStageId, stageId), isNull(events.pipelineStageId)) : eq(events.pipelineStageId, stageId)));
    if (cards.length > 0) {
      if (!destination) throw new Error("étape non vide sans destination");
      await tx.update(events).set({ pipelineStageId: destination.id, updatedAt: new Date() }).where(inArray(events.id, cards.map((card) => card.id)));
      await tx.insert(eventActivities).values(cards.map((card) => ({ organizationId, eventId: card.id, actorUserId, kind: "stage_changed" as const, taskLabel: destination.label })));
    }
    // Les évènements qui ne sont plus des options gardent l'étape quittée : elle se vide (clé étrangère).
    await tx.delete(pipelineStages).where(eq(pipelineStages.id, stageId));
    return cards.length;
  });
}

export function countOptionsByStage(organizationId: string): Promise<{ stageId: string | null; count: number }[]> {
  return inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ stageId: events.pipelineStageId, count: sql<number>`count(*)::int` })
        .from(events)
        .where(eq(events.status, "option"))
        .groupBy(events.pipelineStageId)
    ).map((row) => ({ stageId: row.stageId, count: Number(row.count) })),
  );
}

// —— Cartes ——————————————————————————————————————————————————————————————————————————————

export type CardRow = {
  event: typeof events.$inferSelect;
  request: Pick<ProspectRequestRow, "period" | "budgetRange" | "receivedAt"> | null;
  sourceLabel: string | null;
  stageSince: Date | null;
};

export function findPipelineCardRows(organizationId: string): Promise<CardRow[]> {
  return inOrganization(organizationId, async (tx) => {
    const options = await tx.select().from(events).where(eq(events.status, "option"));
    if (options.length === 0) return [];
    const ids = options.map((event) => event.id);
    const requests = await tx
      .select({ eventId: prospectRequests.eventId, period: prospectRequests.period, budgetRange: prospectRequests.budgetRange, receivedAt: prospectRequests.receivedAt })
      .from(prospectRequests)
      .where(inArray(prospectRequests.eventId, ids))
      .orderBy(asc(prospectRequests.receivedAt));
    const requestByEvent = new Map(requests.map((request) => [request.eventId!, request]));
    const sources = await tx.select({ id: prospectSources.id, label: prospectSources.label }).from(prospectSources);
    const sourceLabel = new Map(sources.map((source) => [source.id, source.label]));
    const moves = await tx
      .select({ eventId: eventActivities.eventId, at: max(eventActivities.createdAt) })
      .from(eventActivities)
      .where(and(inArray(eventActivities.eventId, ids), eq(eventActivities.kind, "stage_changed")))
      .groupBy(eventActivities.eventId);
    const movedAt = new Map(moves.map((move) => [move.eventId, move.at]));
    return options.map((event) => ({
      event,
      request: requestByEvent.get(event.id) ?? null,
      sourceLabel: event.prospectSourceId ? (sourceLabel.get(event.prospectSourceId) ?? null) : null,
      stageSince: movedAt.get(event.id) ? new Date(movedAt.get(event.id)!) : null,
    }));
  });
}

// Évènements en cours datés (ni clôturés, ni annulés, ni essais) : la date d'une carte est-elle prise ?
export function findBusyDates(organizationId: string): Promise<{ eventId: string; eventDate: string }[]> {
  return inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ eventId: events.id, eventDate: events.eventDate })
        .from(events)
        .where(and(eq(events.isDemo, false), sql`${events.status} not in ('closed', 'cancelled')`, sql`${events.eventDate} is not null`))
    ).map((row) => ({ eventId: row.eventId, eventDate: row.eventDate! })),
  );
}

export type MoveCardOutcome = "moved" | "unchanged" | "not_found" | "not_option" | "stage_not_found";

// Une carte passe à une étape : l'évènement doit être une option de l'organisation, l'étape aussi.
export function moveCardRow(input: { organizationId: string; eventId: string; stageId: string; firstStageId: string; actorUserId: string }): Promise<MoveCardOutcome> {
  return inOrganization(input.organizationId, async (tx) => {
    const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, input.stageId));
    if (!stage) return "stage_not_found";
    const [event] = await tx.select({ id: events.id, status: events.status, stageId: events.pipelineStageId }).from(events).where(eq(events.id, input.eventId));
    if (!event) return "not_found";
    if (event.status !== "option") return "not_option";
    if ((event.stageId ?? input.firstStageId) === stage.id) return "unchanged";
    await tx.update(events).set({ pipelineStageId: stage.id, updatedAt: new Date() }).where(eq(events.id, event.id));
    await tx.insert(eventActivities).values({ organizationId: input.organizationId, eventId: event.id, actorUserId: input.actorUserId, kind: "stage_changed", taskLabel: stage.label });
    return "moved";
  });
}

// —— Demandes reçues ——————————————————————————————————————————————————————————————————————

// La demande d'un prospect créé par le formulaire, dans la transaction de sa création (outbox).
export async function insertReceivedRequest(tx: Tx, values: { organizationId: string; eventId: string; message: string | null; period: string | null; budgetRange: string | null; receivedAt: Date }): Promise<ProspectRequestRow> {
  const [row] = await tx.insert(prospectRequests).values({ ...values, state: "received", pending: null }).returning();
  if (!row) throw new Error("enregistrement de la demande échoué");
  await emitDomainEvent(tx, {
    organizationId: values.organizationId,
    name: EVT_PROSPECT_RECEIVED,
    version: EVT_PROSPECT_RECEIVED_VERSION,
    payload: { requestId: row.id, eventId: values.eventId, state: "received" },
  });
  return row;
}

export function insertRequestToReview(values: { organizationId: string; message: string | null; period: string | null; budgetRange: string | null; pending: Record<string, string>; receivedAt: Date }): Promise<ProspectRequestRow> {
  return inOrganization(values.organizationId, async (tx) => {
    const [row] = await tx
      .insert(prospectRequests)
      .values({ organizationId: values.organizationId, eventId: null, state: "to_review", message: values.message, period: values.period, budgetRange: values.budgetRange, pending: values.pending, receivedAt: values.receivedAt })
      .returning();
    if (!row) throw new Error("enregistrement de la demande échoué");
    await emitDomainEvent(tx, { organizationId: values.organizationId, name: EVT_PROSPECT_RECEIVED, version: EVT_PROSPECT_RECEIVED_VERSION, payload: { requestId: row.id, eventId: null, state: "to_review" } });
    return row;
  });
}

export function findRequestsToReview(organizationId: string): Promise<ProspectRequestRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(prospectRequests).where(eq(prospectRequests.state, "to_review")).orderBy(desc(prospectRequests.receivedAt)));
}

export function findRequestToReview(organizationId: string, requestId: string): Promise<ProspectRequestRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(prospectRequests).where(and(eq(prospectRequests.id, requestId), eq(prospectRequests.state, "to_review"))))[0] ?? null);
}

// Une demande acceptée devient reçue : rattachée à l'évènement créé, sans ses champs d'attente.
export async function attachReviewedRequest(tx: Tx, organizationId: string, requestId: string, eventId: string): Promise<boolean> {
  const updated = await tx
    .update(prospectRequests)
    .set({ state: "received", eventId, pending: null, updatedAt: new Date() })
    .where(and(eq(prospectRequests.id, requestId), eq(prospectRequests.state, "to_review")))
    .returning({ id: prospectRequests.id });
  if (updated.length === 0) return false;
  await emitDomainEvent(tx, { organizationId, name: EVT_PROSPECT_RECEIVED, version: EVT_PROSPECT_RECEIVED_VERSION, payload: { requestId, eventId, state: "received" } });
  return true;
}

export function deleteRequestToReview(organizationId: string, requestId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(prospectRequests).where(and(eq(prospectRequests.id, requestId), eq(prospectRequests.state, "to_review"))).returning({ id: prospectRequests.id })).length > 0);
}

// Demandes « à vérifier » reçues avant `before` et jamais traitées : effacées (contact-form.json).
export function deleteStaleRequestsToReview(organizationId: string, before: Date): Promise<number> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(prospectRequests).where(and(eq(prospectRequests.state, "to_review"), lt(prospectRequests.receivedAt, before))).returning({ id: prospectRequests.id })).length);
}

export function findEventRequest(organizationId: string, eventId: string): Promise<ProspectRequestRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(prospectRequests).where(eq(prospectRequests.eventId, eventId)).orderBy(asc(prospectRequests.receivedAt)).limit(1))[0] ?? null);
}

// Prospects du formulaire encore à la première étape (« Aujourd'hui ») : options, hors essai.
export function findNewRequestRows(organizationId: string, firstStageId: string): Promise<{ eventId: string; eventDate: string | null; period: string | null; receivedAt: Date }[]> {
  return inOrganization(organizationId, async (tx) =>
    tx
      .select({ eventId: events.id, eventDate: events.eventDate, period: prospectRequests.period, receivedAt: prospectRequests.receivedAt })
      .from(prospectRequests)
      .innerJoin(events, eq(events.id, prospectRequests.eventId))
      .where(and(eq(prospectRequests.state, "received"), eq(events.status, "option"), eq(events.isDemo, false), sql`(${events.pipelineStageId} is null or ${events.pipelineStageId} = ${firstStageId})`))
      .orderBy(desc(prospectRequests.receivedAt)),
  );
}

export function countRequestsToReview(organizationId: string): Promise<{ count: number; oldest: Date | null }> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select({ count: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${prospectRequests.receivedAt})` }).from(prospectRequests).where(eq(prospectRequests.state, "to_review"));
    return { count: Number(row?.count ?? 0), oldest: row?.oldest ? new Date(row.oldest) : null };
  });
}

// Le premier client d'un évènement (nom affiché sur la carte et dans « Aujourd'hui »).
export function findFirstClientContactIds(organizationId: string, eventIds: string[]): Promise<Map<string, string | null>> {
  if (eventIds.length === 0) return Promise.resolve(new Map());
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select({ eventId: eventClients.eventId, contactId: eventClients.contactId }).from(eventClients).where(inArray(eventClients.eventId, eventIds)).orderBy(asc(eventClients.position));
    const first = new Map<string, string | null>();
    for (const row of rows) if (!first.has(row.eventId)) first.set(row.eventId, row.contactId);
    return first;
  });
}

