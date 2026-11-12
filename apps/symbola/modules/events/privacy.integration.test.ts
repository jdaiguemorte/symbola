// RGPD-01 — contrat privacy/v1 du module events (ADR 0023) contre un vrai
// PostgreSQL : chaque champ personnel déclaré est cherché (nom sans accents,
// e-mail, téléphone dans un texte libre), les données d'essai jamais, une
// autre organisation jamais ; les données liées aux événements trouvés sont
// rendues par `related`.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import {
  eventClientAccesses,
  eventClients,
  eventPlaces,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorCandidates, eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { eventsPrivacy } from "./privacy";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function seedEvent(organizationId: string, options: { firstName: string; lastName?: string; isDemo?: boolean }) {
  return withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({ organizationId, eventDate: "2027-06-12", isDemo: options.isDemo ?? false, importedFields: { Téléphone: "+33 6 12 34 56 78" } })
      .returning();
    if (!event) throw new Error("insertion de l'événement attendue");
    await tx.insert(eventClients).values({ organizationId, eventId: event.id, firstName: options.firstName, lastName: options.lastName ?? null });
    await tx.insert(eventClientAccesses).values({
      organizationId,
      eventId: event.id,
      email: `${options.firstName.toLowerCase()}@example.org`,
      expiresAt: new Date(Date.now() + 86_400_000),
      invitedByUserId: randomUUID(),
    });
    const [slot] = await tx.insert(eventVendorSlots).values({ organizationId, eventId: event.id, label: "Photographe" }).returning();
    // Lot 28b (D14) : le nom du prestataire est porté par le prestataire rattaché.
    await tx.insert(eventVendorCandidates).values({ organizationId, eventId: event.id, vendorSlotId: slot!.id, vendorName: "Studio Lumière", status: "retained" });
    await tx.insert(eventTasks).values({ organizationId, eventId: event.id, label: "Réserver le traiteur", dueDate: "2027-01-15" });
    const [item] = await tx
      .insert(programItems)
      .values({ organizationId, eventId: event.id, startTime: "15:00", label: "Cérémonie", internalNote: "Rappeler la témoin au 07 11 22 33 44" })
      .returning();
    await tx.insert(programItemParticipants).values({ organizationId, programItemId: item!.id, freeLabel: "Officiant : Jean Valjean" });
    await tx.insert(eventStatusHistory).values({ organizationId, eventId: event.id, fromStatus: null, toStatus: "prospect", changedByUserId: randomUUID() });
    return { eventId: event.id, slotId: slot!.id };
  });
}

describe("RGPD-01 — Recherche dans le module events (PostgreSQL réel)", () => {
  it("trouve un client par son nom, sans tenir compte des accents ni de la casse", async () => {
    const organizationId = randomUUID();
    const name = `Élodie${randomUUID().slice(0, 6)}`;
    const { eventId } = await seedEvent(organizationId, { firstName: name, lastName: "Durand" });

    const found = await eventsPrivacy.find({ organizationId, terms: { name: `${name.replace("É", "e")} DURAND` } });
    expect(found).toEqual([
      { module: "events", kind: "event_client", recordId: expect.any(String), label: `${name} Durand`, fields: { firstName: name, lastName: "Durand" }, eventId },
    ]);
  });

  it("trouve l'accès d'un marié par son e-mail, un téléphone dans un champ importé ou une note, un prestataire, un intervenant", async () => {
    const organizationId = randomUUID();
    const name = `Ines${randomUUID().slice(0, 6)}`;
    await seedEvent(organizationId, { firstName: name });

    expect((await eventsPrivacy.find({ organizationId, terms: { email: `${name.toLowerCase()}@example.org` } })).map((record) => record.kind)).toEqual(["client_access"]);
    expect((await eventsPrivacy.find({ organizationId, terms: { phone: "06 12 34 56 78" } })).map((record) => record.kind)).toEqual(["event"]);
    expect((await eventsPrivacy.find({ organizationId, terms: { phone: "0711223344" } })).map((record) => record.kind)).toEqual(["program_item"]);
    expect((await eventsPrivacy.find({ organizationId, terms: { name: "Studio Lumiere" } })).map((record) => record.kind)).toEqual(["vendor_candidate"]);
    expect((await eventsPrivacy.find({ organizationId, terms: { name: "Jean Valjean" } })).map((record) => record.kind)).toEqual(["program_participant"]);
  });

  it("ne trouve jamais les données d'un essai guidé ni celles d'une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const name = `Chloe${randomUUID().slice(0, 6)}`;
    await seedEvent(organizationId, { firstName: name, isDemo: true });
    await seedEvent(otherOrganizationId, { firstName: name });

    expect(await eventsPrivacy.find({ organizationId, terms: { name } })).toEqual([]);
    // L'e-mail d'accès (« chloe…@example.org ») contient aussi le prénom.
    expect((await eventsPrivacy.find({ organizationId: otherOrganizationId, terms: { name } })).map((record) => record.kind).sort()).toEqual([
      "client_access",
      "event_client",
    ]);
  });

  it("rend les données rattachées à l'événement de la personne (fiche, tâches, postes, programme, accès, historique)", async () => {
    const organizationId = randomUUID();
    const { eventId } = await seedEvent(organizationId, { firstName: `Lea${randomUUID().slice(0, 6)}` });
    const related = await eventsPrivacy.related({ organizationId, eventIds: [eventId] });
    expect(related.map((record) => record.kind).sort()).toEqual(
      ["client_access", "event", "event_vendor_slot", "program_item", "status_change", "task", "vendor_candidate"].sort(),
    );
    expect(related.every((record) => record.eventId === eventId)).toBe(true);
    expect(await eventsPrivacy.related({ organizationId: randomUUID(), eventIds: [eventId] })).toEqual([]);
  });

  it("sans terme exploitable, ne renvoie rien", async () => {
    expect(await eventsPrivacy.find({ organizationId: randomUUID(), terms: { name: "a", phone: "12" } })).toEqual([]);
  });
});

describe("RGPD-01 / RGPD-03 — Lieux de l'événement (lot 12, L12-EVT-15)", () => {
  it("trouve un lieu par son adresse, puis le supprime à l'oubli", async () => {
    const organizationId = randomUUID();
    const { eventId } = await seedEvent(organizationId, { firstName: `Lea${randomUUID().slice(0, 6)}` });
    const street = `${randomUUID().slice(0, 6)} rue des Lilas`;
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(eventPlaces).values({ organizationId, eventId, label: "Préparatifs", address: `12 ${street}, Lyon` }),
    );
    const found = await eventsPrivacy.find({ organizationId, terms: { name: street } });
    expect(found.map((record) => [record.kind, record.label])).toEqual([["event_place", "Préparatifs"]]);

    const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };
    const plan = await eventsPrivacy.erase({ organizationId, records: found.map(({ kind, recordId }) => ({ kind, recordId })), rules, today: "2026-11-05" });
    expect(plan.map((item) => [item.kind, item.fate])).toEqual([["event_place", "deleted"]]);
    expect(await withOrganization(db, organizationId, (tx) => tx.select().from(eventPlaces))).toEqual([]);
  });
});
