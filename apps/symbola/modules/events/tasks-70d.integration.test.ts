// Lot 70d (CHR-02, CHR-03, CHR-10, PAR-10, UX-08 ; C-14, C-33, C-37, C-55 ; A20) — l'écran « Tâches » contre
// un vrai PostgreSQL (RLS), par les portes d'entrée des modules : le décompte qui se recoupe (à faire +
// faites = total), la charge de chacun (« Bastien · 2 en retard · 6 à faire »), la tâche hors évènement
// filtrée et répétée, les évènements sans tâches, le mariage repris (journal des imports du hub). Tests
// d'abus (CLAUDE.md § 2.11) : les filtres `evenement` et `qui` d'une autre organisation ne rendent rien et
// ne changent aucun nombre ; une organisation ne lit ni les évènements sans tâches ni les reprises d'une
// autre ; une Planner restreinte ne compte pas les tâches d'un évènement hors de son équipe.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser, setUserNames } from "@symbola/auth";
import type { TaskListFilters, TaskListViewer } from "@symbola/contracts";
import { withActor } from "@symbola/db/actor";
import { createAppConnection, appDatabase } from "@symbola/db/client";
import { importItems, imports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { listImportedEvents } from "@/modules/hub/service";
import { addEventTask, addStandaloneTask, createProspect, createProspectSource, eventIdsWithoutTasks, listTasks, removeEventTask, setEventTeamMember, setStandaloneTaskDone, updateEventTask } from "./service";

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

async function agency() {
  return withDb(async (db) => {
    const organization = await createOrganization(db, `Agence ${randomUUID().slice(0, 8)}`);
    const make = async (role: "owner" | "member", name: string) => (await createUser(db, { organizationId: organization.id, email: `${name}-${randomUUID()}@example.test`, role })).id;
    const camille = await make("owner", "camille");
    const bastien = await make("member", "bastien");
    await setUserNames(db, camille, { firstName: "Camille", lastName: "Durand" });
    await setUserNames(db, bastien, { firstName: "Bastien", lastName: "Leroy" });
    return { organizationId: organization.id, camille, bastien };
  });
}

const as = <T>(userId: string, fn: () => Promise<T>) => withActor({ kind: "member", id: userId }, fn);
const ownerView = (userId: string): TaskListViewer => ({ userId, role: "owner", allPlannersSeeAll: true });

async function wedding(organizationId: string, createdByUserId: string, firstName = "Léa") {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId, prospectSourceId: source.id, clients: [{ firstName, lastName: "Martin" }], eventDate: EVENT_DATE });
  return event.id;
}

async function list(organizationId: string, viewer: TaskListViewer, filters: TaskListFilters = {}) {
  return listTasks({ organizationId, today: TODAY, viewer, filters });
}

// Une agence de Camille et Bastien : deux mariages, sept tâches dont deux faites, une hors évènement.
async function busyAgency() {
  const team = await agency();
  const lea = await wedding(team.organizationId, team.camille, "Léa");
  const ines = await wedding(team.organizationId, team.camille, "Inès");
  const add = (eventId: string, label: string, dueDate: string, responsible: "planner" | "clients", assigneeUserId?: string) =>
    as(team.camille, () => addEventTask(team.organizationId, eventId, { label, dueDate, responsible, ...(assigneeUserId ? { assigneeUserId } : {}) }));
  const late1 = await add(lea, "Confirmer la voiture", "2027-03-01", "planner", team.bastien);
  const late2 = await add(ines, "Relancer le traiteur", "2027-03-05", "planner", team.bastien);
  const late3 = await add(lea, "Faire signer le photographe", "2027-03-02", "planner", team.camille);
  const late4 = await add(ines, "Choisir la musique", "2027-03-03", "clients");
  const soon = await add(ines, "Envoyer le plan de table", "2027-03-20", "planner", team.bastien);
  const done1 = await add(lea, "Réserver la salle du brunch", "2027-03-08", "planner", team.camille);
  const done2 = await add(ines, "Relire le contrat", "2027-03-09", "planner", team.bastien);
  await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: done1.id, done: true }));
  await as(team.camille, () => updateEventTask({ organizationId: team.organizationId, taskId: done2.id, done: true }));
  const vat = await as(team.camille, () => addStandaloneTask(team.organizationId, { label: "Déclaration de TVA", dueDate: "2027-04-15", recurrence: "quarterly" }));
  return { ...team, lea, ines, late1, late2, late3, late4, soon, done1, done2, vat };
}

describe("CHR-03 crit. 3 — le décompte dit combien la liste montre, sur combien, et se recoupe", () => {
  it("à faire + faites = total, avec ou sans filtre ; le nombre filtré est celui de la liste", async () => {
    const team = await busyAgency();
    const viewer = ownerView(team.camille);
    const todo = await list(team.organizationId, viewer);
    const done = await list(team.organizationId, viewer, { state: "done" });
    const all = await list(team.organizationId, viewer, { state: "all" });
    expect(todo.total).toBe(8);
    expect(todo.todoTotal).toBe(6);
    expect(todo.tasks).toHaveLength(6);
    expect(done.tasks).toHaveLength(2);
    expect(todo.todoTotal + done.tasks.length).toBe(todo.total);
    expect(all.tasks).toHaveLength(all.total);
    expect(todo.late).toBe(4);
    // Filtré : la liste dit « 3 tâches sur 6 à faire » ; le total ne bouge pas.
    const bastien = await list(team.organizationId, viewer, { assignee: { kind: "member", userId: team.bastien } });
    expect([bastien.filtered, bastien.todoTotal, bastien.total]).toEqual([3, 6, 8]);
  });
});

describe("CHR-03 crit. 4, PAR-10 — « En retard », groupé par « Qui s'en charge » : les retards de chacun, avec son compte", () => {
  it("la charge de chacun (à faire) accompagne la liste des retards", async () => {
    const team = await busyAgency();
    const late = await list(team.organizationId, ownerView(team.camille), { period: { kind: "late" } });
    expect(late.tasks.map((task) => task.label).sort()).toEqual(["Choisir la musique", "Confirmer la voiture", "Faire signer le photographe", "Relancer le traiteur"]);
    expect(late.todoByWho).toEqual({ [`member:${team.bastien}`]: 3, [`member:${team.camille}`]: 2, clients: 1 });
  });
});

describe("CHR-10 crit. 9 — une tâche hors évènement se filtre et se coche comme une autre ; sa répétition crée la suivante", () => {
  it("« Hors évènement » ne montre qu'elle ; faite, la suivante naît trois mois plus tard", async () => {
    const team = await busyAgency();
    const viewer = ownerView(team.camille);
    const standalone = await list(team.organizationId, viewer, { event: { kind: "none" } });
    expect(standalone.tasks.map((task) => task.id)).toEqual([team.vat.id]);
    expect(standalone.tasks[0]!.event).toBeNull();
    await as(team.camille, () => setStandaloneTaskDone(team.organizationId, team.vat.id, true, new Date("2027-03-10T09:00:00Z"), TODAY));
    const after = await list(team.organizationId, viewer, { event: { kind: "none" } });
    expect(after.tasks.map((task) => [task.label, task.dueDate])).toEqual([["Déclaration de TVA", "2027-07-15"]]);
    const doneOnes = await list(team.organizationId, viewer, { event: { kind: "none" }, state: "done" });
    expect(doneOnes.tasks.map((task) => task.id)).toEqual([team.vat.id]);
  });
});

describe("UX-08, C-55 — un mariage repris sans tâches est signalé", () => {
  it("les évènements sans tâche (supprimées comprises) parmi ceux demandés ; ceux d'une autre organisation n'y sont jamais", async () => {
    const team = await busyAgency();
    const empty = await wedding(team.organizationId, team.camille, "Hugo");
    const emptied = await wedding(team.organizationId, team.camille, "Nina");
    const only = await as(team.camille, () => addEventTask(team.organizationId, emptied, { label: "Seule tâche", dueDate: "2027-04-01", responsible: "planner" }));
    await removeEventTask(team.organizationId, only.id);
    expect((await eventIdsWithoutTasks(team.organizationId, [team.lea, team.ines, empty, emptied])).sort()).toEqual([empty, emptied].sort());
    const other = await agency();
    const foreign = await wedding(other.organizationId, other.camille, "Zoé");
    // Abus : l'évènement sans tâches d'une autre organisation n'est pas lu, ni un identifiant inventé.
    expect(await eventIdsWithoutTasks(team.organizationId, [foreign, randomUUID(), "pas-un-identifiant"])).toEqual([]);
  });

  it("le journal des imports du hub dit quels évènements une reprise a créés, et quand ; jamais ceux d'une autre organisation ni d'un import retiré", async () => {
    const team = await busyAgency();
    const other = await agency();
    const hugo = await wedding(team.organizationId, team.camille, "Hugo");
    const retired = await wedding(team.organizationId, team.camille, "Paul");
    const appliedAt = new Date("2026-11-24T10:00:00Z");
    const record = async (organizationId: string, userId: string, eventId: string, status: "applied" | "undone") =>
      withOrganization(appDatabase(), organizationId, async (tx) => {
        const [row] = await tx
          .insert(imports)
          .values({ organizationId, createdByUserId: userId, entityType: "events", status, fileName: "mariages.csv", fileFormat: "csv", fileSizeBytes: 10, headerRowIndex: 0, headers: ["Nom"], rowCount: 1, expiresAt: new Date("2026-12-24T00:00:00Z"), appliedAt })
          .returning({ id: imports.id });
        await tx.insert(importItems).values({ organizationId, importId: row!.id, position: 0, module: "events", kind: "event", elementId: eventId, action: "created", previous: null, written: {} });
      });
    await record(team.organizationId, team.camille, hugo, "applied");
    await record(team.organizationId, team.camille, retired, "undone");
    await record(other.organizationId, other.camille, randomUUID(), "applied");
    expect(await listImportedEvents(team.organizationId)).toEqual([{ eventId: hugo, importedAt: appliedAt.toISOString() }]);
  });
});

describe("SEC-10 à SEC-13 — abus sur les filtres de l'adresse", () => {
  it("`evenement` et `qui` d'une autre organisation ne rendent rien et ne changent aucun nombre", async () => {
    const team = await busyAgency();
    const other = await busyAgency();
    const viewer = ownerView(team.camille);
    const byEvent = await list(team.organizationId, viewer, { event: { kind: "event", eventId: other.lea } });
    expect(byEvent.tasks).toEqual([]);
    expect([byEvent.total, byEvent.todoTotal]).toEqual([8, 6]);
    const byMember = await list(team.organizationId, viewer, { assignee: { kind: "member", userId: other.bastien } });
    expect(byMember.tasks).toEqual([]);
    expect(byMember.todoByWho[`member:${other.bastien}`]).toBeUndefined();
    await expect(list(team.organizationId, viewer, { event: { kind: "event", eventId: "pas-un-identifiant" } })).rejects.toBeInstanceOf(RangeError);
  });

  it("A20 : une Planner restreinte ne compte ni ne voit les tâches d'un évènement hors de son équipe", async () => {
    const team = await busyAgency();
    await setEventTeamMember({ organizationId: team.organizationId, eventId: team.ines, userId: team.bastien, role: "lead", byUserId: team.camille });
    const restricted: TaskListViewer = { userId: team.bastien, role: "member", allPlannersSeeAll: false };
    const seen = await list(team.organizationId, restricted);
    expect(seen.tasks.every((task) => task.eventId === team.ines || task.eventId === null)).toBe(true);
    expect(seen.total).toBe(seen.todoTotal + (await list(team.organizationId, restricted, { state: "done" })).tasks.length);
    expect(seen.todoByWho[`member:${team.camille}`]).toBeUndefined();
  });
});
