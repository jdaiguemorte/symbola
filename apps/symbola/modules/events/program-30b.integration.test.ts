// Lot 30b (CHR-06, décisions D6 à D8) — responsable, durées et décalage du programme du
// jour J, contre un vrai PostgreSQL (RLS), par la porte d'entrée du module : la durée
// donne la fin, le décalage bouge début et fin des séquences visées, tout ou rien ;
// abus d'une autre organisation et d'un autre événement ; RGPD (trouvé par le responsable).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addProgramItem,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgram,
  ProgramItemInvalidError,
  ProgramItemNotFoundError,
  ProgramShiftOutOfDayError,
  shiftProgramItems,
  updateProgramItem,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();

async function wedding(organizationId = randomUUID()) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-06-12" });
  return { organizationId, eventId: event.id };
}

const line = (startTime: string, label: string, extra: Partial<Parameters<typeof addProgramItem>[2]> = {}) => ({ startTime, label, vendorSlotIds: [], freeParticipants: [], ...extra });

describe("CHR-06 — Responsable et durées (lot 30b, D6 et D7)", () => {
  it("le responsable s'enregistre, nettoyé ; la durée donne l'heure de fin, après minuit compris", async () => {
    const { organizationId, eventId } = await wedding();
    const ceremony = await addProgramItem(organizationId, eventId, line("15:30", "Cérémonie laïque", { durationMinutes: 45, responsible: "  Camille  " }));
    expect(ceremony).toMatchObject({ startTime: "15:30", endTime: "16:15", responsible: "Camille" });
    const ball = await addProgramItem(organizationId, eventId, line("23:15", "Soirée dansante", { durationMinutes: 165, responsible: "" }));
    expect(ball).toMatchObject({ endTime: "02:00", responsible: null });
    // Une heure de fin saisie l'emporte sur la durée.
    const updated = await updateProgramItem(organizationId, ceremony.id, line("15:30", "Cérémonie laïque", { endTime: "16:30", durationMinutes: 45, responsible: "Le domaine" }));
    expect(updated).toMatchObject({ endTime: "16:30", responsible: "Le domaine" });
  });

  it("refus clairs : responsable trop long, durée hors d'une journée", async () => {
    const { organizationId, eventId } = await wedding();
    await expect(addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { responsible: "x".repeat(121) }))).rejects.toMatchObject({ reason: "responsible" });
    await expect(addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { durationMinutes: 0 }))).rejects.toBeInstanceOf(ProgramItemInvalidError);
    await expect(addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { durationMinutes: 1441 }))).rejects.toMatchObject({ reason: "duration" });
    await expect(addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { durationMinutes: Number.NaN }))).rejects.toMatchObject({ reason: "duration" });
    expect((await getEventProgram(organizationId, eventId)).items).toEqual([]);
  });
});

describe("CHR-06 — Décaler les séquences suivantes (lot 30b, D8)", () => {
  it("début et fin des séquences visées bougent d'autant ; l'annulation rend les mêmes heures", async () => {
    const { organizationId, eventId } = await wedding();
    const ceremony = await addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { endTime: "16:15" }));
    const photos = await addProgramItem(organizationId, eventId, line("16:30", "Photos"));
    const cocktail = await addProgramItem(organizationId, eventId, line("17:00", "Cocktail", { endTime: "19:00" }));
    const ball = await addProgramItem(organizationId, eventId, line("23:15", "Bal", { endTime: "02:00" }));
    const before = await getEventProgram(organizationId, eventId);

    const shifted = await shiftProgramItems(organizationId, eventId, [photos.id, cocktail.id, ball.id], 20);
    expect(shifted.map((item) => [item.label, item.startTime, item.endTime])).toEqual([
      ["Photos", "16:50", null],
      ["Cocktail", "17:20", "19:20"],
      ["Bal", "23:35", "02:20"],
    ]);
    const after = await getEventProgram(organizationId, eventId);
    expect(after.items.find((item) => item.id === ceremony.id)).toMatchObject({ startTime: "15:30", endTime: "16:15" });
    expect(after.updatedAt).not.toBe(before.updatedAt);

    await shiftProgramItems(organizationId, eventId, [photos.id, cocktail.id, ball.id], -20);
    expect((await getEventProgram(organizationId, eventId)).items.map((item) => [item.startTime, item.endTime])).toEqual(before.items.map((item) => [item.startTime, item.endTime]));
  });

  it("un début qui sortirait du jour J refuse tout le décalage, rien ne bouge", async () => {
    const { organizationId, eventId } = await wedding();
    const cocktail = await addProgramItem(organizationId, eventId, line("17:00", "Cocktail", { endTime: "19:00" }));
    const late = await addProgramItem(organizationId, eventId, line("23:50", "Feu d'artifice"));
    await expect(shiftProgramItems(organizationId, eventId, [cocktail.id, late.id], 20)).rejects.toBeInstanceOf(ProgramShiftOutOfDayError);
    expect((await getEventProgram(organizationId, eventId)).items.map((item) => item.startTime)).toEqual(["17:00", "23:50"]);
  });

  it("décalage nul, trop grand ou sans séquence : refusé", async () => {
    const { organizationId, eventId } = await wedding();
    const cocktail = await addProgramItem(organizationId, eventId, line("17:00", "Cocktail"));
    await expect(shiftProgramItems(organizationId, eventId, [cocktail.id], 0)).rejects.toBeInstanceOf(RangeError);
    await expect(shiftProgramItems(organizationId, eventId, [cocktail.id], 721)).rejects.toBeInstanceOf(RangeError);
    await expect(shiftProgramItems(organizationId, eventId, [], 20)).rejects.toBeInstanceOf(RangeError);
  });

  it("abus : une autre organisation ne décale rien ; une séquence d'un autre événement non plus", async () => {
    const mine = await wedding();
    const other = await wedding();
    const cocktail = await addProgramItem(mine.organizationId, mine.eventId, line("17:00", "Cocktail", { endTime: "19:00" }));
    const elsewhere = await wedding(mine.organizationId);
    const foreign = await addProgramItem(mine.organizationId, elsewhere.eventId, line("18:00", "Dîner"));

    await expect(shiftProgramItems(other.organizationId, mine.eventId, [cocktail.id], 20)).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(shiftProgramItems(other.organizationId, other.eventId, [cocktail.id], 20)).rejects.toBeInstanceOf(ProgramItemNotFoundError);
    await expect(shiftProgramItems(mine.organizationId, mine.eventId, [cocktail.id, foreign.id], 20)).rejects.toBeInstanceOf(ProgramItemNotFoundError);
    expect((await getEventProgram(mine.organizationId, mine.eventId)).items[0]).toMatchObject({ startTime: "17:00", endTime: "19:00" });
    expect((await getEventProgram(mine.organizationId, elsewhere.eventId)).items[0]).toMatchObject({ startTime: "18:00" });
  });
});

describe("RGPD-01 — Responsable d'une séquence (lot 30b)", () => {
  it("trouvé par son nom, rendu avec l'événement", async () => {
    const { organizationId, eventId } = await wedding();
    const item = await addProgramItem(organizationId, eventId, line("15:30", "Cérémonie", { responsible: "Hélène Vasseur" }));
    const found = (await eventsPrivacy.find({ organizationId, terms: { name: "Helene Vasseur" } })).filter((record) => record.kind === "program_item");
    expect(found).toMatchObject([{ recordId: item.id, fields: { responsible: "Hélène Vasseur" } }]);
    const related = await eventsPrivacy.related!({ organizationId, eventIds: [eventId] });
    expect(related.find((record) => record.kind === "program_item")).toMatchObject({ recordId: item.id, fields: { responsible: "Hélène Vasseur" } });
  });
});
