// Lot 70a (CHR-02, CHR-03, CHR-10, PAR-10 ; A20 ; § 3.3, 3.4) — une seule liste des tâches de
// l'organisation : celles des évènements en cours et celles hors évènement, filtrées dans la base (jamais
// en mémoire), avec le total, le nombre filtré et les retards (« 8 tâches à faire sur 42 · 2 en retard »).
// Une tâche d'un évènement annulé, clôturé ou à la corbeille n'y est pas. Exposé seulement par service.ts
// (ADR 0011).
//
// Ce que voit la personne (lot 52, A20) : la Propriétaire, et toute Planner quand le réglage est ouvert,
// voient tout ; une Planner restreinte voit les tâches des évènements de son équipe et, hors évènement,
// celles qui lui sont confiées, qu'elle a créées ou qui n'ont personne.
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { TaskListFilters, TaskListViewer } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { events, eventTasks, eventTeamMembers } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { periodRange } from "./task-filters";

export type EventTaskRowWithEvent = typeof eventTasks.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED_STATUSES = ["cancelled", "closed"] as const;

function assertId(value: string): void {
  if (!UUID.test(value)) throw new RangeError("identifiant attendu");
}

// Ce que la personne voit, sans filtre.
function visibleTo(viewer: TaskListViewer): SQL {
  const inProgress = or(isNull(eventTasks.eventId), and(isNotNull(events.id), notInArray(events.status, [...CLOSED_STATUSES])))!;
  if (viewer.role === "owner" || viewer.allPlannersSeeAll) return inProgress;
  assertId(viewer.userId);
  const teamEvents = sql`(select ${eventTeamMembers.eventId} from ${eventTeamMembers} where ${eventTeamMembers.userId} = ${viewer.userId})`;
  return and(
    inProgress,
    or(
      and(isNotNull(eventTasks.eventId), inArray(eventTasks.eventId, teamEvents)),
      and(isNull(eventTasks.eventId), or(eq(eventTasks.assigneeUserId, viewer.userId), eq(eventTasks.createdBy, viewer.userId), isNull(eventTasks.assigneeUserId))),
    ),
  )!;
}

function filtersOf(filters: TaskListFilters, viewer: TaskListViewer, today: string): SQL[] {
  const conditions: SQL[] = [];
  const state = filters.state ?? "todo";
  if (state === "todo") conditions.push(isNull(eventTasks.doneAt));
  if (state === "done") conditions.push(isNotNull(eventTasks.doneAt));
  if (filters.event?.kind === "none") conditions.push(isNull(eventTasks.eventId));
  if (filters.event?.kind === "event") {
    assertId(filters.event.eventId);
    conditions.push(eq(eventTasks.eventId, filters.event.eventId));
  }
  switch (filters.assignee?.kind) {
    case "me":
      assertId(viewer.userId);
      conditions.push(and(eq(eventTasks.responsible, "planner"), eq(eventTasks.assigneeUserId, viewer.userId))!);
      break;
    case "member":
      assertId(filters.assignee.userId);
      conditions.push(and(eq(eventTasks.responsible, "planner"), eq(eventTasks.assigneeUserId, filters.assignee.userId))!);
      break;
    case "clients":
      conditions.push(eq(eventTasks.responsible, "clients"));
      break;
    case "vendors":
      conditions.push(eq(eventTasks.responsible, "vendor"));
      break;
    case undefined:
      break;
  }
  if (filters.period) {
    const range = periodRange(filters.period, today);
    if (range.from) conditions.push(gte(eventTasks.dueDate, range.from));
    if (range.to) conditions.push(lte(eventTasks.dueDate, range.to));
  }
  if (filters.categoryId !== undefined) {
    assertId(filters.categoryId);
    conditions.push(eq(eventTasks.categoryId, filters.categoryId));
  }
  return conditions;
}

export type TaskListTotals = { total: number; todoTotal: number; todoByWho: Record<string, number> };

// Lot 70d (PAR-10) : la clé de « Qui s'en charge » d'une tâche à faire, comptée dans la base.
const whoKey = sql<string>`case
  when ${eventTasks.responsible} = 'clients' then 'clients'
  when ${eventTasks.responsible} = 'vendor' then 'vendors'
  when ${eventTasks.assigneeUserId} is null then 'nobody'
  else 'member:' || ${eventTasks.assigneeUserId}::text end`;

export async function findTaskList(input: { organizationId: string; today: string; viewer: TaskListViewer; filters: TaskListFilters }): Promise<{ rows: EventTaskRowWithEvent[] } & TaskListTotals> {
  const visible = visibleTo(input.viewer);
  const conditions = filtersOf(input.filters, input.viewer, input.today);
  const order =
    (input.filters.state ?? "todo") === "done"
      ? [sql`${eventTasks.doneAt} desc nulls last`, asc(eventTasks.dueDate), asc(eventTasks.position), asc(eventTasks.createdAt)]
      : [asc(eventTasks.dueDate), asc(eventTasks.position), asc(eventTasks.createdAt)];
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const rows = await tx
      .select({ task: eventTasks })
      .from(eventTasks)
      .leftJoin(events, eq(events.id, eventTasks.eventId))
      .where(and(visible, ...conditions))
      .orderBy(...order);
    // Lot 70d (CHR-03 crit. 3) : le total (faites comprises) et les tâches à faire de chacun, sans filtre,
    // en une seule lecture groupée.
    const groups = await tx
      .select({ who: whoKey, todo: sql<number>`count(*) filter (where ${eventTasks.doneAt} is null)::int`, all: sql<number>`count(*)::int` })
      .from(eventTasks)
      .leftJoin(events, eq(events.id, eventTasks.eventId))
      .where(visible)
      .groupBy(whoKey);
    const todoByWho: Record<string, number> = {};
    for (const group of groups) if (group.todo > 0) todoByWho[group.who] = group.todo;
    return {
      rows: rows.map((row) => row.task),
      total: groups.reduce((sum, group) => sum + group.all, 0),
      todoTotal: groups.reduce((sum, group) => sum + group.todo, 0),
      todoByWho,
    };
  });
}

// Lot 70d (UX-08, C-55) : parmi des évènements donnés, ceux qui n'ont aucune tâche (une tâche à la corbeille
// ne compte pas). La base ne montre que les évènements de l'organisation (RLS).
export async function findEventIdsWithoutTasks(organizationId: string, eventIds: string[]): Promise<string[]> {
  const ids = [...new Set(eventIds.filter((id) => UUID.test(id)).map((id) => id.toLowerCase()))];
  if (ids.length === 0) return [];
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const rows = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(inArray(events.id, ids), sql`not exists (select 1 from ${eventTasks} where ${eventTasks.eventId} = ${events.id} and ${eventTasks.deletedAt} is null)`));
    return rows.map((row) => row.id);
  });
}

// A4 : les tâches à faire qui restent au nom d'une personne (après le retrait de son accès : « 12 tâches
// restent à son nom · Les confier à… »).
export async function countOpenTasksOf(organizationId: string, userId: string): Promise<number> {
  if (!UUID.test(userId)) return 0;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ value: count() })
      .from(eventTasks)
      .leftJoin(events, eq(events.id, eventTasks.eventId))
      .where(and(eq(eventTasks.assigneeUserId, userId), isNull(eventTasks.doneAt), or(isNull(eventTasks.eventId), and(isNotNull(events.id), ne(events.status, "cancelled")))!)),
  );
  return row?.value ?? 0;
}


// Une tâche par son identifiant (la base cache celles des autres organisations et la corbeille).
export async function findEventTaskRow(organizationId: string, taskId: string): Promise<EventTaskRowWithEvent | null> {
  if (!UUID.test(taskId)) return null;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.id, taskId)));
  return row ?? null;
}
