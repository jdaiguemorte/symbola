// Lot 10 (AIDE-08) — recherche globale, contre un vrai PostgreSQL : par nom de
// client, lieu, tâche, prestataire, numéro de devis ; insensible aux accents ;
// jamais une autre organisation ni un essai ; dégradation propre par module.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  addEventTask,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  startEventsTrial,
  updateEventVendorSlot,
} from "@/modules/events/service";
import { createQuote } from "@/modules/quotes/service";
import { globalSearch } from "./service";

const all = { events: true, quotes: true };

const connection = createAppConnection();
afterAll(async () => {
  await connection.sql.end();
});

async function setup() {
  const organization = await createOrganization(connection.db, `Org ${randomUUID()}`);
  const user = await createUser(connection.db, { organizationId: organization.id, email: `recherche-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Salon");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

// Plusieurs services par test (données, recherche, isolation) : 30 s.
describe("AIDE-08 — Recherche globale", { timeout: 30_000 }, () => {
  it("trouve un événement par les noms de ses clients ou son lieu, et ses devis, tâches et prestataires", async () => {
    const { organizationId, userId, sourceId } = await setup();
    const event = await createProspect({
      organizationId,
      createdByUserId: userId,
      prospectSourceId: sourceId,
      clients: [{ firstName: "Marion" }, { firstName: "Julien", lastName: "Durand" }],
      eventDate: "2027-06-12",
      venueName: "Domaine des Oliviers",
    });
    await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: sourceId, clients: [{ firstName: "Théo" }] });
    await addEventTask(organizationId, event.id, { label: "Choisir le traiteur", dueDate: "2026-08-12", responsible: "planner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur"]);
    const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: userId });

    const byNames = await globalSearch({ organizationId, term: "marion julien", modules: all });
    expect(byNames.events.map((row) => row.id)).toEqual([event.id]);
    expect(byNames.events[0]).toMatchObject({ names: "Marion & Julien", venueName: "Domaine des Oliviers" });
    expect(byNames.quotes.map((row) => row.id)).toEqual([quote.id]);

    expect((await globalSearch({ organizationId, term: "oliviers", modules: all })).events.map((row) => row.id)).toEqual([event.id]);
    expect((await globalSearch({ organizationId, term: "durand", modules: all })).events).toHaveLength(1);
    // Accents et majuscules ignorés.
    expect((await globalSearch({ organizationId, term: "THEO", modules: all })).events.map((row) => row.names)).toEqual(["Théo"]);

    const byTask = await globalSearch({ organizationId, term: "traiteur", modules: all });
    expect(byTask.tasks).toEqual([expect.objectContaining({ eventId: event.id, label: "Choisir le traiteur", eventNames: "Marion & Julien" })]);

    const byNumber = await globalSearch({ organizationId, term: quote.number.toLowerCase(), modules: all });
    expect(byNumber.quotes.map((row) => row.id)).toEqual([quote.id]);
    expect(byNumber.eventNames[event.id]).toBe("Marion & Julien");
  });

  it("trouve un prestataire retenu par son nom", async () => {
    const { organizationId, userId, sourceId } = await setup();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: sourceId, clients: [{ firstName: "Lou" }] });
    const slots = await listEventVendorSlots(organizationId, event.id);
    expect(slots.length).toBeGreaterThan(0);
    await updateEventVendorSlot({ organizationId, vendorSlotId: slots[0]!.id, changedByUserId: userId, vendorName: "Atelier Lumière" });
    const found = await globalSearch({ organizationId, term: "lumiere", modules: all });
    expect(found.vendors).toEqual([expect.objectContaining({ eventId: event.id, vendorName: "Atelier Lumière", eventNames: "Lou" })]);
  });

  it("ne trouve jamais un essai ni une autre organisation ; un module non souscrit ne renvoie rien", async () => {
    const a = await setup();
    const b = await setup();
    await createProspect({ organizationId: b.organizationId, createdByUserId: b.userId, prospectSourceId: b.sourceId, clients: [{ firstName: "Zélie" }] });
    const trial = await startEventsTrial({ organizationId: a.organizationId, userId: a.userId, locale: "fr" });
    expect(trial.eventId).toBeTruthy();

    expect((await globalSearch({ organizationId: a.organizationId, term: "zelie", modules: all })).events).toEqual([]);
    // L'essai guidé (Camille & Sacha) n'apparaît pas.
    expect((await globalSearch({ organizationId: a.organizationId, term: "camille", modules: all })).events).toEqual([]);
    expect((await globalSearch({ organizationId: b.organizationId, term: "zelie", modules: { events: false, quotes: false } })).events).toEqual([]);
    // Un seul caractère : rien.
    expect((await globalSearch({ organizationId: b.organizationId, term: "z", modules: all })).events).toEqual([]);
  });
});

