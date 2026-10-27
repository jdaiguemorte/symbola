// SOC-07 — vérifie le contrat privacy/v1 du module events contre un vrai
// PostgreSQL (find, export, anonymize, erase), scopé par organisation
// (RLS, ADR 0012).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import {
  eventClients,
  events,
  eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { eventsPrivacy } from "./privacy";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function seedClient(organizationId: string, firstName: string) {
  await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.insert(events).values({ organizationId }).returning();
    if (!event) throw new Error("insertion de l'événement attendue");
    await tx.insert(eventClients).values({ organizationId, eventId: event.id, firstName });
  });
}

describe("SOC-07 — privacy/v1 du module events (PostgreSQL réel)", () => {
  it("trouve, exporte, anonymise puis permet de supprimer un client, sans toucher une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const term = `Personne-${randomUUID()}`;

    await seedClient(organizationId, term);
    await seedClient(otherOrganizationId, term);

    const found = await eventsPrivacy.find({ organizationId, term });
    expect(found).toHaveLength(1);
    expect(found[0]?.summary).toContain(term);

    const exported = await eventsPrivacy.export({ organizationId, term });
    expect(exported).toMatchObject({ module: "events" });

    const anonymized = await eventsPrivacy.anonymize({ organizationId, term });
    expect(anonymized.affected).toBe(1);

    const afterAnonymize = await eventsPrivacy.find({ organizationId, term });
    expect(afterAnonymize).toHaveLength(0);

    const erased = await eventsPrivacy.erase({ organizationId, term: "anonymisé" });
    expect(erased.affected).toBe(1);

    const otherStillThere = await eventsPrivacy.find({ organizationId: otherOrganizationId, term });
    expect(otherStillThere).toHaveLength(1);

    await withOrganization(db, otherOrganizationId, (tx) => tx.delete(eventClients));
    await withOrganization(db, otherOrganizationId, (tx) => tx.delete(events));
    await withOrganization(db, organizationId, (tx) => tx.delete(events));
  });

  it("EVT-03 — couvre aussi le nom du prestataire d'un poste, sans toucher une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const term = `Prestataire-${randomUUID()}`;

    for (const id of [organizationId, otherOrganizationId]) {
      await withOrganization(db, id, async (tx) => {
        const [event] = await tx.insert(events).values({ organizationId: id }).returning();
        if (!event) throw new Error("insertion de l'événement attendue");
        await tx
          .insert(eventVendorSlots)
          .values({ organizationId: id, eventId: event.id, label: "Photographe", status: "booked", vendorName: term });
      });
    }

    const found = await eventsPrivacy.find({ organizationId, term });
    expect(found).toHaveLength(1);
    expect(found[0]?.summary).toContain(term);

    expect((await eventsPrivacy.anonymize({ organizationId, term })).affected).toBe(1);
    expect(await eventsPrivacy.find({ organizationId, term })).toHaveLength(0);

    // L'effacement retire le nom ; le poste lui-même (une ligne de l'événement) reste.
    expect((await eventsPrivacy.erase({ organizationId, term: "anonymisé" })).affected).toBe(1);
    const remaining = await withOrganization(db, organizationId, (tx) => tx.select().from(eventVendorSlots));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.vendorName).toBeNull();

    expect(await eventsPrivacy.find({ organizationId: otherOrganizationId, term })).toHaveLength(1);
  });

  it("EVT-05 — couvre les intervenants libres et les notes internes du programme, sans toucher une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const term = `Officiant-${randomUUID()}`;

    for (const id of [organizationId, otherOrganizationId]) {
      await withOrganization(db, id, async (tx) => {
        const [event] = await tx.insert(events).values({ organizationId: id }).returning();
        if (!event) throw new Error("insertion de l'événement attendue");
        const [item] = await tx
          .insert(programItems)
          .values({ organizationId: id, eventId: event.id, startTime: "15:00", label: "Cérémonie", internalNote: `Appeler ${term}` })
          .returning();
        if (!item) throw new Error("insertion de la ligne attendue");
        await tx.insert(programItemParticipants).values({ organizationId: id, programItemId: item.id, freeLabel: term });
      });
    }

    expect(await eventsPrivacy.find({ organizationId, term })).toHaveLength(2);
    expect((await eventsPrivacy.anonymize({ organizationId, term })).affected).toBe(2);
    expect(await eventsPrivacy.find({ organizationId, term })).toHaveLength(0);

    expect((await eventsPrivacy.erase({ organizationId, term: "anonymisé" })).affected).toBe(2);
    const lines = await withOrganization(db, organizationId, (tx) => tx.select().from(programItems));
    expect(lines).toMatchObject([{ label: "Cérémonie", internalNote: null }]);
    expect(await withOrganization(db, organizationId, (tx) => tx.select().from(programItemParticipants))).toEqual([]);

    expect(await eventsPrivacy.find({ organizationId: otherOrganizationId, term })).toHaveLength(2);
  });
});
