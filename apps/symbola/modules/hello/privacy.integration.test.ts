// SOC-07 / RGPD-01 — contrat privacy/v1 du module hello (révisé, ADR 0023)
// contre un vrai PostgreSQL, scopé par organisation (RLS, ADR 0012).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { greetings } from "@symbola/db/schema/hello";
import { withOrganization } from "@symbola/db/with-organization";
import { helloPrivacy } from "./privacy";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("SOC-07 — privacy/v1 du module hello (PostgreSQL réel)", () => {
  it("trouve une ligne par un nom qu'elle contient, sans toucher une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const term = `personne-${randomUUID()}`;

    await withOrganization(db, organizationId, (tx) =>
      tx.insert(greetings).values({ organizationId, message: `bonjour ${term}` }),
    );
    await withOrganization(db, otherOrganizationId, (tx) =>
      tx.insert(greetings).values({ organizationId: otherOrganizationId, message: `bonjour ${term}` }),
    );

    const found = await helloPrivacy.find({ organizationId, terms: { name: term } });
    expect(found).toHaveLength(1);
    expect(found[0]?.label).toContain(term);
    expect(found[0]).toMatchObject({ module: "hello", kind: "greeting", eventId: null });

    // L'autre organisation garde sa propre ligne, invisible de la première.
    expect(await helloPrivacy.find({ organizationId: otherOrganizationId, terms: { name: term } })).toHaveLength(1);
    expect(await helloPrivacy.related({ organizationId, eventIds: [] })).toEqual([]);

    await withOrganization(db, organizationId, (tx) => tx.delete(greetings));
    await withOrganization(db, otherOrganizationId, (tx) => tx.delete(greetings));
  });
});
