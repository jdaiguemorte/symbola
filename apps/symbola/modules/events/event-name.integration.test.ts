// Lot 63c (EVT-01 ; Q43, migration 0196) — nom facultatif d'un évènement, contre un vrai PostgreSQL
// (RLS) : rempli, il remplace le nom tiré des clients (liste, noms par identifiant, recherche) ; trouvé
// et effacé par la demande d'oubli ; tests d'abus entre organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createProspect, createProspectSource, eventNames, getEvent, getEventNamesByIds, listEvents, searchEvents } from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();

async function shooting(organizationId: string, name: string | null, clients: { firstName: string; lastName: string | null }[] = []) {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients, name, eventDate: "2027-03-06" })).id;
}

describe("EVT-01 — Nom facultatif d'un évènement (lot 63c, Q43)", () => {
  it("rempli, il remplace le nom tiré des clients ; vide, les clients restent le nom", async () => {
    const organizationId = randomUUID();
    const named = await shooting(organizationId, "  Shooting Roux  ", [{ firstName: "Léa", lastName: null }]);
    const plain = await shooting(organizationId, null, [{ firstName: "Inès", lastName: null }]);
    expect((await getEvent(organizationId, named))?.name).toBe("Shooting Roux");
    const listed = await listEvents({ organizationId });
    expect(Object.fromEntries(listed.map((event) => [event.id, eventNames(event.clients, event.name)]))).toEqual({ [named]: "Shooting Roux", [plain]: "Inès" });
    expect(await getEventNamesByIds(organizationId, [named, plain])).toEqual({ [named]: "Shooting Roux", [plain]: "Inès" });
  });

  it("la recherche trouve un évènement par son nom", async () => {
    const organizationId = randomUUID();
    const word = `Roux${randomUUID().slice(0, 6)}`;
    const id = await shooting(organizationId, `Shooting ${word}`);
    expect((await searchEvents(organizationId, [word.toLowerCase()], 10)).events.map((event) => event.id)).toEqual([id]);
  });

  it("la demande d'oubli le trouve et l'efface", async () => {
    const organizationId = randomUUID();
    const word = `Roux${randomUUID().slice(0, 6)}`;
    const id = await shooting(organizationId, `Shooting ${word}`);
    const found = (await eventsPrivacy.find({ organizationId, terms: { name: word } })).filter((record) => record.kind === "event");
    expect(found.map((record) => record.recordId)).toEqual([id]);
    await eventsPrivacy.erase({ organizationId, records: found.map(({ kind, recordId }) => ({ kind, recordId })), rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2026-11-21" });
    expect((await getEvent(organizationId, id))?.name ?? null).toBeNull();
  });

  it("abus : une autre organisation ne lit ni ne trouve le nom", async () => {
    const organizationId = randomUUID();
    const other = randomUUID();
    const word = `Roux${randomUUID().slice(0, 6)}`;
    const id = await shooting(organizationId, `Shooting ${word}`);
    expect(await getEvent(other, id)).toBeNull();
    expect(await getEventNamesByIds(other, [id])).not.toHaveProperty(id, `Shooting ${word}`);
    expect((await searchEvents(other, [word.toLowerCase()], 10)).events).toEqual([]);
    expect(await eventsPrivacy.find({ organizationId: other, terms: { name: word } })).toEqual([]);
  });
});
