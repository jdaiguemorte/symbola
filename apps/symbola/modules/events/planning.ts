// Lot 53 (CHR-10, CHR-05, HUB-24 ; D6, D8 ; ADR 0095) — tâches hors évènement et récurrentes, jalons et
// santé du planning, terme des clients par type d'évènement. Exposé seulement par service.ts (ADR 0011).
//
// - Une tâche hors évènement vit dans event_tasks, sans évènement (D6) : mêmes écrans (Tâches,
//   « Aujourd'hui »), elle peut se répéter ; l'occurrence suivante naît quand celle-ci est faite, ou à sa
//   date, une seule fois (recurrence_spawned_at).
// - La santé s'explique (CHR-05) : la liste des tâches en retard, jalons d'abord ; seuils réglables.
// - Le terme des clients (HUB-24) remplace, pour un type, les deux vocabulaires fixes de l'ADR 0045 là
//   où l'app nomme les clients, et remplit {{terme_clients}} des e-mails et des documents à venir.
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { inTrash, markDeleted } from "@symbola/db/soft-delete";
import { withOrganization } from "@symbola/db/with-organization";
import { events, eventTasks, eventTypes, eventTypeVocabulary, planningHealthSettings } from "@symbola/db/schema/events";
import { clientTermSchema, planningHealthThresholdsSchema, standaloneTaskInputSchema, taskSoonDaysSchema, type ClientTerm, type EventTypeVocabularyView, type PlanningHealthView, type StandaloneTask } from "@symbola/contracts";
import { starterClientTerms, starterPlanningHealth, starterTaskSoonDays } from "@symbola/starter-templates";
import { actingMemberId, assertAssignable, emitTaskAssignments } from "./task-assignment";
import { IN_PROGRESS_STATUSES } from "./lifecycle";
import { nextOccurrence, planningHealth, shouldSpawnNext, type HealthThresholds } from "./planning-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Locale = "fr" | "en";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class PlanningInputError extends Error {
  constructor(readonly reason: "task" | "thresholds" | "term" | "not_found") {
    super("saisie du planning refusée");
    this.name = "PlanningInputError";
  }
}

// --- Tâches hors évènement (CHR-10) ---

function toStandalone(row: typeof eventTasks.$inferSelect): StandaloneTask {
  return { id: row.id, label: row.label, dueDate: row.dueDate, recurrence: row.recurrence ?? null, done: row.doneAt !== null, doneAt: row.doneAt?.toISOString() ?? null };
}

// until : dernière échéance montrée (horizon d'« Aujourd'hui ») ; null : toutes.
export async function listStandaloneTasks(organizationId: string, options: { until?: string | null; includeDone?: boolean } = {}): Promise<StandaloneTask[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(eventTasks)
      .where(and(isNull(eventTasks.eventId), options.includeDone ? undefined : isNull(eventTasks.doneAt), options.until ? lte(eventTasks.dueDate, options.until) : undefined))
      .orderBy(asc(eventTasks.dueDate), asc(eventTasks.label)),
  );
  return rows.map(toStandalone);
}

export async function addStandaloneTask(organizationId: string, input: unknown): Promise<StandaloneTask> {
  const parsed = standaloneTaskInputSchema.safeParse(input);
  if (!parsed.success || Number.isNaN(Date.parse(`${parsed.data.dueDate}T00:00:00Z`))) throw new PlanningInputError("task");
  // Lot 70a (CHR-02 ; A3, A19) : à la personne choisie (membre actif), sinon à qui la crée.
  if (parsed.data.assigneeUserId !== undefined) await assertAssignable(organizationId, parsed.data.assigneeUserId);
  const actorId = await actingMemberId();
  const assigneeUserId = parsed.data.assigneeUserId ?? actorId;
  const row = await inOrganization(organizationId, async (tx) => {
    const [inserted] = await tx.insert(eventTasks).values({ organizationId, eventId: null, label: parsed.data.label, dueDate: parsed.data.dueDate, recurrence: parsed.data.recurrence, responsible: "planner", assigneeUserId }).returning();
    await emitTaskAssignments(tx, [{ organizationId, taskId: inserted!.id, eventId: null, before: null, after: assigneeUserId, done: false, isDemo: false, actorId }]);
    return inserted!;
  });
  return toStandalone(row);
}

// Lot 67b (CHR-10 ; recette du 24/11/2026, R02) — modifier l'intitulé, l'échéance et la répétition.
// Seule cette tâche change : une occurrence déjà faite et la suivante déjà née gardent les leurs. Une
// tâche d'évènement, supprimée ou d'une autre organisation n'est pas trouvée (RLS, event_id nul exigé).
export async function updateStandaloneTask(organizationId: string, taskId: string, input: unknown, now: Date = new Date()): Promise<StandaloneTask> {
  if (!UUID.test(taskId)) throw new PlanningInputError("not_found");
  const parsed = standaloneTaskInputSchema.safeParse(input);
  if (!parsed.success || Number.isNaN(Date.parse(`${parsed.data.dueDate}T00:00:00Z`))) throw new PlanningInputError("task");
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .update(eventTasks)
      .set({ label: parsed.data.label, dueDate: parsed.data.dueDate, recurrence: parsed.data.recurrence, updatedAt: now })
      .where(and(eq(eventTasks.id, taskId), isNull(eventTasks.eventId), isNull(eventTasks.deletedAt)))
      .returning(),
  );
  if (!row) throw new PlanningInputError("not_found");
  return toStandalone(row);
}

async function spawnNext(tx: Tx, organizationId: string, row: typeof eventTasks.$inferSelect, today: string, now: Date): Promise<boolean> {
  if (!row.recurrence || !shouldSpawnNext({ recurrence: row.recurrence, recurrenceSpawnedAt: row.recurrenceSpawnedAt, doneAt: row.doneAt, dueDate: row.dueDate }, today)) return false;
  // Une seule fois : la ligne n'est marquée que si personne ne l'a fait entre-temps.
  const claimed = await tx
    .update(eventTasks)
    .set({ recurrenceSpawnedAt: now, updatedAt: now })
    .where(and(eq(eventTasks.id, row.id), isNull(eventTasks.recurrenceSpawnedAt)))
    .returning({ id: eventTasks.id });
  if (claimed.length === 0) return false;
  // Lot 70a : la suivante garde sa personne et sa note.
  await tx.insert(eventTasks).values({ organizationId, eventId: null, label: row.label, dueDate: nextOccurrence(row.dueDate, row.recurrence), recurrence: row.recurrence, responsible: "planner", assigneeUserId: row.assigneeUserId, note: row.note });
  return true;
}

// Cocher ou décocher ; cochée, une tâche récurrente fait naître la suivante.
export async function setStandaloneTaskDone(organizationId: string, taskId: string, done: boolean, now: Date = new Date(), today: string = now.toISOString().slice(0, 10)): Promise<StandaloneTask> {
  if (!UUID.test(taskId)) throw new PlanningInputError("not_found");
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .update(eventTasks)
      .set({ doneAt: done ? now : null, updatedAt: now })
      .where(and(eq(eventTasks.id, taskId), isNull(eventTasks.eventId)))
      .returning();
    if (!row) throw new PlanningInputError("not_found");
    if (done) await spawnNext(tx, organizationId, row, today, now);
    return toStandalone(row);
  });
}

export async function deleteStandaloneTask(organizationId: string, taskId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(taskId)) throw new PlanningInputError("not_found");
  // Lot 39a (ADR 0073) : marquée dans une transaction qui voit la corbeille, la ligne en sort.
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(eventTasks).set({ ...markDeleted(now), updatedAt: now }).where(and(eq(eventTasks.id, taskId), isNull(eventTasks.eventId), isNull(eventTasks.deletedAt))).returning({ id: eventTasks.id }),
  );
  if (rows.length === 0) throw new PlanningInputError("not_found");
}

// Chaque matin : les tâches récurrentes arrivées à leur date font naître la suivante.
export async function spawnDueRecurringTasks(organizationId: string, today: string, now: Date = new Date()): Promise<number> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(eventTasks)
      .where(and(isNull(eventTasks.eventId), isNotNull(eventTasks.recurrence), isNull(eventTasks.recurrenceSpawnedAt), or(isNotNull(eventTasks.doneAt), lte(eventTasks.dueDate, today))));
    let spawned = 0;
    for (const row of rows) if (await spawnNext(tx, organizationId, row, today, now)) spawned += 1;
    return spawned;
  });
}

// --- Jalons (CHR-05) ---

export async function setTaskMilestone(organizationId: string, eventId: string, taskId: string, isMilestone: boolean): Promise<void> {
  if (!UUID.test(taskId) || !UUID.test(eventId)) throw new PlanningInputError("not_found");
  const rows = await inOrganization(organizationId, (tx) =>
    tx.update(eventTasks).set({ isMilestone, updatedAt: new Date() }).where(and(eq(eventTasks.id, taskId), eq(eventTasks.eventId, eventId))).returning({ id: eventTasks.id }),
  );
  if (rows.length === 0) throw new PlanningInputError("not_found");
}

export type LateTask = { taskId: string; eventId: string; label: string; dueDate: string; isMilestone: boolean; isDemo: boolean; eventDate: string | null };

// Tâches de la planner en retard (échéance passée, non faites), dans les évènements en cours.
export async function listLatePlannerTasks(organizationId: string, today: string): Promise<LateTask[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ task: eventTasks, isDemo: events.isDemo, eventDate: events.eventDate })
      .from(eventTasks)
      .innerJoin(events, eq(events.id, eventTasks.eventId))
      .where(and(isNull(eventTasks.doneAt), lt(eventTasks.dueDate, today), eq(eventTasks.responsible, "planner"), inArray(events.status, [...IN_PROGRESS_STATUSES]))),
  );
  return rows.map((row) => ({ taskId: row.task.id, eventId: row.task.eventId!, label: row.task.label, dueDate: row.task.dueDate, isMilestone: row.task.isMilestone, isDemo: row.isDemo, eventDate: row.eventDate }));
}

// --- Santé du planning (CHR-05) ---

// Lot 70a (UX-06, CHR-05 ; M10) — seuil de « Bientôt » d'une tâche : celui de l'organisation, sinon la
// valeur de départ (planning-health.json). L'écran de réglage attend le volet « Paramètres ».
export async function getTaskSoonDays(organizationId: string): Promise<number> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select({ soonDays: planningHealthSettings.soonDays }).from(planningHealthSettings).where(eq(planningHealthSettings.organizationId, organizationId)));
  return row?.soonDays ?? starterTaskSoonDays();
}

export async function setTaskSoonDays(organizationId: string, days: number): Promise<number> {
  if (!taskSoonDaysSchema.safeParse(days).success) throw new RangeError("seuil « Bientôt » hors de 1 à 30 jours");
  const health = starterPlanningHealth();
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(planningHealthSettings)
      .values({ organizationId, ...health, soonDays: days })
      .onConflictDoUpdate({ target: planningHealthSettings.organizationId, set: { soonDays: days, updatedAt: new Date() } }),
  );
  return days;
}

export async function getPlanningHealthThresholds(organizationId: string): Promise<HealthThresholds> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(planningHealthSettings).where(eq(planningHealthSettings.organizationId, organizationId)));
  return row ? { watchPoints: row.watchPoints, latePoints: row.latePoints, milestoneWeight: row.milestoneWeight } : starterPlanningHealth();
}

export async function setPlanningHealthThresholds(organizationId: string, input: unknown): Promise<HealthThresholds> {
  const parsed = planningHealthThresholdsSchema.safeParse(input);
  if (!parsed.success) throw new PlanningInputError("thresholds");
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(planningHealthSettings)
      .values({ organizationId, ...parsed.data })
      .onConflictDoUpdate({ target: planningHealthSettings.organizationId, set: { ...parsed.data, updatedAt: new Date() } }),
  );
  return parsed.data;
}

export async function getPlanningHealth(organizationId: string, eventId: string, today: string): Promise<PlanningHealthView> {
  if (!UUID.test(eventId)) throw new PlanningInputError("not_found");
  const [thresholds, rows] = await Promise.all([
    getPlanningHealthThresholds(organizationId),
    inOrganization(organizationId, (tx) =>
      tx
        .select({ id: eventTasks.id, label: eventTasks.label, dueDate: eventTasks.dueDate, doneAt: eventTasks.doneAt, isMilestone: eventTasks.isMilestone })
        .from(eventTasks)
        .where(and(eq(eventTasks.eventId, eventId), eq(eventTasks.responsible, "planner"))),
    ),
  ]);
  return planningHealth(
    rows.map((row) => ({ id: row.id, label: row.label, dueDate: row.dueDate, done: row.doneAt !== null, isMilestone: row.isMilestone })),
    today,
    thresholds,
  );
}

// --- Terme des clients (HUB-24, D8) ---

function starterTermFor(audience: "couple" | "clients", locale: Locale): ClientTerm {
  const terms = starterClientTerms(locale);
  const found = terms.find((term) => term.key === audience) ?? terms[0]!;
  return { term: found.term, gender: found.gender, number: found.number };
}

export function suggestedClientTerms(locale: Locale): (ClientTerm & { key: string })[] {
  return starterClientTerms(locale);
}

export async function listEventTypeVocabulary(organizationId: string): Promise<EventTypeVocabularyView[]> {
  const [types, terms] = await inOrganization(organizationId, async (tx) => [
    await tx.select().from(eventTypes).orderBy(asc(eventTypes.position), asc(eventTypes.label)),
    await tx.select().from(eventTypeVocabulary),
  ] as const);
  const termOf = (eventTypeId: string, locale: Locale): ClientTerm | null => {
    const row = terms.find((candidate) => candidate.eventTypeId === eventTypeId && candidate.locale === locale);
    return row ? { term: row.term, gender: row.gender, number: row.number } : null;
  };
  return types.map((type) => ({ eventTypeId: type.id, label: type.label, audience: type.audience, terms: { fr: termOf(type.id, "fr"), en: termOf(type.id, "en") } }));
}

// term null : revenir au vocabulaire du type (mariés ou clients).
export async function setEventTypeClientTerm(organizationId: string, input: { eventTypeId: string; locale: string; term: unknown }): Promise<void> {
  if (!UUID.test(input.eventTypeId) || (input.locale !== "fr" && input.locale !== "en")) throw new PlanningInputError("not_found");
  const locale = input.locale;
  await inOrganization(organizationId, async (tx) => {
    const [type] = await tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, input.eventTypeId));
    if (!type) throw new PlanningInputError("not_found");
    if (input.term === null) {
      await tx.delete(eventTypeVocabulary).where(and(eq(eventTypeVocabulary.eventTypeId, input.eventTypeId), eq(eventTypeVocabulary.locale, locale)));
      return;
    }
    const parsed = clientTermSchema.safeParse(input.term);
    if (!parsed.success) throw new PlanningInputError("term");
    await tx
      .insert(eventTypeVocabulary)
      .values({ organizationId, eventTypeId: input.eventTypeId, locale, ...parsed.data })
      .onConflictDoUpdate({ target: [eventTypeVocabulary.eventTypeId, eventTypeVocabulary.locale], set: { ...parsed.data, updatedAt: new Date() } });
  });
}

// Le terme qui désigne les clients d'un évènement, dans une langue : celui réglé pour son type, sinon
// celui du vocabulaire du type (mariés ou clients), sinon celui de « fallback » (le métier).
// custom : un terme réglé par l'organisation (l'écran le montre à la place du vocabulaire fixe).
export async function clientTermForEvent(organizationId: string, eventId: string, locale: Locale, fallback: "couple" | "clients" = "couple"): Promise<ClientTerm & { custom: boolean }> {
  if (!UUID.test(eventId)) return { ...starterTermFor(fallback, locale), custom: false };
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ audience: eventTypes.audience, term: eventTypeVocabulary.term, gender: eventTypeVocabulary.gender, number: eventTypeVocabulary.number })
      .from(events)
      .leftJoin(eventTypes, eq(eventTypes.id, events.eventTypeId))
      .leftJoin(eventTypeVocabulary, and(eq(eventTypeVocabulary.eventTypeId, events.eventTypeId), eq(eventTypeVocabulary.locale, locale)))
      .where(eq(events.id, eventId)),
  );
  if (row?.term && row.gender && row.number) return { term: row.term, gender: row.gender, number: row.number, custom: true };
  return { ...starterTermFor(row?.audience ?? fallback, locale), custom: false };
}
