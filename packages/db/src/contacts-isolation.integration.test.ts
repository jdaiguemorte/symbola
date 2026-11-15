// Lot 36a (CRM-03, DAT-12, SEC-10) — critère obligatoire (CLAUDE.md § 6) sur chaque nouvelle
// table : les contacts du hub et leurs notes. Une organisation ne voit et ne modifie jamais les
// lignes d'une autre ; l'unicité de l'adresse e-mail vaut par organisation, pas au-delà.
// PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { contactNotes, contacts } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

afterAll(async () => {
  await sql.end();
});

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
  return row;
}

async function seedContact(tx: Tx, organizationId: string, email: string | null = `lea-${randomUUID()}@exemple.test`) {
  return first(await tx.insert(contacts).values({ organizationId, firstName: "Léa", lastName: "Martin", email }).returning());
}

describe("CRM-03 / SEC-10 — Isolation des contacts entre organisations (PostgreSQL réel)", () => {
  it("contacts", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, (tx) => seedContact(tx, organizationId)),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(contacts)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(contacts).set({ firstName: "falsifié" }).where(eq(contacts.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("notes des contacts", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const contact = await seedContact(tx, organizationId);
          return first(await tx.insert(contactNotes).values({ organizationId, contactId: contact.id, body: "Préfère être appelée le soir" }).returning());
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(contactNotes)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(contactNotes).set({ body: "falsifié" }).where(eq(contactNotes.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("DAT-12 — une adresse e-mail n'appartient qu'à un contact de l'organisation, et peut exister dans une autre", async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const email = `partagee-${randomUUID()}@exemple.test`;
    await withOrganization(db, a, (tx) => seedContact(tx, a, email));
    await expect(withOrganization(db, a, (tx) => seedContact(tx, a, email))).rejects.toThrow();
    // Une autre organisation a son propre contact avec la même adresse.
    await expect(withOrganization(db, b, (tx) => seedContact(tx, b, email))).resolves.toMatchObject({ email });
    // Sans adresse, autant de contacts que nécessaire.
    await withOrganization(db, a, (tx) => seedContact(tx, a, null));
    await withOrganization(db, a, (tx) => seedContact(tx, a, null));
  });
});
