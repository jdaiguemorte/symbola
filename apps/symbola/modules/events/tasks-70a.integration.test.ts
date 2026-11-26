// Lot 70a (CHR-02, CHR-03, CHR-04, CHR-10, UX-06, UX-07, HUB-15, HUB-17 ; A1 à A5, A7, A9, A18 à A20,
// Q47-4) — les données des tâches contre un vrai PostgreSQL (RLS), par la porte d'entrée du module :
// la personne qui s'en charge, qui a coché, la note, la liste unique filtrée et comptée, le seuil
// « Bientôt », la Corbeille des tâches, « Annuler » un changement de date ou de personne, et la
// notification « Une tâche vous est confiée ». Tests d'abus (CLAUDE.md § 2.11) : une organisation ne
// lit ni ne change les tâches, notes, auteurs ou valeurs d'avant d'une autre ; une tâche ne se confie
// jamais à un compte d'ailleurs, retiré ou inventé ; un lien ne coche que les tâches de son évènement ;
// une Planner restreinte ne voit pas les tâches d'un évènement hors de son équipe.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser, setUserNames } from "@symbola/auth";
import { EVT_TASK_ASSIGNED, type EventLinkRights, type TaskListFilters, type TaskListViewer } from "@symbola/contracts";
import { withActor } from "@symbola/db/actor";
import { appDatabase, createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { NOTIFICATION_CONSUMERS } from "@/lib/notification-sources";
import { purgeOrganizationTrash, restoreFromTrash } from "@/lib/trash";
import { listNotifications, notificationText, setNotificationPreference } from "@/modules/hub/service";
import {
  addEventTask,
  addStandaloneTask,
  changeEventStatus,
  changeEventTasks,
  changeTasksWithUndo,
  countOpenTasksAssignedTo,
  createEventLink,
  createProspect,
  createProspectSource,
  EventTaskNotFoundError,
  listEventTasks,
  listTasks,
  listTrashedEventObjects,
  removeEventTask,
  removeEventTasks,
  setEventTeamMember,
  setLinkTaskDone,
  setTaskSoonDays,
  TaskAssigneeNotFoundError,
  TaskNoteInvalidError,
  undoTaskChange,
  updateEventTask,
  LinkAccessDeniedError,
} from "./service";

const EVENT_DATE = "2027-06-12";
const TODAY = "2027-03-10";

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

// Une agence : Camille (titulaire), Bastien et Léa (Planners), un Comptable, et un ancien collègue retiré.
async function agency() {
  return withDb(async (db) => {
    const organization = await createOrganization(db, `Agence ${randomUUID().slice(0, 8)}`);
    const make = async (role: "owner" | "member" | "accountant", name: string) => (await createUser(db, { organizationId: organization.id, email: `${name}-${randomUUID()}@example.test`, role })).id;
    const camille = await make("owner", "camille");
    const bastien = await make("member", "bastien");
    const lea = await make("member", "lea");
    const accountant = await make("accountant", "compta");
    await setUserNames(db, camille, { firstName: "Camille", lastName: "Durand" });
    await setUserNames(db, bastien, { firstName: "Bastien", lastName: "Leroy" });
    return { organizationId: organization.id, camille, bastien, lea, accountant };
  });
}

const as = <T>(userId: string, fn: () => Promise<T>) => withActor({ kind: "member", id: userId }, fn);

async function wedding(organizationId: string, createdByUserId: string, firstName = "Léa") {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId, prospectSourceId: source.id, clients: [{ firstName, lastName: "Martin" }], eventDate: EVENT_DATE });
  return event.id;
}

const ownerView = (userId: string): TaskListViewer => ({ userId, role: "owner", allPlannersSeeAll: true });
const plannerView = (userId: string, allPlannersSeeAll = true): TaskListViewer => ({ userId, role: "member", allPlannersSeeAll });

async function list(organizationId: string, viewer: TaskListViewer, filters: TaskListFilters = {}) {
  return listTasks({ organizationId, today: TODAY, viewer, filters });
}

async function publishedAssignments(organizationId: string) {
  return withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_TASK_ASSIGNED))));
}

async function consumeAssignments(organizationId: string) {
  for (const row of await publishedAssignments(organizationId)) {
    await NOTIFICATION_CONSUMERS[EVT_TASK_ASSIGNED]!({ id: row.id, organizationId: row.organizationId, name: row.name, version: row.version, payload: row.payload, occurredAt: row.occurredAt });
  }
}

describe("CHR-02 — Qui s'en charge : un collègue (critères 1 à 3)", () => {
  it("une tâche se confie à un membre actif ; il la voit dans « Mes tâches », les autres sous son nom", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Réserver la navette", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    expect(task.assigneeUserId).toBe(team.bastien);
    const mine = await list(team.organizationId, plannerView(team.bastien), { assignee: { kind: "me" } });
    expect(mine.tasks.map((row) => row.id)).toEqual([task.id]);
    const byName = await list(team.organizationId, ownerView(team.camille), { assignee: { kind: "member", userId: team.bastien } });
    expect(byName.tasks.map((row) => row.id)).toEqual([task.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { assignee: { kind: "me" } })).tasks).toEqual([]);
  });

  it("A3 : sans choix, une tâche « planner » est à la personne qui la crée ; une tâche des clients n'a personne", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const mine = await as(team.lea, () => addEventTask(team.organizationId, eventId, { label: "Choisir le photographe", dueDate: "2027-03-20", responsible: "planner" }));
    expect(mine.assigneeUserId).toBe(team.lea);
    const theirs = await as(team.lea, () => addEventTask(team.organizationId, eventId, { label: "Envoyer la liste des invités", dueDate: "2027-03-20", responsible: "clients" }));
    expect(theirs.assigneeUserId).toBeNull();
    const standalone = await as(team.bastien, () => addStandaloneTask(team.organizationId, { label: "Déclaration de TVA", dueDate: "2027-04-15", recurrence: "quarterly" }));
    expect((await list(team.organizationId, ownerView(team.camille), { event: { kind: "none" } })).tasks.find((row) => row.id === standalone.id)?.assigneeUserId).toBe(team.bastien);
  });

  it("abus : un compte d'une autre organisation, un accès retiré, un Comptable ou un identifiant inventé sont refusés, comme un objet inexistant", async () => {
    const team = await agency();
    const other = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Relancer le traiteur", dueDate: "2027-03-12", responsible: "planner" }));
    await withDb((db) => import("@symbola/auth").then(({ removeMember }) => removeMember(db, { organizationId: team.organizationId, userId: team.lea, removedByUserId: team.camille })));
    for (const stranger of [other.bastien, team.lea, team.accountant, randomUUID(), "pas-un-identifiant"]) {
      const refused = await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, assigneeUserId: stranger })).catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(TaskAssigneeNotFoundError);
      expect((refused as Error).message).toBe(new EventTaskNotFoundError().message);
      await expect(as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Autre", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: stranger }))).rejects.toBeInstanceOf(TaskAssigneeNotFoundError);
    }
    await expect(as(team.camille, () => changeEventTasks(team.organizationId, [task.id], { kind: "assign", userId: other.bastien }))).rejects.toBeInstanceOf(TaskAssigneeNotFoundError);
    expect((await listEventTasks(team.organizationId, eventId)).find((row) => row.id === task.id)?.assigneeUserId).toBe(team.camille);
    // Le filtre sur un membre d'une autre organisation ne rend rien.
    expect((await list(team.organizationId, ownerView(team.camille), { assignee: { kind: "member", userId: other.bastien } })).tasks).toEqual([]);
  });

  it("A4 : les tâches d'un accès retiré restent à son nom, et se comptent pour les confier à quelqu'un", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Visiter le domaine", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.lea }));
    await withDb((db) => import("@symbola/auth").then(({ removeMember }) => removeMember(db, { organizationId: team.organizationId, userId: team.lea, removedByUserId: team.camille })));
    expect(await countOpenTasksAssignedTo(team.organizationId, team.lea)).toBe(1);
    expect((await listEventTasks(team.organizationId, eventId))[0]?.assigneeUserId).toBe(team.lea);
  });

  it("passer la tâche aux clients efface la personne ; la reprendre la redonne à qui agit", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Choisir le menu", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    expect((await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, responsible: "clients" }))).assigneeUserId).toBeNull();
    expect((await as(team.lea, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, responsible: "planner" }))).assigneeUserId).toBe(team.lea);
  });
});

describe("CHR-04 — Cochée par (critère 4)", () => {
  it("cocher garde qui l'a fait ; « Rouvrir » efface la date et l'auteur ; un lot coché garde chacun", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Signer le traiteur", dueDate: "2027-03-12", responsible: "planner" }));
    const done = await as(team.bastien, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, done: true }));
    expect(done.doneBy).toEqual({ kind: "member", userId: team.bastien });
    expect(done.doneAt).not.toBeNull();
    const reopened = await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, done: false }));
    expect(reopened).toMatchObject({ done: false, doneAt: null, doneBy: null });
    const other = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Choisir les fleurs", dueDate: "2027-03-13", responsible: "planner" }));
    expect(await as(team.lea, () => changeEventTasks(team.organizationId, [task.id, other.id], { kind: "done" }))).toBe(2);
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => row.doneBy)).toEqual([{ kind: "member", userId: team.lea }, { kind: "member", userId: team.lea }]);
  });

  it("le lien des mariés coche « par les clients », jamais avec un identifiant ; il ne coche pas la tâche d'un autre évènement", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const otherEventId = await wedding(team.organizationId, team.camille, "Inès");
    const rights: EventLinkRights = { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] };
    const { link } = await createEventLink({ organizationId: team.organizationId, eventId, createdByUserId: team.camille, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lien-${randomUUID()}@example.test`, rights } });
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Envoyer la liste", dueDate: "2027-03-12", responsible: "clients" }));
    const foreign = await as(team.camille, () => addEventTask(team.organizationId, otherEventId, { label: "Envoyer le plan", dueDate: "2027-03-12", responsible: "clients" }));
    const ticked = await setLinkTaskDone(team.organizationId, link.id, task.id, true);
    expect(ticked.doneBy).toEqual({ kind: "clients", userId: null });
    await expect(setLinkTaskDone(team.organizationId, link.id, foreign.id, true)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect((await listEventTasks(team.organizationId, otherEventId))[0]?.doneBy).toBeNull();
  });
});

describe("CHR-03, CHR-10 — Une seule liste, filtrée et comptée (critère 5)", () => {
  it("rend ensemble les tâches d'évènement et hors évènement, avec le total, le nombre filtré et les retards", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const late = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "En retard", dueDate: "2027-03-05", responsible: "planner" }));
    const soon = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Bientôt", dueDate: "2027-03-14", responsible: "clients" }));
    const done = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Faite", dueDate: "2027-03-01", responsible: "planner" }));
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: done.id, done: true }));
    const vat = await as(team.camille, () => addStandaloneTask(team.organizationId, { label: "Déclaration de TVA", dueDate: "2027-04-15", recurrence: null }));
    const all = await list(team.organizationId, ownerView(team.camille));
    expect(all.tasks.map((row) => row.id)).toEqual([late.id, soon.id, vat.id]);
    expect(all).toMatchObject({ total: 4, filtered: 3, late: 1, soonDays: 7 });
    expect(all.tasks[0]).toMatchObject({ dueState: { kind: "late", days: 5 }, event: { id: eventId, names: "Léa" } });
    expect(all.tasks[1]?.dueState).toEqual({ kind: "soon", days: 4 });
    expect(all.tasks[2]).toMatchObject({ eventId: null, event: null, dueState: { kind: "later", days: 36 } });
    expect((await list(team.organizationId, ownerView(team.camille), { event: { kind: "none" } })).tasks.map((row) => row.id)).toEqual([vat.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { event: { kind: "event", eventId } })).tasks.map((row) => row.id)).toEqual([late.id, soon.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { assignee: { kind: "clients" } })).tasks.map((row) => row.id)).toEqual([soon.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { period: { kind: "late" } })).tasks.map((row) => row.id)).toEqual([late.id]);
    // Cette semaine : du lundi 8 au dimanche 14 mars 2027 ; les quinze prochains jours comptent les retards.
    expect((await list(team.organizationId, ownerView(team.camille), { period: { kind: "week" } })).tasks.map((row) => row.id)).toEqual([soon.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { period: { kind: "fortnight" } })).tasks.map((row) => row.id)).toEqual([late.id, soon.id]);
    expect((await list(team.organizationId, ownerView(team.camille), { period: { kind: "between", from: "2027-04-01", to: "2027-04-30" } })).tasks.map((row) => row.id)).toEqual([vat.id]);
    const doneList = await list(team.organizationId, ownerView(team.camille), { state: "done" });
    expect(doneList.tasks.map((row) => row.id)).toEqual([done.id]);
    expect(doneList.tasks[0]).toMatchObject({ dueState: null, doneBy: { kind: "member", userId: team.camille } });
  });

  it("les tâches faites se rangent de la plus récente à la plus ancienne ; une période mal formée est refusée", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const first = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Première", dueDate: "2027-03-20", responsible: "planner" }));
    const second = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Seconde", dueDate: "2027-03-01", responsible: "planner" }));
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: first.id, done: true }));
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: second.id, done: true }));
    expect((await list(team.organizationId, ownerView(team.camille), { state: "done" })).tasks.map((row) => row.id)).toEqual([second.id, first.id]);
    await expect(list(team.organizationId, ownerView(team.camille), { period: { kind: "between", from: "2027-05-01", to: "2027-04-01" } })).rejects.toBeInstanceOf(RangeError);
    await expect(list(team.organizationId, ownerView(team.camille), { categoryId: "pas-un-identifiant" })).rejects.toBeInstanceOf(RangeError);
  });

  it("une tâche d'un évènement annulé ou clôturé n'y est pas (règle gardée)", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Contrat", dueDate: "2027-03-12", responsible: "planner" }));
    await changeEventStatus({ organizationId: team.organizationId, eventId, toStatus: "cancelled", changedByUserId: team.camille });
    expect((await list(team.organizationId, ownerView(team.camille))).tasks).toEqual([]);
  });

  it("A20 : une Planner restreinte voit les tâches de ses évènements et, hors évènement, les siennes, celles qu'elle a créées ou sans personne", async () => {
    const team = await agency();
    const hers = await wedding(team.organizationId, team.camille);
    const notHers = await wedding(team.organizationId, team.camille, "Inès");
    await setEventTeamMember({ organizationId: team.organizationId, eventId: hers, userId: team.lea, role: "assistant", byUserId: team.camille });
    const visible = await as(team.camille, () => addEventTask(team.organizationId, hers, { label: "Visible", dueDate: "2027-03-12", responsible: "planner" }));
    await as(team.camille, () => addEventTask(team.organizationId, notHers, { label: "Cachée", dueDate: "2027-03-12", responsible: "planner" }));
    const toLea = await as(team.camille, () => addStandaloneTask(team.organizationId, { label: "Assurance", dueDate: "2027-03-12", recurrence: null, assigneeUserId: team.lea }));
    const byLea = await as(team.lea, () => addStandaloneTask(team.organizationId, { label: "Comptabilité", dueDate: "2027-03-12", recurrence: null, assigneeUserId: team.bastien }));
    await as(team.camille, () => addStandaloneTask(team.organizationId, { label: "Banque", dueDate: "2027-03-12", recurrence: null }));
    const restricted = await list(team.organizationId, plannerView(team.lea, false));
    expect(restricted.tasks.map((row) => row.id).sort()).toEqual([visible.id, toLea.id, byLea.id].sort());
    expect(restricted.total).toBe(3);
    // Filtrer sur l'évènement caché ne le révèle pas.
    expect((await list(team.organizationId, plannerView(team.lea, false), { event: { kind: "event", eventId: notHers } })).tasks).toEqual([]);
    // Réglage ouvert : toute l'équipe voit tout.
    expect((await list(team.organizationId, plannerView(team.lea, true))).tasks).toHaveLength(5);
  });
});

describe("UX-06, CHR-05 — Seuil « Bientôt » réglé par l'organisation (critère 6, M10)", () => {
  it("7 jours au départ ; réglé à 3, la liste le suit ; hors de 1 à 30, refusé", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Dans cinq jours", dueDate: "2027-03-15", responsible: "planner" }));
    expect((await list(team.organizationId, ownerView(team.camille))).tasks[0]?.dueState).toEqual({ kind: "soon", days: 5 });
    await setTaskSoonDays(team.organizationId, 3);
    const after = await list(team.organizationId, ownerView(team.camille));
    expect(after.soonDays).toBe(3);
    expect(after.tasks[0]?.dueState).toEqual({ kind: "later", days: 5 });
    await expect(setTaskSoonDays(team.organizationId, 31)).rejects.toBeInstanceOf(RangeError);
  });
});

describe("HUB-17, UX-07 — La Corbeille des tâches (critère 7, A5, ADR 0116)", () => {
  it("une tâche supprimée reste trente jours dans la Corbeille et se restaure à sa place ; la purge l'efface ensuite", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Confirmer la voiture", dueDate: "2027-03-12", responsible: "planner", note: "Clés chez le témoin" }));
    await as(team.camille, () => removeEventTask(team.organizationId, task.id));
    const [line] = (await listTrashedEventObjects(team.organizationId)).filter((row) => row.kind === "task");
    expect(line).toMatchObject({ kind: "task", id: task.id, label: "Confirmer la voiture", eventId, deletedBy: team.camille });
    expect(line?.count ?? 1).toBe(1);
    // Onze minutes après : l'ancienne purge des éléments ne l'emporte plus.
    await purgeOrganizationTrash(team.organizationId, new Date(Date.now() + 11 * 60 * 1000));
    await restoreFromTrash(team.organizationId, "task", task.id);
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => [row.id, row.note])).toEqual([[task.id, "Clés chez le témoin"]]);
    await as(team.camille, () => removeEventTask(team.organizationId, task.id));
    await purgeOrganizationTrash(team.organizationId, new Date(Date.now() + 29 * 24 * 60 * 60 * 1000));
    expect((await listTrashedEventObjects(team.organizationId)).filter((row) => row.kind === "task")).toHaveLength(1);
    await purgeOrganizationTrash(team.organizationId, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
    expect((await listTrashedEventObjects(team.organizationId)).filter((row) => row.kind === "task")).toHaveLength(0);
  });

  it("un lot supprimé y est une seule ligne, qui rend toutes ses tâches ; une autre organisation ne le restaure pas", async () => {
    const team = await agency();
    const other = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const ids: string[] = [];
    for (const label of ["Un", "Deux", "Trois"]) ids.push((await as(team.camille, () => addEventTask(team.organizationId, eventId, { label, dueDate: "2027-03-12", responsible: "planner" }))).id);
    await as(team.camille, () => removeEventTasks(team.organizationId, ids));
    const lines = (await listTrashedEventObjects(team.organizationId)).filter((row) => row.kind === "task");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ count: 3, label: "Léa", eventId });
    await expect(restoreFromTrash(other.organizationId, "task", lines[0]!.id)).rejects.toThrow();
    await restoreFromTrash(team.organizationId, "task", lines[0]!.id);
    expect(await listEventTasks(team.organizationId, eventId)).toHaveLength(3);
  });
});

describe("CHR-02 — Note interne (critère 8, A7)", () => {
  it("une note s'enregistre et se relit ; trop longue ou avec un caractère de contrôle, refusée ; jamais dans un lien", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Plan de table", dueDate: "2027-03-12", responsible: "clients" }));
    const noted = await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, note: "  Ne pas placer Paul près de Marc.\nVoir avec Léa.  " }));
    expect(noted.note).toBe("Ne pas placer Paul près de Marc.\nVoir avec Léa.");
    expect((await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, note: "   " }))).note).toBeNull();
    await expect(as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, note: "x".repeat(2001) }))).rejects.toBeInstanceOf(TaskNoteInvalidError);
    await expect(as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, note: "bip\u0007" }))).rejects.toBeInstanceOf(TaskNoteInvalidError);
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, note: "Secret de l'agence" }));
    const rights: EventLinkRights = { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] };
    const { link } = await createEventLink({ organizationId: team.organizationId, eventId, createdByUserId: team.camille, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lien-${randomUUID()}@example.test`, rights } });
    const ticked = await setLinkTaskDone(team.organizationId, link.id, task.id, true);
    expect(JSON.stringify(ticked)).not.toContain("Secret de l'agence");
  });

  it("abus : une autre organisation ne lit ni ne change la note, la personne ou l'auteur d'une tâche", async () => {
    const team = await agency();
    const other = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Plan B pluie", dueDate: "2027-03-12", responsible: "planner", note: "Tente réservée" }));
    await expect(as(other.camille, () => updateEventTask({ organizationId: other.organizationId, taskId: task.id, note: "Volée" }))).rejects.toBeInstanceOf(EventTaskNotFoundError);
    await expect(as(other.camille, () => updateEventTask({ organizationId: other.organizationId, taskId: task.id, assigneeUserId: other.bastien }))).rejects.toThrow();
    expect(await as(other.camille, () => changeEventTasks(other.organizationId, [task.id], { kind: "done" }))).toBe(0);
    expect((await list(other.organizationId, ownerView(other.camille))).tasks).toEqual([]);
    expect((await listEventTasks(team.organizationId, eventId))[0]).toMatchObject({ note: "Tente réservée", assigneeUserId: team.camille, done: false });
  });
});

describe("UX-07 — « Annuler » un changement de date ou de personne (A18)", () => {
  it("rend les dates, l'état « fixée » et les personnes d'avant ; seulement pour qui a fait le geste, dans son organisation", async () => {
    const team = await agency();
    const other = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const a = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "A", dueDate: "2027-03-12", responsible: "planner" }));
    const b = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "B", dueDate: "2027-03-13", responsible: "planner", assigneeUserId: team.bastien }));
    const moved = await as(team.camille, () => changeTasksWithUndo({ organizationId: team.organizationId, userId: team.camille, taskIds: [a.id, b.id], change: { kind: "setDate", date: "2027-04-01" } }));
    expect(moved.changed).toBe(2);
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => [row.dueDate, row.fixed])).toEqual([["2027-04-01", true], ["2027-04-01", true]]);
    expect(await undoTaskChange({ organizationId: other.organizationId, userId: other.camille, undoId: moved.undoId! })).toBe(0);
    expect(await undoTaskChange({ organizationId: team.organizationId, userId: team.bastien, undoId: moved.undoId! })).toBe(0);
    expect(await undoTaskChange({ organizationId: team.organizationId, userId: team.camille, undoId: moved.undoId! })).toBe(2);
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => [row.dueDate, row.fixed])).toEqual([["2027-03-12", false], ["2027-03-13", false]]);
    // Une seule fois.
    expect(await undoTaskChange({ organizationId: team.organizationId, userId: team.camille, undoId: moved.undoId! })).toBe(0);
    const assigned = await as(team.camille, () => changeTasksWithUndo({ organizationId: team.organizationId, userId: team.camille, taskIds: [a.id, b.id], change: { kind: "assign", userId: team.lea } }));
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => row.assigneeUserId)).toEqual([team.lea, team.lea]);
    expect(await undoTaskChange({ organizationId: team.organizationId, userId: team.camille, undoId: assigned.undoId! })).toBe(2);
    expect((await listEventTasks(team.organizationId, eventId)).map((row) => row.assigneeUserId)).toEqual([team.camille, team.bastien]);
  });

  it("passé dix minutes, « Annuler » ne répond plus", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const a = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "A", dueDate: "2027-03-12", responsible: "planner" }));
    const moved = await as(team.camille, () => changeTasksWithUndo({ organizationId: team.organizationId, userId: team.camille, taskIds: [a.id], change: { kind: "setDate", date: "2027-04-01" }, now: new Date(Date.now() - 11 * 60 * 1000) }));
    expect(await undoTaskChange({ organizationId: team.organizationId, userId: team.camille, undoId: moved.undoId! })).toBe(0);
  });
});

describe("HUB-15, CHR-02 — Une tâche vous est confiée (critères 9 et 10, A19)", () => {
  it("confier une tâche à Bastien la lui annonce une fois, même rejouée ; le nom de qui confie est lu à l'affichage", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Réserver la navette", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    const published = await publishedAssignments(team.organizationId);
    expect(published).toHaveLength(1);
    expect(published[0]!.payload).toEqual({ taskId: expect.any(String), eventId, assigneeUserId: team.bastien, assignedByUserId: team.camille });
    await consumeAssignments(team.organizationId);
    await consumeAssignments(team.organizationId);
    const received = await listNotifications(team.organizationId, team.bastien);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "task_assigned", href: expect.stringMatching(/^\/taches\?tache=/) });
    expect(JSON.stringify(received[0]!.params)).not.toContain("Camille");
    expect(notificationText(received[0]!, "fr", new Map([[team.camille, "Camille"]]))).toBe("Camille vous a confié « Réserver la navette ».");
    expect(await listNotifications(team.organizationId, team.camille)).toEqual([]);
  });

  it("se confier une tâche, confier une tâche faite ou d'un évènement de démonstration : aucune notification", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    await as(team.bastien, () => addEventTask(team.organizationId, eventId, { label: "Pour moi", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    const done = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Déjà faite", dueDate: "2027-03-12", responsible: "planner" }));
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: done.id, done: true }));
    await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: done.id, assigneeUserId: team.bastien }));
    const demo = await withDb((db) =>
      withOrganization(db, team.organizationId, async (tx) => {
        const { events } = await import("@symbola/db/schema/events");
        const [row] = await tx.insert(events).values({ organizationId: team.organizationId, isDemo: true, eventDate: EVENT_DATE }).returning({ id: events.id });
        return row!.id;
      }),
    );
    await as(team.camille, () => addEventTask(team.organizationId, demo, { label: "Démo", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    expect(await publishedAssignments(team.organizationId)).toEqual([]);
  });

  it("une écriture refusée ne publie rien (même transaction)", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const task = await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Fleurs", dueDate: "2027-03-12", responsible: "planner" }));
    await expect(as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: task.id, assigneeUserId: team.bastien, categoryId: randomUUID() }))).rejects.toThrow();
    expect(await publishedAssignments(team.organizationId)).toEqual([]);
  });

  it("un lot de trois tâches donne une seule notification « 3 tâches vous ont été confiées »", async () => {
    const team = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    const ids: string[] = [];
    for (const label of ["Un", "Deux", "Trois"]) ids.push((await as(team.camille, () => addEventTask(team.organizationId, eventId, { label, dueDate: "2027-03-12", responsible: "planner" }))).id);
    await as(team.camille, () => changeEventTasks(team.organizationId, ids, { kind: "assign", userId: team.bastien }));
    expect(await publishedAssignments(team.organizationId)).toHaveLength(3);
    await consumeAssignments(team.organizationId);
    const received = await listNotifications(team.organizationId, team.bastien);
    expect(received).toHaveLength(1);
    expect(notificationText(received[0]!, "fr", new Map([[team.camille, "Camille"]]))).toBe("3 tâches vous ont été confiées par Camille.");
    expect(received[0]!.href).toBe("/taches?qui=moi");
  });

  it("coupée dans ses réglages, la sorte n'arrive plus ; un événement d'une organisation ne notifie jamais un membre d'une autre", async () => {
    const team = await agency();
    const other = await agency();
    const eventId = await wedding(team.organizationId, team.camille);
    for (const channel of ["app", "email", "push"]) await setNotificationPreference(team.organizationId, team.bastien, { type: "task_assigned", channel, enabled: false });
    await as(team.camille, () => addEventTask(team.organizationId, eventId, { label: "Coupée", dueDate: "2027-03-12", responsible: "planner", assigneeUserId: team.bastien }));
    await consumeAssignments(team.organizationId);
    expect(await listNotifications(team.organizationId, team.bastien)).toEqual([]);
    // Charge forgée : le destinataire n'est pas membre de l'organisation de l'événement.
    const [task] = await listEventTasks(team.organizationId, eventId);
    await NOTIFICATION_CONSUMERS[EVT_TASK_ASSIGNED]!({ id: randomUUID(), organizationId: team.organizationId, name: EVT_TASK_ASSIGNED, version: 1, payload: { taskId: task!.id, eventId, assigneeUserId: other.bastien, assignedByUserId: team.camille }, occurredAt: new Date() });
    expect(await listNotifications(team.organizationId, other.bastien)).toEqual([]);
    expect(await listNotifications(other.organizationId, other.bastien)).toEqual([]);
  });
});
