// Lot 21 (L21-EVT-21, L21-EVT-22) — modèles de programme et de rétroplanning : une
// ligne se modifie sans être recréée, un modèle se renomme. Contre un vrai
// PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addProgramTemplateItem,
  addTaskTemplateItem,
  createProgramTemplate,
  createTaskTemplate,
  listProgramTemplates,
  listTaskTemplates,
  ProgramTemplateNotFoundError,
  renameProgramTemplate,
  renameTaskTemplate,
  TaskTemplateNotFoundError,
  updateProgramTemplateItem,
  updateTaskTemplateItem,
} from "./service";

describe("L21-EVT-21 — Programme du jour J : la liste des modèles, puis le détail", () => {
  it("quand elle modifie une ligne d'un modèle, alors la ligne change à sa place, sans être recréée", async () => {
    const organizationId = randomUUID();
    const template = await createProgramTemplate(organizationId, "Mariage en domaine", [
      { startTime: "15:00", label: "Cérémonie", participantLabels: ["Officiant"] },
      { startTime: "16:30", endTime: "19:00", label: "Vin d'honneur", participantLabels: [] },
    ]);
    const ceremony = template.items[0]!;

    const updated = await updateProgramTemplateItem(organizationId, ceremony.id, {
      startTime: "15:30",
      endTime: "16:15",
      label: "Cérémonie laïque",
      location: "Lieu de la cérémonie",
      participantLabels: ["Officiant", " Photographe "],
    });

    expect(updated).toMatchObject({ id: ceremony.id, startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", location: "Lieu de la cérémonie", participantLabels: ["Officiant", "Photographe"] });
    const [stored] = await listProgramTemplates(organizationId);
    expect(stored!.items.map((item) => [item.id, item.label])).toEqual([
      [ceremony.id, "Cérémonie laïque"],
      [template.items[1]!.id, "Vin d'honneur"],
    ]);
  });

  it("quand elle renomme un modèle, alors il garde ses lignes", async () => {
    const organizationId = randomUUID();
    const template = await createProgramTemplate(organizationId, "Programme", []);
    await addProgramTemplateItem(organizationId, template.id, { startTime: "19:30", label: "Dîner", participantLabels: [] });

    await renameProgramTemplate(organizationId, template.id, "  Brunch du lendemain ");

    const [stored] = await listProgramTemplates(organizationId);
    expect(stored).toMatchObject({ name: "Brunch du lendemain", items: [{ label: "Dîner" }] });
  });

  it("isolation : une organisation ne modifie ni ne renomme les modèles d'une autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const template = await createProgramTemplate(organizationA, "Mariage", [{ startTime: "15:00", label: "Cérémonie", participantLabels: [] }]);

    await expect(updateProgramTemplateItem(organizationB, template.items[0]!.id, { startTime: "10:00", label: "Piraté", participantLabels: [] })).rejects.toBeInstanceOf(
      ProgramTemplateNotFoundError,
    );
    await expect(renameProgramTemplate(organizationB, template.id, "Piraté")).rejects.toBeInstanceOf(ProgramTemplateNotFoundError);
    const [stored] = await listProgramTemplates(organizationA);
    expect(stored).toMatchObject({ name: "Mariage", items: [{ label: "Cérémonie", startTime: "15:00" }] });
  });
});

describe("L21-EVT-22 — Rétroplanning sur le même modèle", () => {
  it("quand elle modifie une tâche d'un modèle, alors l'échéance, l'intitulé et le responsable changent, à sa place", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Mariage court", [
      { label: "Réserver le lieu", offsetDays: -365, responsible: "planner" },
      { label: "Envoyer les faire-part", offsetDays: -120, responsible: "clients" },
    ]);
    const first = template.items[0]!;

    const updated = await updateTaskTemplateItem(organizationId, first.id, { label: "Réserver le lieu et le traiteur", offsetDays: -300, responsible: "clients" });

    expect(updated).toMatchObject({ id: first.id, label: "Réserver le lieu et le traiteur", offsetDays: -300, responsible: "clients" });
    const [stored] = await listTaskTemplates(organizationId);
    expect(stored!.items.map((item) => item.id)).toEqual([first.id, template.items[1]!.id]);
  });

  it("quand elle renomme un modèle, alors il garde ses tâches", async () => {
    const organizationId = randomUUID();
    const template = await createTaskTemplate(organizationId, "Rétroplanning", []);
    await addTaskTemplateItem(organizationId, template.id, { label: "Choisir le lieu", offsetDays: -400, responsible: "planner" });

    await renameTaskTemplate(organizationId, template.id, "Mariage long");

    const [stored] = await listTaskTemplates(organizationId);
    expect(stored).toMatchObject({ name: "Mariage long", items: [{ label: "Choisir le lieu" }] });
  });

  it("isolation : une organisation ne modifie ni ne renomme les modèles d'une autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const template = await createTaskTemplate(organizationA, "Mariage", [{ label: "Réserver le lieu", offsetDays: -365, responsible: "planner" }]);

    await expect(updateTaskTemplateItem(organizationB, template.items[0]!.id, { label: "Piraté", offsetDays: 0, responsible: "planner" })).rejects.toBeInstanceOf(
      TaskTemplateNotFoundError,
    );
    await expect(renameTaskTemplate(organizationB, template.id, "Piraté")).rejects.toBeInstanceOf(TaskTemplateNotFoundError);
    const [stored] = await listTaskTemplates(organizationA);
    expect(stored).toMatchObject({ name: "Mariage", items: [{ label: "Réserver le lieu", offsetDays: -365 }] });
  });
});
