// Lot 70c (CHR-02, CHR-03, CHR-10, UX-07 ; D3, M1, A8 ; ADR 0120) — ce que lisent et changent la ligne type
// et le panneau unique d'une tâche, contre un vrai PostgreSQL (RLS), par la porte d'entrée du module : la
// tâche lue pour son panneau (d'évènement ou non, avec sa répétition et son état d'échéance) ; « Fait » qui
// enregistre aussi les changements en cours (une seule écriture, l'auteur de la coche posé par la base) ;
// « Annuler » d'un changement de date, qui rend la date et l'état « date relative » d'avant ; la date
// « {n} jours avant le jour J » qui garde la tâche relative. Tests d'abus (CLAUDE.md § 2.11) : une
// organisation ne lit ni ne change la tâche d'une autre ; un identifiant inventé ou effacé n'ouvre rien.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { createAppConnection } from "@symbola/db/client";
import { dueFromDaysBefore } from "@/lib/tasks/task-panel-model";
import {
  addEventTask,
  addStandaloneTask,
  changeTasksWithUndo,
  createProspect,
  createProspectSource,
  getTask,
  listEventTasks,
  removeEventTask,
  undoTaskChange,
  updateEventTask,
} from "./service";

const EVENT_DATE = "2027-06-12";
const TODAY = "2027-03-10";

async function agency() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Agence ${randomUUID().slice(0, 8)}`);
    const camille = (await createUser(db, { organizationId: organization.id, email: `camille-${randomUUID()}@example.test`, role: "owner" })).id;
    return { organizationId: organization.id, camille };
  } finally {
    await sql.end();
  }
}

const as = <T>(userId: string, fn: () => Promise<T>) => withActor({ kind: "member", id: userId }, fn);

async function wedding(organizationId: string, createdByUserId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Petit" }], eventDate: EVENT_DATE });
  return event.id;
}

describe("CHR-02 — Le panneau unique lit une tâche, d'évènement ou non (lot 70c)", () => {
  it("une tâche d'évènement : son évènement, son état d'échéance, sans répétition", async () => {
    const { organizationId, camille } = await agency();
    const eventId = await wedding(organizationId, camille);
    const task = await as(camille, () => addEventTask(organizationId, eventId, { label: "Choisir le fleuriste", dueDate: "2027-03-14", responsible: "clients" }));
    const read = await getTask(organizationId, task.id, TODAY);
    expect(read?.event).toMatchObject({ id: eventId, names: "Léa & Maxime", eventDate: EVENT_DATE });
    expect(read?.dueState).toEqual({ kind: "soon", days: 4 });
    expect(read?.recurrence).toBeNull();
    expect(read?.responsible).toBe("clients");
  });

  it("une tâche hors évènement : sans évènement, avec sa répétition", async () => {
    const { organizationId, camille } = await agency();
    const task = await as(camille, () => addStandaloneTask(organizationId, { label: "Déclaration de TVA", dueDate: "2027-03-09", recurrence: "quarterly" }));
    const read = await getTask(organizationId, task.id, TODAY);
    expect(read).toMatchObject({ eventId: null, event: null, recurrence: "quarterly", assigneeUserId: camille, dueState: { kind: "late", days: 1 } });
  });

  it("abus : la tâche d'une autre organisation, un identifiant inventé ou une tâche à la corbeille n'ouvrent rien", async () => {
    const a = await agency();
    const b = await agency();
    const eventId = await wedding(a.organizationId, a.camille);
    const task = await as(a.camille, () => addEventTask(a.organizationId, eventId, { label: "Confirmer la voiture", dueDate: "2027-03-01", responsible: "planner" }));
    expect(await getTask(b.organizationId, task.id, TODAY)).toBeNull();
    expect(await getTask(a.organizationId, randomUUID(), TODAY)).toBeNull();
    expect(await getTask(a.organizationId, "pas-un-identifiant", TODAY)).toBeNull();
    await removeEventTask(a.organizationId, task.id);
    expect(await getTask(a.organizationId, task.id, TODAY)).toBeNull();
  });

  it("abus : une autre organisation ne change ni la date ni la personne d'une tâche, et n'en rend pas les valeurs d'avant", async () => {
    const a = await agency();
    const b = await agency();
    const eventId = await wedding(a.organizationId, a.camille);
    const task = await as(a.camille, () => addEventTask(a.organizationId, eventId, { label: "Confirmer la voiture", dueDate: "2027-03-01", responsible: "planner" }));
    const foreign = await as(b.camille, () => changeTasksWithUndo({ organizationId: b.organizationId, userId: b.camille, taskIds: [task.id], change: { kind: "setDate", date: "2027-04-01" } }));
    expect(foreign.changed).toBe(0);
    const own = await as(a.camille, () => changeTasksWithUndo({ organizationId: a.organizationId, userId: a.camille, taskIds: [task.id], change: { kind: "setDate", date: "2027-04-01" } }));
    expect(await undoTaskChange({ organizationId: b.organizationId, userId: b.camille, undoId: own.undoId! })).toBe(0);
    expect((await getTask(a.organizationId, task.id, TODAY))?.dueDate).toBe("2027-04-01");
  });
});

describe("CHR-02, CHR-04, UX-09 — « Fait » enregistre aussi les changements en cours (lot 70c, M1)", () => {
  it("la note, l'échéance et la coche partent ensemble ; la base note qui a coché", async () => {
    const { organizationId, camille } = await agency();
    const eventId = await wedding(organizationId, camille);
    const task = await as(camille, () => addEventTask(organizationId, eventId, { label: "Choisir le fleuriste", dueDate: "2027-03-14", responsible: "planner" }));
    await as(camille, () => updateEventTask({ organizationId, taskId: task.id, note: "Trois devis demandés", dueDate: "2027-03-15", done: true }));
    const read = await getTask(organizationId, task.id, TODAY);
    expect(read).toMatchObject({ note: "Trois devis demandés", dueDate: "2027-03-15", done: true, doneBy: { kind: "member", userId: camille } });
  });
});

describe("CHR-02, UX-07, DAT-07 — « Changer la date » et son « Annuler » (lot 70c)", () => {
  it("un raccourci fixe la date ; « Annuler » rend la date et l'état « date relative » d'avant", async () => {
    const { organizationId, camille } = await agency();
    const eventId = await wedding(organizationId, camille);
    const task = await as(camille, () => addEventTask(organizationId, eventId, { label: "Confirmer la voiture", dueDate: "2027-05-13", responsible: "planner" }));
    const before = (await listEventTasks(organizationId, eventId)).find((candidate) => candidate.id === task.id)!;
    expect(before.fixed).toBe(false);
    const { undoId } = await as(camille, () => changeTasksWithUndo({ organizationId, userId: camille, taskIds: [task.id], change: { kind: "setDate", date: "2027-05-17" } }));
    const moved = (await listEventTasks(organizationId, eventId)).find((candidate) => candidate.id === task.id)!;
    expect(moved).toMatchObject({ dueDate: "2027-05-17", fixed: true });
    expect(await undoTaskChange({ organizationId, userId: camille, undoId: undoId! })).toBe(1);
    const back = (await listEventTasks(organizationId, eventId)).find((candidate) => candidate.id === task.id)!;
    expect(back).toMatchObject({ dueDate: "2027-05-13", fixed: false });
  });

  it("A8 : créée « 30 jours avant le jour J », la tâche reste relative à la date de l'évènement", async () => {
    const { organizationId, camille } = await agency();
    const eventId = await wedding(organizationId, camille);
    const dueDate = dueFromDaysBefore(EVENT_DATE, 30);
    const task = await as(camille, () => addEventTask(organizationId, eventId, { label: "Réserver la navette", dueDate, responsible: "planner" }));
    const read = (await listEventTasks(organizationId, eventId)).find((candidate) => candidate.id === task.id)!;
    expect(read).toMatchObject({ dueDate: "2027-05-13", offsetDays: -30, fixed: false });
  });
});
