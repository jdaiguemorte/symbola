// Lot 74b (EVT-01, CHR-01, CHR-02, DAT-07, UX-06 ; B7, L74-D2, L74-D3 ; spécification du lot 74, § 6.2 ; page 23
// des maquettes du lot 68) — le premier mariage, à l'heure, contre un vrai PostgreSQL et à l'horloge simulée :
// Camille crée le mercredi 25/11/2026 « Léa & Maxime », samedi 12/06/2027, avec le rétroplanning de départ
// (18 tâches, de J-365 à J+30), dont huit tombent avant aujourd'hui. Aucune tâche ne naît en retard. Tests
// d'abus : une réponse portant l'identifiant d'une tâche du modèle d'une autre organisation est refusée, et le
// modèle d'une autre organisation n'est pas lu.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { starterRetroplanning } from "@symbola/starter-templates";
import { isWorkingDay, publicHolidaysBetween } from "@symbola/contracts";
import { starterPublicHolidays } from "@symbola/starter-templates";
import {
  changeTasksWithUndo,
  createEventLink,
  createProspect,
  createTaskTemplate,
  eventsWithClientLink,
  getPlanningHealth,
  listEventTasks,
  listLatePlannerTasks,
  listOrganizationTasks,
  listTasks,
  taskProgressByEvent,
  TaskTemplateNotFoundError,
  TemplatePastDueInvalidError,
  undoTaskChange,
  updateEventTask,
} from "./service";

const { sql, db } = createAppConnection();
const NOW = new Date("2026-11-25T09:00:00Z");
const TODAY = "2026-11-25";
const EVENT_DATE = "2027-06-12";

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const starter = starterRetroplanning("fr");
  const template = await createTaskTemplate(organization.id, starter.name, starter.items);
  // Dans l'ordre du modèle : écart croissant, puis position.
  const items = [...template.items].sort((a, b) => a.offsetDays - b.offsetDays || a.position - b.position);
  return { organizationId: organization.id, userId: user.id, template, items };
}
type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function createWedding(planner: Planner, pastDue?: { tasks: Record<string, "done" | "todo">; spread: "2w" | "4w" | "8w" | "undated" }) {
  const { id } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: null,
    clients: [{ firstName: "Léa", lastName: "Exemple" }],
    name: "Léa & Maxime",
    eventDate: EVENT_DATE,
    taskTemplateId: planner.template.id,
    now: NOW,
    ...(pastDue ? { pastDue } : {}),
  });
  return id;
}

async function rows(planner: Planner, eventId: string) {
  return withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, eventId)));
}

const viewer = (planner: Planner) => ({ userId: planner.userId, role: "owner" as const, allPlannersSeeAll: true });

describe("EVT-01, CHR-01 — Le premier mariage, à l'heure (lot 74b, B7)", () => {
  it("critères 1 et 5 : 18 tâches, 8 avant aujourd'hui ; sans réponse, elles sont « à dater », comptées à part, hors retard, radar et santé du planning", async () => {
    const planner = await createPlanner();
    const eventId = await createWedding(planner);
    const tasks = await listEventTasks(planner.organizationId, eventId, TODAY);
    expect(tasks).toHaveLength(18);
    const undated = tasks.filter((task) => task.dueState?.kind === "undated");
    expect(undated).toHaveLength(8);
    // La date technique est celle de l'évènement ; la tâche garde son écart au jour J (DAT-07).
    for (const task of undated) {
      expect(task).toMatchObject({ dueDate: EVENT_DATE, dueDateKnown: false, done: false });
      expect(task.offsetDays).not.toBeNull();
    }
    // Critère 2 : aucune n'est en retard.
    expect(tasks.some((task) => task.dueState?.kind === "late")).toBe(false);
    const list = await listTasks({ organizationId: planner.organizationId, today: TODAY, viewer: viewer(planner) });
    expect(list.late).toBe(0);
    expect(list.undated).toBe(8);
    // Le filtre « En retard » et les périodes ne prennent pas une tâche « à dater ».
    expect((await listTasks({ organizationId: planner.organizationId, today: TODAY, viewer: viewer(planner), filters: { period: { kind: "late" } } })).tasks).toHaveLength(0);
    expect((await listTasks({ organizationId: planner.organizationId, today: "2027-06-01", viewer: viewer(planner), filters: { period: { kind: "fortnight" } } })).tasks.some((task) => task.dueDateKnown === false)).toBe(false);
    // Radar (tâches de la planner en retard), santé du planning, avancement des évènements.
    expect((await listLatePlannerTasks(planner.organizationId, "2027-07-01")).filter((row) => undated.some((task) => task.id === row.taskId))).toHaveLength(0);
    expect((await getPlanningHealth(planner.organizationId, eventId, "2027-07-01")).contributors.filter((row) => undated.some((task) => task.id === row.taskId))).toHaveLength(0);
    expect((await taskProgressByEvent(planner.organizationId, [eventId], "2027-07-01")).get(eventId)!.late).toBe(9);
    // « Aujourd'hui » ne le compte pas comme un retard.
    expect((await listOrganizationTasks({ organizationId: planner.organizationId, today: "2027-07-01", horizonDays: 0 })).filter((task) => task.overdue && task.dueDateKnown === false)).toHaveLength(0);
  });

  it("critère 3 : « Déjà fait » donne une tâche faite, date de fin non renseignée", async () => {
    const planner = await createPlanner();
    const first = planner.items[0]!;
    const eventId = await createWedding(planner, { tasks: { [first.id]: "done" }, spread: "4w" });
    const row = (await rows(planner, eventId)).find((task) => task.label === first.label && task.doneAt !== null)!;
    expect(row).toMatchObject({ doneDateKnown: false, dueDateKnown: true, doneByUserId: null });
  });

  it("critère 4 : « À faire » sur 4 semaines, entre demain et J+28, en jours ouvrés, dans l'ordre du modèle, aucune après la tâche suivante", async () => {
    const planner = await createPlanner();
    const past = planner.items.slice(0, 8);
    const eventId = await createWedding(planner, { tasks: Object.fromEntries(past.map((item) => [item.id, "todo" as const])), spread: "4w" });
    const tasks = (await listEventTasks(planner.organizationId, eventId, TODAY)).sort((a, b) => a.position - b.position);
    const redated = tasks.slice(0, 8).map((task) => task.dueDate);
    const holidays = publicHolidaysBetween(TODAY, "2027-02-28", starterPublicHolidays());
    for (const date of redated) {
      expect(date > TODAY).toBe(true);
      expect(date <= "2026-12-23").toBe(true);
      // La tâche suivante du modèle (J-180) tombe le 14/12/2026.
      expect(date <= "2026-12-14").toBe(true);
      expect(isWorkingDay(date, holidays)).toBe(true);
    }
    expect([...redated].sort()).toEqual(redated);
    expect(tasks.every((task) => task.dueState?.kind !== "late" && task.dueDateKnown !== false)).toBe(true);
  });

  it("« Laisser à dater » : les tâches à faire sont créées à dater", async () => {
    const planner = await createPlanner();
    const eventId = await createWedding(planner, { tasks: { [planner.items[0]!.id]: "todo" }, spread: "undated" });
    expect((await listEventTasks(planner.organizationId, eventId, TODAY)).filter((task) => task.dueState?.kind === "undated")).toHaveLength(8);
  });

  it("critère 6 : une tâche « à dater » redatée à la main devient une tâche ordinaire ; « Annuler » la rend « à dater »", async () => {
    const planner = await createPlanner();
    const eventId = await createWedding(planner);
    const [one, two] = (await listEventTasks(planner.organizationId, eventId, TODAY)).filter((task) => task.dueDateKnown === false);
    const updated = await updateEventTask({ organizationId: planner.organizationId, taskId: one!.id, dueDate: "2026-12-04" });
    expect(updated.dueDateKnown).toBeUndefined();
    expect((await listEventTasks(planner.organizationId, eventId, TODAY)).find((task) => task.id === one!.id)!.dueState).toEqual({ kind: "later", days: 9 });
    // Modifier le titre seulement ne la date pas.
    await updateEventTask({ organizationId: planner.organizationId, taskId: two!.id, label: "Définir le budget global avec eux", dueDate: two!.dueDate });
    expect((await listEventTasks(planner.organizationId, eventId, TODAY)).find((task) => task.id === two!.id)!.dueDateKnown).toBe(false);
    // « Changer la date » groupé, puis « Annuler ».
    const { undoId } = await changeTasksWithUndo({ organizationId: planner.organizationId, userId: planner.userId, taskIds: [two!.id], change: { kind: "setDate", date: "2026-12-10" } });
    expect((await listEventTasks(planner.organizationId, eventId, TODAY)).find((task) => task.id === two!.id)!.dueDateKnown).toBeUndefined();
    await undoTaskChange({ organizationId: planner.organizationId, userId: planner.userId, undoId: undoId! });
    expect((await listEventTasks(planner.organizationId, eventId, TODAY)).find((task) => task.id === two!.id)).toMatchObject({ dueDate: EVENT_DATE, dueDateKnown: false });
  });

  it("critère 7 : l'espace des mariés est fermé jusqu'à la création d'un lien des mariés", async () => {
    const planner = await createPlanner();
    const eventId = await createWedding(planner);
    expect((await eventsWithClientLink(planner.organizationId, [eventId])).has(eventId)).toBe(false);
    await createEventLink({ organizationId: planner.organizationId, eventId, createdByUserId: planner.userId, audience: "client", locale: "fr", link: { personName: "Léa", email: `${randomUUID()}@example.test`, rights: { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] } } });
    expect((await eventsWithClientLink(planner.organizationId, [eventId])).has(eventId)).toBe(true);
    // Une autre organisation ne lit pas ce lien.
    const other = await createPlanner();
    expect((await eventsWithClientLink(other.organizationId, [eventId])).size).toBe(0);
  });

  it("abus : une réponse portant l'identifiant d'une tâche du modèle d'une autre organisation est refusée ; son modèle n'est pas lu", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    await expect(createWedding(a, { tasks: { [b.items[0]!.id]: "done" }, spread: "4w" })).rejects.toBeInstanceOf(TemplatePastDueInvalidError);
    await expect(createWedding({ ...a, template: b.template })).rejects.toBeInstanceOf(TaskTemplateNotFoundError);
  });

  it("la veille et le jour même : une tâche due aujourd'hui n'est pas passée", async () => {
    const planner = await createPlanner();
    // Le 12/06/2026 (J-365) : la veille, la tâche est à venir ; le jour même, aussi.
    const { id } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: null, clients: [], name: "Jour même", eventDate: EVENT_DATE, taskTemplateId: planner.template.id, now: new Date("2026-06-12T08:00:00Z") });
    const tasks = await listEventTasks(planner.organizationId, id, "2026-06-12");
    expect(tasks.filter((task) => task.dueDateKnown === false)).toHaveLength(0);
    expect(tasks.filter((task) => task.dueState?.kind === "today")).toHaveLength(2);
  });
});
