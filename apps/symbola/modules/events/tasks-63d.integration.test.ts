// Lot 63d (CHR-02, CHR-03, HUB-20, UX-07 ; recette du 21/11/2026, maquette M6) — catégories et priorité
// des tâches, actions groupées et suppression annulable, contre un vrai PostgreSQL (RLS), par la porte
// d'entrée du module. Tests d'abus : une organisation ne range jamais une tâche dans la catégorie d'une
// autre, ne décale, ne supprime ni ne rend jamais les tâches d'une autre.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { starterTaskCategories } from "@symbola/starter-templates";
import {
  addEventTask,
  addStarterTaskCategories,
  changeEventTasks,
  countTasksByCategory,
  createProspect,
  createProspectSource,
  createTaskCategory,
  listEventTasks,
  listTaskCategories,
  moveTaskCategory,
  removeEventTasks,
  removeTaskCategory,
  restoreEventTasksDeletedWith,
  TaskCategoryInvalidError,
  TaskCategoryNotFoundError,
  updateEventTask,
  updateTaskCategory,
  BulkTaskChangeInvalidError,
} from "./service";

const plannerId = randomUUID();

async function createEvent(organizationId: string) {
  const source = await createProspectSource(organizationId, "Instagram");
  return createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Camille", lastName: null }], eventDate: "2027-06-12", applyTemplate: false });
}

async function withTasks(organizationId: string, labels: string[]) {
  const event = await createEvent(organizationId);
  const tasks = [];
  for (const [index, label] of labels.entries()) tasks.push(await addEventTask(organizationId, event.id, { label, dueDate: `2027-03-0${index + 1}`, responsible: "planner" }));
  return { event, tasks };
}

describe("CHR-03, HUB-20 — Catégories et priorité des tâches", () => {
  it("les catégories de départ s'installent une fois, dans l'ordre du fichier, sans doublon", async () => {
    const organizationId = randomUUID();
    expect(await addStarterTaskCategories(organizationId, starterTaskCategories("fr"))).toBe(4);
    expect(await addStarterTaskCategories(organizationId, starterTaskCategories("fr"))).toBe(0);
    expect((await listTaskCategories(organizationId)).map((category) => category.label)).toEqual(["Client", "Prestataires", "Administratif", "Jour J"]);
  });

  it("une tâche reçoit une catégorie et la priorité haute ; par défaut, ni catégorie ni priorité haute", async () => {
    const organizationId = randomUUID();
    await addStarterTaskCategories(organizationId, starterTaskCategories("fr"));
    const [, vendors] = await listTaskCategories(organizationId);
    const { event, tasks } = await withTasks(organizationId, ["Confirmer le menu"]);
    expect(tasks[0]).toMatchObject({ categoryId: null, priority: "normal" });
    await updateEventTask({ organizationId, taskId: tasks[0]!.id, categoryId: vendors!.id, priority: "high" });
    const [task] = await listEventTasks(organizationId, event.id);
    expect(task).toMatchObject({ categoryId: vendors!.id, priority: "high" });
    const added = await addEventTask(organizationId, event.id, { label: "Préparer la facture", dueDate: "2027-03-10", responsible: "planner", categoryId: vendors!.id, priority: "high" });
    expect(added).toMatchObject({ categoryId: vendors!.id, priority: "high" });
    expect(await countTasksByCategory(organizationId)).toEqual({ [vendors!.id]: 2 });
  });

  it("abus : une tâche ne se range jamais dans la catégorie d'une autre organisation", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const foreign = await createTaskCategory(organizationB, { label: "Client", color: "#3b6fd8" });
    const { event, tasks } = await withTasks(organizationA, ["Relancer"]);
    await expect(updateEventTask({ organizationId: organizationA, taskId: tasks[0]!.id, categoryId: foreign.id })).rejects.toBeInstanceOf(TaskCategoryNotFoundError);
    await expect(addEventTask(organizationA, event.id, { label: "Autre", dueDate: "2027-03-10", responsible: "planner", categoryId: foreign.id })).rejects.toBeInstanceOf(TaskCategoryNotFoundError);
    await expect(changeEventTasks(organizationA, [tasks[0]!.id], { kind: "category", categoryId: foreign.id })).rejects.toBeInstanceOf(TaskCategoryNotFoundError);
    // Ni lecture, ni changement, ni retrait de la catégorie depuis l'autre organisation.
    expect(await listTaskCategories(organizationA)).toEqual([]);
    await expect(updateTaskCategory(organizationA, foreign.id, { label: "Volée", color: "#3b6fd8" })).rejects.toBeInstanceOf(TaskCategoryNotFoundError);
    await expect(removeTaskCategory(organizationA, foreign.id)).rejects.toBeInstanceOf(TaskCategoryNotFoundError);
    expect((await listTaskCategories(organizationB))[0]?.label).toBe("Client");
  });

  it("renommer, recolorer, ranger ; libellé vide ou couleur hors format refusés ; la dernière catégorie se garde", async () => {
    const organizationId = randomUUID();
    const client = await createTaskCategory(organizationId, { label: "  Client  ", color: "#3B6FD8" });
    expect(client).toMatchObject({ label: "Client", color: "#3b6fd8", position: 0 });
    const day = await createTaskCategory(organizationId, { label: "Jour J", color: "#c47a0a" });
    await expect(createTaskCategory(organizationId, { label: " ", color: "#c47a0a" })).rejects.toBeInstanceOf(TaskCategoryInvalidError);
    await expect(createTaskCategory(organizationId, { label: "Rouge", color: "red" })).rejects.toBeInstanceOf(TaskCategoryInvalidError);
    await updateTaskCategory(organizationId, client.id, { label: "Les mariés", color: "#b0558a" });
    await moveTaskCategory(organizationId, day.id, "up");
    expect((await listTaskCategories(organizationId)).map((category) => `${category.label} ${category.color}`)).toEqual(["Jour J #c47a0a", "Les mariés #b0558a"]);
    await removeTaskCategory(organizationId, client.id);
    await expect(removeTaskCategory(organizationId, day.id)).rejects.toMatchObject({ reason: "last" });
  });

  it("une catégorie retirée laisse ses tâches sans catégorie, et dit combien elle en portait", async () => {
    const organizationId = randomUUID();
    await addStarterTaskCategories(organizationId, starterTaskCategories("fr"));
    const [client] = await listTaskCategories(organizationId);
    const { event, tasks } = await withTasks(organizationId, ["Envoyer le questionnaire", "Appeler les mariés"]);
    await changeEventTasks(organizationId, tasks.map((task) => task.id), { kind: "category", categoryId: client!.id });
    expect(await removeTaskCategory(organizationId, client!.id)).toBe(2);
    expect((await listEventTasks(organizationId, event.id)).map((task) => task.categoryId)).toEqual([null, null]);
  });
});

describe("CHR-02, UX-07 — Actions groupées sur les tâches choisies", () => {
  it("décaler de N jours (en avant ou en arrière) : chaque échéance bouge et la tâche est fixée", async () => {
    const organizationId = randomUUID();
    const { event, tasks } = await withTasks(organizationId, ["A", "B", "C"]);
    expect(await changeEventTasks(organizationId, [tasks[0]!.id, tasks[1]!.id], { kind: "shift", days: 7 })).toBe(2);
    const after = await listEventTasks(organizationId, event.id);
    expect(after.map((task) => `${task.label} ${task.dueDate} ${task.fixed}`)).toEqual(["A 2027-03-08 true", "B 2027-03-09 true", "C 2027-03-03 false"]);
    await changeEventTasks(organizationId, [tasks[2]!.id], { kind: "shift", days: -3 });
    expect((await listEventTasks(organizationId, event.id)).find((task) => task.label === "C")?.dueDate).toBe("2027-02-28");
    await expect(changeEventTasks(organizationId, [tasks[0]!.id], { kind: "shift", days: 0 })).rejects.toBeInstanceOf(BulkTaskChangeInvalidError);
    await expect(changeEventTasks(organizationId, [tasks[0]!.id], { kind: "shift", days: 400 })).rejects.toBeInstanceOf(BulkTaskChangeInvalidError);
  });

  it("changer le responsable, la catégorie et la priorité de plusieurs tâches d'un coup", async () => {
    const organizationId = randomUUID();
    const category = await createTaskCategory(organizationId, { label: "Administratif", color: "#6b7280" });
    const { event, tasks } = await withTasks(organizationId, ["A", "B"]);
    const ids = tasks.map((task) => task.id);
    await changeEventTasks(organizationId, ids, { kind: "responsible", responsible: "clients" });
    await changeEventTasks(organizationId, ids, { kind: "category", categoryId: category.id });
    await changeEventTasks(organizationId, ids, { kind: "priority", priority: "high" });
    expect((await listEventTasks(organizationId, event.id)).map((task) => [task.responsible, task.categoryId, task.priority])).toEqual([
      ["clients", category.id, "high"],
      ["clients", category.id, "high"],
    ]);
    await changeEventTasks(organizationId, ids, { kind: "category", categoryId: null });
    expect((await listEventTasks(organizationId, event.id)).every((task) => task.categoryId === null)).toBe(true);
  });

  it("supprimer plusieurs tâches, puis « Annuler » les rend toutes, et seulement celles de ce geste", async () => {
    const organizationId = randomUUID();
    const { event, tasks } = await withTasks(organizationId, ["A", "B", "C"]);
    await removeEventTasks(organizationId, [tasks[2]!.id]);
    expect(await removeEventTasks(organizationId, [tasks[0]!.id, tasks[1]!.id])).toBe(2);
    expect(await listEventTasks(organizationId, event.id)).toEqual([]);
    expect(await restoreEventTasksDeletedWith(organizationId, tasks[0]!.id)).toBe(2);
    expect((await listEventTasks(organizationId, event.id)).map((task) => task.label)).toEqual(["A", "B"]);
    // Rien à rendre pour une tâche qui n'est pas à la corbeille.
    expect(await restoreEventTasksDeletedWith(organizationId, tasks[0]!.id)).toBe(0);
  });

  it("abus : une organisation ne décale, ne change, ne supprime ni ne rend jamais les tâches d'une autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const { event, tasks } = await withTasks(organizationB, ["Réserver le lieu"]);
    const ids = [tasks[0]!.id];
    expect(await changeEventTasks(organizationA, ids, { kind: "shift", days: 3 })).toBe(0);
    expect(await changeEventTasks(organizationA, ids, { kind: "priority", priority: "high" })).toBe(0);
    expect(await changeEventTasks(organizationA, ids, { kind: "responsible", responsible: "clients" })).toBe(0);
    expect(await removeEventTasks(organizationA, ids)).toBe(0);
    await removeEventTasks(organizationB, ids);
    expect(await restoreEventTasksDeletedWith(organizationA, tasks[0]!.id)).toBe(0);
    expect(await listEventTasks(organizationB, event.id)).toEqual([]);
    expect(await restoreEventTasksDeletedWith(organizationB, tasks[0]!.id)).toBe(1);
    expect((await listEventTasks(organizationB, event.id))[0]).toMatchObject({ dueDate: "2027-03-01", priority: "normal", responsible: "planner" });
  });
});
