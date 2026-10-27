// EVT-04 — rétroplanning, contre un vrai PostgreSQL (RLS, ADR 0012), par
// la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addEventTask,
  addTaskTemplateItem,
  applyTaskTemplate,
  changeEventDate,
  createProspect,
  createProspectSource,
  createTaskTemplate,
  EventDateRequiredError,
  EventTaskNotFoundError,
  getTaskRecalculation,
  listEventTasks,
  listTaskTemplates,
  moveEventTask,
  removeEventTask,
  removeTaskTemplate,
  removeTaskTemplateItem,
  resolveTaskRecalculation,
  TaskRecalculationPendingError,
  TaskTemplateNotFoundError,
  updateEventTask,
} from "./service";

const plannerId = randomUUID();

async function createEvent(organizationId: string, eventDate: string | null) {
  const source = await createProspectSource(organizationId, "Instagram");
  return createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Camille", lastName: null }],
    eventDate,
  });
}

const WEDDING_TEMPLATE = [
  { label: "Réserver le lieu", offsetDays: -365, responsible: "planner" as const },
  { label: "Envoyer les faire-part", offsetDays: -120, responsible: "clients" as const },
  { label: "Confirmer les prestataires", offsetDays: -14, responsible: "planner" as const },
];

describe("EVT-04 — Rétroplanning", () => {
  it("la planner gère des modèles : intitulé, décalage et responsable de chaque tâche", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage", WEDDING_TEMPLATE);
    const added = await addTaskTemplateItem(organizationId, template.id, {
      label: "Remercier les invités",
      offsetDays: 30,
      responsible: "clients",
    });

    const [listed] = await listTaskTemplates(organizationId);
    expect(listed?.name).toBe("Mariage");
    expect(listed?.items.map((item) => [item.label, item.offsetDays, item.responsible])).toEqual([
      ["Réserver le lieu", -365, "planner"],
      ["Envoyer les faire-part", -120, "clients"],
      ["Confirmer les prestataires", -14, "planner"],
      ["Remercier les invités", 30, "clients"],
    ]);

    await removeTaskTemplateItem(organizationId, added.id);
    expect((await listTaskTemplates(organizationId))[0]?.items).toHaveLength(3);
    await removeTaskTemplate(organizationId, template.id);
    expect(await listTaskTemplates(organizationId)).toHaveLength(0);
  });

  it("quand elle applique un modèle à un événement daté, les tâches sont créées avec leurs échéances calculées", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage", WEDDING_TEMPLATE);
    const event = await createEvent(organizationId, "2027-06-12");

    await applyTaskTemplate(organizationId, event.id, template.id);

    const tasks = await listEventTasks(organizationId, event.id);
    expect(tasks.map((task) => [task.label, task.dueDate, task.responsible, task.done])).toEqual([
      ["Réserver le lieu", "2026-06-12", "planner", false],
      ["Envoyer les faire-part", "2027-02-12", "clients", false],
      ["Confirmer les prestataires", "2027-05-29", "planner", false],
    ]);
  });

  it("étant donné un événement sans date, l'app l'indique et n'applique pas le modèle", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage", WEDDING_TEMPLATE);
    const event = await createEvent(organizationId, null);

    await expect(applyTaskTemplate(organizationId, event.id, template.id)).rejects.toBeInstanceOf(
      EventDateRequiredError,
    );
    expect(await listEventTasks(organizationId, event.id)).toHaveLength(0);
  });

  it("quand la date change, l'app propose de recalculer les échéances des tâches non faites", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage", WEDDING_TEMPLATE);
    const event = await createEvent(organizationId, "2027-06-12");
    await applyTaskTemplate(organizationId, event.id, template.id);
    const [venue] = await listEventTasks(organizationId, event.id);
    await updateEventTask({ organizationId, taskId: venue!.id, done: true });

    const proposal = await changeEventDate(organizationId, event.id, "2027-06-19");
    expect(proposal).toEqual({ pending: true, shiftDays: 7, undoneTasks: 2 });
    expect(await getTaskRecalculation(organizationId, event.id)).toEqual(proposal);

    // Tant que la planner n'a pas tranché, un autre modèle ne s'applique pas.
    await expect(applyTaskTemplate(organizationId, event.id, template.id)).rejects.toBeInstanceOf(
      TaskRecalculationPendingError,
    );

    await resolveTaskRecalculation(organizationId, event.id, true);
    const tasks = await listEventTasks(organizationId, event.id);
    expect(tasks.map((task) => [task.label, task.dueDate])).toEqual([
      ["Réserver le lieu", "2026-06-12"],
      ["Envoyer les faire-part", "2027-02-19"],
      ["Confirmer les prestataires", "2027-06-05"],
    ]);
    expect((await getTaskRecalculation(organizationId, event.id)).pending).toBe(false);
  });

  it("elle peut garder les échéances inchangées après un changement de date", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage", WEDDING_TEMPLATE);
    const event = await createEvent(organizationId, "2027-06-12");
    await applyTaskTemplate(organizationId, event.id, template.id);

    await changeEventDate(organizationId, event.id, "2027-09-04");
    await resolveTaskRecalculation(organizationId, event.id, false);

    expect((await listEventTasks(organizationId, event.id)).map((task) => task.dueDate)).toEqual([
      "2026-06-12",
      "2027-02-12",
      "2027-05-29",
    ]);
    expect((await getTaskRecalculation(organizationId, event.id)).pending).toBe(false);
  });

  it("un changement de date sans tâche non faite ne propose rien", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId, "2027-06-12");
    expect(await changeEventDate(organizationId, event.id, "2027-07-01")).toEqual({
      pending: false,
      shiftDays: 0,
      undoneTasks: 0,
    });
  });

  it("elle peut ajouter, modifier, cocher, réordonner et supprimer les tâches", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId, "2027-06-12");
    const first = await addEventTask(organizationId, event.id, {
      label: "Choisir les alliances",
      dueDate: "2027-03-10",
      responsible: "clients",
    });
    const second = await addEventTask(organizationId, event.id, {
      label: "Essayage",
      dueDate: "2027-03-20",
      responsible: "clients",
    });

    await updateEventTask({ organizationId, taskId: second.id, label: "Premier essayage", dueDate: "2027-03-22" });
    await updateEventTask({ organizationId, taskId: first.id, done: true });
    await moveEventTask(organizationId, second.id, "up");

    const tasks = await listEventTasks(organizationId, event.id);
    expect(tasks.map((task) => [task.label, task.dueDate, task.done])).toEqual([
      ["Premier essayage", "2027-03-22", false],
      ["Choisir les alliances", "2027-03-10", true],
    ]);

    await updateEventTask({ organizationId, taskId: first.id, done: false });
    await removeEventTask(organizationId, second.id);
    expect((await listEventTasks(organizationId, event.id)).map((task) => [task.label, task.done])).toEqual([
      ["Choisir les alliances", false],
    ]);
  });
});

describe("EVT-04 — Isolation par la porte d'entrée du module", () => {
  it("refuse d'appliquer le modèle d'une autre organisation ou de modifier ses tâches", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const otherTemplate = await createTaskTemplate(otherOrganizationId, "Mariage", WEDDING_TEMPLATE);
    const otherEvent = await createEvent(otherOrganizationId, "2027-06-12");
    await applyTaskTemplate(otherOrganizationId, otherEvent.id, otherTemplate.id);
    const [otherTask] = await listEventTasks(otherOrganizationId, otherEvent.id);
    const event = await createEvent(organizationId, "2027-06-12");

    await expect(applyTaskTemplate(organizationId, event.id, otherTemplate.id)).rejects.toBeInstanceOf(
      TaskTemplateNotFoundError,
    );
    await expect(updateEventTask({ organizationId, taskId: otherTask!.id, done: true })).rejects.toBeInstanceOf(
      EventTaskNotFoundError,
    );
    await removeEventTask(organizationId, otherTask!.id);
    expect(await listEventTasks(otherOrganizationId, otherEvent.id)).toHaveLength(3);
  });
});
