// SOC-07 — vérifie le contrat privacy/v1 du module events contre un vrai
// PostgreSQL (find, export, anonymize, erase), scopé par organisation
// (RLS, ADR 0012).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events } from "@symbola/db/schema/events";
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
});
