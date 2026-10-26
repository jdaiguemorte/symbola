// SOC-07 — vérifie le contrat privacy/v1 du module hello contre un vrai
// PostgreSQL (find, export, anonymize, erase), scopé par organisation
// (RLS, ADR 0012).
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
  it("trouve, exporte, anonymise puis permet de supprimer une ligne, sans toucher une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const term = `personne-${randomUUID()}`;

    await withOrganization(db, organizationId, (tx) =>
      tx.insert(greetings).values({ organizationId, message: `bonjour ${term}` }),
    );
    await withOrganization(db, otherOrganizationId, (tx) =>
      tx.insert(greetings).values({ organizationId: otherOrganizationId, message: `bonjour ${term}` }),
    );

    const found = await helloPrivacy.find({ organizationId, term });
    expect(found).toHaveLength(1);
    expect(found[0]?.summary).toContain(term);

    const exported = await helloPrivacy.export({ organizationId, term });
    expect(exported).toMatchObject({ module: "hello" });

    const anonymized = await helloPrivacy.anonymize({ organizationId, term });
    expect(anonymized.affected).toBe(1);

    const afterAnonymize = await helloPrivacy.find({ organizationId, term });
    expect(afterAnonymize).toHaveLength(0); // le message anonymisé ne contient plus le terme

    const erased = await helloPrivacy.erase({ organizationId, term: "anonymisé" });
    expect(erased.affected).toBe(1);

    // L'autre organisation n'a jamais été affectée.
    const otherStillThere = await helloPrivacy.find({ organizationId: otherOrganizationId, term });
    expect(otherStillThere).toHaveLength(1);

    await withOrganization(db, otherOrganizationId, (tx) => tx.delete(greetings));
  });
});
