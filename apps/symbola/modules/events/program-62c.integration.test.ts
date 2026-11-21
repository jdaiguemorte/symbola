// Lot 62c (UX-13, décision D1) — le programme s'enregistre d'un coup, contre un vrai PostgreSQL
// (RLS), par la porte d'entrée du module : séquences modifiées et ajoutées dans une seule
// transaction, tout ou rien ; une ligne refusée dit laquelle ; abus d'une autre organisation et
// d'un autre évènement ; la note interne ne part jamais dans la version diffusée.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addDefaultVendorSlots,
  addProgramItem,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgram,
  getEventProgramVersion,
  KeyMomentNotFoundError,
  listEventVendorSlots,
  listKeyMoments,
  ProgramBatchLineError,
  ProgramItemInvalidError,
  ProgramItemNotFoundError,
  ProgramParticipantNotFoundError,
  publishEventProgram,
  saveProgramItems,
  TaskLabelRequiredError,
} from "./service";

const plannerId = randomUUID();

async function wedding(organizationId = randomUUID()) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-06-12" });
  return { organizationId, eventId: event.id };
}

const line = (startTime: string, label: string, extra: Partial<Parameters<typeof addProgramItem>[2]> = {}) => ({ startTime, label, vendorSlotIds: [], freeParticipants: [], ...extra });

const times = async (organizationId: string, eventId: string) => (await getEventProgram(organizationId, eventId)).items.map((item) => `${item.startTime} ${item.label}`);

describe("UX-13 — Le programme s'enregistre d'un coup (lot 62c, D1)", () => {
  it("séquences modifiées et séquences ajoutées sont écrites ensemble, triées par heure", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const { eventId } = await wedding(organizationId);
    const [photographer] = await listEventVendorSlots(organizationId, eventId);
    const ceremony = await addProgramItem(organizationId, eventId, line("15:00", "Cérémonie", { endTime: "16:00" }));
    const dinner = await addProgramItem(organizationId, eventId, line("19:30", "Dîner"));

    const saved = await saveProgramItems(organizationId, eventId, {
      updates: [
        { itemId: ceremony.id, item: line("15:30", "Cérémonie laïque", { durationMinutes: 45, location: "Sous les tilleuls", vendorSlotIds: [photographer!.id], freeParticipants: ["Officiant", " officiant "] }) },
        { itemId: dinner.id, item: line("20:00", "Dîner", { responsible: "  Camille   R. " }) },
      ],
      additions: [line("17:00", "Vin d'honneur", { endTime: "19:00", internalNote: "Prévoir des parasols" })],
    });

    expect(saved.map((item) => `${item.startTime} ${item.label}`)).toEqual(["15:30 Cérémonie laïque", "17:00 Vin d'honneur", "20:00 Dîner"]);
    const program = await getEventProgram(organizationId, eventId);
    expect(program.items.map((item) => `${item.startTime} ${item.label}`)).toEqual(["15:30 Cérémonie laïque", "17:00 Vin d'honneur", "20:00 Dîner"]);
    expect(program.items[0]).toMatchObject({ endTime: "16:15", location: "Sous les tilleuls" });
    expect(program.items[0]!.participants.map((participant) => participant.label)).toEqual(["Photographe", "Officiant"]);
    expect(program.items[1]).toMatchObject({ endTime: "19:00", internalNote: "Prévoir des parasols" });
    expect(program.items[2]).toMatchObject({ responsible: "Camille R.", endTime: null });
    // Une séquence ajoutée rejoint le temps fort du jour de l'évènement, comme à l'ajout une à une.
    const [moment] = await listKeyMoments(organizationId, eventId);
    expect(program.items.every((item) => item.keyMomentId === moment!.id)).toBe(true);
  });

  it("une ligne refusée dit laquelle, et rien n'est écrit : ni les autres modifications, ni les ajouts", async () => {
    const { organizationId, eventId } = await wedding();
    const ceremony = await addProgramItem(organizationId, eventId, line("15:00", "Cérémonie"));
    const dinner = await addProgramItem(organizationId, eventId, line("19:30", "Dîner"));

    const noLabel = saveProgramItems(organizationId, eventId, {
      updates: [
        { itemId: ceremony.id, item: line("15:30", "Cérémonie laïque") },
        { itemId: dinner.id, item: line("20:00", "   ") },
      ],
      additions: [line("17:00", "Vin d'honneur")],
    });
    await expect(noLabel).rejects.toMatchObject({ name: "ProgramBatchLineError", line: { kind: "update", itemId: dinner.id } });
    await expect(noLabel).rejects.toSatisfy((error: ProgramBatchLineError) => error.reason instanceof TaskLabelRequiredError);

    const badTime = saveProgramItems(organizationId, eventId, { updates: [{ itemId: ceremony.id, item: line("15:30", "Cérémonie laïque") }], additions: [line("17:00", "Vin d'honneur"), line("25:00", "Soirée")] });
    await expect(badTime).rejects.toMatchObject({ line: { kind: "addition", index: 1 } });
    await expect(badTime).rejects.toSatisfy((error: ProgramBatchLineError) => error.reason instanceof RangeError);

    const badDuration = saveProgramItems(organizationId, eventId, { updates: [], additions: [line("17:00", "Vin d'honneur", { durationMinutes: 1441 })] });
    await expect(badDuration).rejects.toSatisfy((error: ProgramBatchLineError) => error.reason instanceof ProgramItemInvalidError);

    expect(await times(organizationId, eventId)).toEqual(["15:00 Cérémonie", "19:30 Dîner"]);
  });

  it("un poste ou un temps fort d'un autre évènement refuse tout l'envoi", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const mine = await wedding(organizationId);
    const elsewhere = await wedding(organizationId);
    const ceremony = await addProgramItem(organizationId, mine.eventId, line("15:00", "Cérémonie"));
    const [foreignSlot] = await listEventVendorSlots(organizationId, elsewhere.eventId);
    await addProgramItem(organizationId, elsewhere.eventId, line("18:00", "Dîner"));
    const [foreignMoment] = await listKeyMoments(organizationId, elsewhere.eventId);

    await expect(
      saveProgramItems(organizationId, mine.eventId, { updates: [{ itemId: ceremony.id, item: line("15:30", "Cérémonie laïque") }], additions: [line("17:00", "Cocktail", { vendorSlotIds: [foreignSlot!.id] })] }),
    ).rejects.toBeInstanceOf(ProgramParticipantNotFoundError);
    await expect(
      saveProgramItems(organizationId, mine.eventId, { updates: [{ itemId: ceremony.id, item: line("15:30", "Cérémonie laïque", { keyMomentId: foreignMoment!.id }) }], additions: [] }),
    ).rejects.toBeInstanceOf(KeyMomentNotFoundError);
    expect(await times(organizationId, mine.eventId)).toEqual(["15:00 Cérémonie"]);
  });

  it("un envoi vide n'écrit rien ; une séquence citée deux fois est refusée", async () => {
    const { organizationId, eventId } = await wedding();
    const ceremony = await addProgramItem(organizationId, eventId, line("15:00", "Cérémonie"));
    const before = (await getEventProgram(organizationId, eventId)).items;

    expect(await saveProgramItems(organizationId, eventId, { updates: [], additions: [] })).toEqual([]);
    await expect(
      saveProgramItems(organizationId, eventId, { updates: [{ itemId: ceremony.id, item: line("15:30", "Cérémonie") }, { itemId: ceremony.id, item: line("16:00", "Cérémonie") }], additions: [] }),
    ).rejects.toBeInstanceOf(ProgramItemNotFoundError);
    expect((await getEventProgram(organizationId, eventId)).items).toEqual(before);
  });

  it("abus : une autre organisation ne modifie ni n'ajoute rien ; une séquence d'un autre évènement refuse tout", async () => {
    const mine = await wedding();
    const other = await wedding();
    const ceremony = await addProgramItem(mine.organizationId, mine.eventId, line("15:00", "Cérémonie"));
    const elsewhere = await wedding(mine.organizationId);
    const foreign = await addProgramItem(mine.organizationId, elsewhere.eventId, line("18:00", "Dîner"));
    const stolen = { updates: [{ itemId: ceremony.id, item: line("09:00", "Détournée") }], additions: [line("10:00", "Glissée")] };

    // L'organisation B vise l'évènement de A : il n'existe pas pour elle.
    await expect(saveProgramItems(other.organizationId, mine.eventId, stolen)).rejects.toBeInstanceOf(EventNotFoundError);
    // L'organisation B vise son propre évènement, avec une séquence de A : invisible sous RLS, tout est refusé.
    await expect(saveProgramItems(other.organizationId, other.eventId, stolen)).rejects.toBeInstanceOf(ProgramItemNotFoundError);
    expect(await times(other.organizationId, other.eventId)).toEqual([]);
    // Dans la même organisation, une séquence d'un autre évènement refuse tout l'envoi.
    await expect(
      saveProgramItems(mine.organizationId, mine.eventId, { updates: [{ itemId: ceremony.id, item: line("15:30", "Cérémonie") }, { itemId: foreign.id, item: line("18:30", "Dîner") }], additions: [line("17:00", "Cocktail")] }),
    ).rejects.toBeInstanceOf(ProgramItemNotFoundError);

    expect(await times(mine.organizationId, mine.eventId)).toEqual(["15:00 Cérémonie"]);
    expect(await times(mine.organizationId, elsewhere.eventId)).toEqual(["18:00 Dîner"]);
  });

  it("la note interne enregistrée d'un coup ne part jamais dans la version diffusée", async () => {
    const { organizationId, eventId } = await wedding();
    const ceremony = await addProgramItem(organizationId, eventId, line("15:00", "Cérémonie"));
    await saveProgramItems(organizationId, eventId, {
      updates: [{ itemId: ceremony.id, item: line("15:00", "Cérémonie", { internalNote: "Alliances chez le témoin" }) }],
      additions: [line("17:00", "Cocktail", { internalNote: "Traiteur en retard possible" })],
    });

    const published = await publishEventProgram({ organizationId, eventId, userId: plannerId });
    const version = await getEventProgramVersion(organizationId, eventId, published.number);
    expect(version!.items.map((item) => item.label)).toEqual(["Cérémonie", "Cocktail"]);
    expect(JSON.stringify(version)).not.toContain("Alliances");
    expect(JSON.stringify(version)).not.toContain("Traiteur en retard");
  });
});
