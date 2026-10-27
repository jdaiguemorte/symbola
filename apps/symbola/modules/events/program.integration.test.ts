// EVT-05 — programme du jour J, contre un vrai PostgreSQL (RLS, ADR 0012),
// par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addDefaultVendorSlots,
  addProgramItem,
  addProgramTemplateItem,
  applyProgramTemplate,
  createProgramTemplate,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgram,
  listEventVendorSlots,
  listProgramTemplates,
  ProgramItemNotFoundError,
  ProgramParticipantNotFoundError,
  ProgramTemplateNotFoundError,
  removeEventVendorSlot,
  removeProgramItem,
  removeProgramTemplate,
  removeProgramTemplateItem,
  updateProgramItem,
} from "./service";

const plannerId = randomUUID();

async function createEvent(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  return createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
    eventDate: "2027-06-12",
  });
}

const line = (startTime: string, label: string, extra: Partial<Parameters<typeof addProgramItem>[2]> = {}) => ({
  startTime,
  label,
  vendorSlotIds: [],
  freeParticipants: [],
  ...extra,
});

describe("EVT-05 — Programme du jour J", () => {
  it("le programme est une liste de lignes complètes, triées par heure", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const event = await createEvent(organizationId);
    const [photographer] = await listEventVendorSlots(organizationId, event.id);

    await addProgramItem(organizationId, event.id, line("19:30", "Dîner", { endTime: "22:30" }));
    await addProgramItem(
      organizationId,
      event.id,
      line("15:00", "Cérémonie", {
        endTime: "16:00",
        location: "Église Saint-Paul",
        internalNote: "Prévoir les alliances",
        vendorSlotIds: [photographer!.id],
        freeParticipants: ["Officiant"],
      }),
    );

    const program = await getEventProgram(organizationId, event.id);
    expect(program.items.map((item) => item.label)).toEqual(["Cérémonie", "Dîner"]);
    expect(program.items[0]).toMatchObject({
      startTime: "15:00",
      endTime: "16:00",
      location: "Église Saint-Paul",
      internalNote: "Prévoir les alliances",
      participants: [
        { vendorSlotId: photographer!.id, label: "Photographe" },
        { vendorSlotId: null, label: "Officiant" },
      ],
    });
    expect(program.items[1]).toMatchObject({ endTime: "22:30", location: null, internalNote: null, participants: [] });
    expect(program.updatedAt).not.toBeNull();
  });

  it("étant donné deux lignes qui se chevauchent pour un même intervenant, alors l'app le signale sans bloquer", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const event = await createEvent(organizationId);
    const [photographer] = await listEventVendorSlots(organizationId, event.id);

    const ceremony = await addProgramItem(
      organizationId,
      event.id,
      line("15:00", "Cérémonie", { endTime: "16:00", vendorSlotIds: [photographer!.id] }),
    );
    const cocktail = await addProgramItem(
      organizationId,
      event.id,
      line("15:30", "Vin d'honneur", { endTime: "18:00", vendorSlotIds: [photographer!.id] }),
    );

    const program = await getEventProgram(organizationId, event.id);
    expect(program.items).toHaveLength(2);
    expect(program.overlaps).toEqual([{ participant: "Photographe", itemIds: [ceremony.id, cocktail.id] }]);

    await updateProgramItem(organizationId, cocktail.id, line("16:00", "Vin d'honneur", { endTime: "18:00", vendorSlotIds: [photographer!.id] }));
    expect((await getEventProgram(organizationId, event.id)).overlaps).toEqual([]);
  });

  it("elle modifie et supprime une ligne ; la date de version suit chaque changement", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId);
    const item = await addProgramItem(organizationId, event.id, line("15:00", "Cérémonie"));
    const before = (await getEventProgram(organizationId, event.id)).updatedAt;

    const updated = await updateProgramItem(
      organizationId,
      item.id,
      line("15:30", "Cérémonie laïque", { freeParticipants: ["Officiant", " "] }),
    );
    expect(updated).toMatchObject({ startTime: "15:30", label: "Cérémonie laïque", participants: [{ label: "Officiant" }] });
    const afterUpdate = (await getEventProgram(organizationId, event.id)).updatedAt;
    expect(afterUpdate! > before!).toBe(true);

    await removeProgramItem(organizationId, item.id);
    const program = await getEventProgram(organizationId, event.id);
    expect(program.items).toEqual([]);
    expect(program.updatedAt! > afterUpdate!).toBe(true);
  });

  it("un poste supprimé de l'événement disparaît des intervenants", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["DJ"]);
    const event = await createEvent(organizationId);
    const [dj] = await listEventVendorSlots(organizationId, event.id);
    await addProgramItem(organizationId, event.id, line("22:30", "Soirée", { vendorSlotIds: [dj!.id] }));

    await removeEventVendorSlot(organizationId, dj!.id);
    expect((await getEventProgram(organizationId, event.id)).items[0]?.participants).toEqual([]);
  });

  it("le programme peut partir d'un modèle ; les intervenants sont rapprochés des postes de l'événement", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const event = await createEvent(organizationId);
    const [photographer] = await listEventVendorSlots(organizationId, event.id);
    const template = await createProgramTemplate(organizationId, "Mariage", [
      { startTime: "15:00", endTime: "16:00", label: "Cérémonie", location: "Mairie", participantLabels: ["photographe", "Officiant"] },
    ]);
    const added = await addProgramTemplateItem(organizationId, template.id, {
      startTime: "19:30",
      label: "Dîner",
      participantLabels: [],
    });

    expect((await listProgramTemplates(organizationId))[0]?.items.map((item) => item.label)).toEqual([
      "Cérémonie",
      "Dîner",
    ]);
    await removeProgramTemplateItem(organizationId, added.id);

    await applyProgramTemplate(organizationId, event.id, template.id);
    const program = await getEventProgram(organizationId, event.id);
    expect(program.items).toHaveLength(1);
    expect(program.items[0]).toMatchObject({
      startTime: "15:00",
      endTime: "16:00",
      label: "Cérémonie",
      location: "Mairie",
      participants: [
        { vendorSlotId: photographer!.id, label: "Photographe" },
        { vendorSlotId: null, label: "Officiant" },
      ],
    });

    await removeProgramTemplate(organizationId, template.id);
    expect(await listProgramTemplates(organizationId)).toEqual([]);
    expect((await getEventProgram(organizationId, event.id)).items).toHaveLength(1);
  });

  it("refuse une heure invalide ou un intitulé vide", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId);
    await expect(addProgramItem(organizationId, event.id, line("25:00", "Cérémonie"))).rejects.toBeInstanceOf(RangeError);
    await expect(addProgramItem(organizationId, event.id, line("15:00", " "))).rejects.toThrow();
    expect((await getEventProgram(organizationId, event.id)).items).toEqual([]);
  });
});

describe("EVT-05 — Isolation par la porte d'entrée du module", () => {
  it("refuse le programme, les postes et les modèles d'une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    await addDefaultVendorSlots(otherOrganizationId, ["Traiteur"]);
    const otherEvent = await createEvent(otherOrganizationId);
    const [otherSlot] = await listEventVendorSlots(otherOrganizationId, otherEvent.id);
    const otherItem = await addProgramItem(otherOrganizationId, otherEvent.id, line("15:00", "Cérémonie"));
    const otherTemplate = await createProgramTemplate(otherOrganizationId, "Mariage", []);
    const event = await createEvent(organizationId);

    await expect(addProgramItem(organizationId, otherEvent.id, line("15:00", "Intrus"))).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
    await expect(
      addProgramItem(organizationId, event.id, line("15:00", "Intrus", { vendorSlotIds: [otherSlot!.id] })),
    ).rejects.toBeInstanceOf(ProgramParticipantNotFoundError);
    await expect(updateProgramItem(organizationId, otherItem.id, line("16:00", "falsifié"))).rejects.toBeInstanceOf(
      ProgramItemNotFoundError,
    );
    await expect(applyProgramTemplate(organizationId, event.id, otherTemplate.id)).rejects.toBeInstanceOf(
      ProgramTemplateNotFoundError,
    );
    await removeProgramItem(organizationId, otherItem.id);
    await expect(getEventProgram(organizationId, otherEvent.id)).rejects.toBeInstanceOf(EventNotFoundError);

    expect((await getEventProgram(otherOrganizationId, otherEvent.id)).items).toMatchObject([{ label: "Cérémonie" }]);
  });
});
