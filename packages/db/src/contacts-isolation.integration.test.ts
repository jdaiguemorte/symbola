// Lot 36a (CRM-03, DAT-12, SEC-10) — critère obligatoire (CLAUDE.md § 6) sur chaque nouvelle
// table : les contacts du hub, leurs notes et (lot 36b) les membres des foyers et entreprises. Une organisation ne voit et ne modifie jamais les
// lignes d'une autre ; l'unicité de l'adresse e-mail vaut par organisation, pas au-delà.
// PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { contactMembers, contactNotes, contacts, emailTemplates, storageSnapshots } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

afterAll(async () => {
  await sql.end();
});

// Lot 37b : le refus d'une écriture interdite au rôle applicatif (message de PostgreSQL).
async function refusal(work: Promise<unknown>): Promise<string> {
  return work.then(
    () => "",
    (error: unknown) => String((error as { cause?: unknown }).cause ?? error),
  );
}

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

  it("membres des foyers et des entreprises (lot 36b)", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const household = first(await tx.insert(contacts).values({ organizationId, kind: "household", name: "Famille Martin" }).returning());
          const member = await seedContact(tx, organizationId);
          return first(await tx.insert(contactMembers).values({ organizationId, groupContactId: household.id, memberContactId: member.id, role: "Mariée" }).returning());
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(contactMembers)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(contactMembers).set({ role: "falsifié" }).where(eq(contactMembers.id, target.id)).returning())
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

describe("DOC-12 / SEC-10 — Isolation des relevés de stockage entre organisations (lot 37b, PostgreSQL réel)", () => {
  it("une organisation ne voit jamais le relevé d'une autre ; un relevé ne se modifie ni ne se supprime", async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const snapshot = await withOrganization(db, a, async (tx) => first(await tx.insert(storageSnapshots).values({ organizationId: a, month: "2026-11-01", nature: "uploads", fileCount: 2, totalBytes: 2048 }).returning()));
    expect(await withOrganization(db, b, (tx) => tx.select().from(storageSnapshots))).toHaveLength(0);
    expect((await withOrganization(db, a, (tx) => tx.select().from(storageSnapshots))).map((row) => row.id)).toEqual([snapshot.id]);
    await expect(withOrganization(db, b, (tx) => tx.insert(storageSnapshots).values({ organizationId: a, month: "2026-12-01", nature: "uploads", fileCount: 0, totalBytes: 0 }))).rejects.toThrow();
    expect(await refusal(withOrganization(db, a, (tx) => tx.update(storageSnapshots).set({ totalBytes: 1 }).where(eq(storageSnapshots.id, snapshot.id))))).toMatch(/permission denied/);
    expect(await refusal(withOrganization(db, a, (tx) => tx.delete(storageSnapshots).where(eq(storageSnapshots.id, snapshot.id))))).toMatch(/permission denied/);
  });
});

describe("MSG-01 / SEC-10 — Isolation des modèles d'e-mails entre organisations (lot 38a, PostgreSQL réel)", () => {
  it("une organisation ne voit, ne change ni ne supprime jamais les modèles d'e-mails d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, async (tx) => first(await tx.insert(emailTemplates).values({ organizationId, kind: "client_link", locale: "fr", subject: "Votre espace", body: "Bonjour {{prénom}}, {{lien}}" }).returning())),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(emailTemplates)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(emailTemplates).set({ subject: "falsifié" }).where(eq(emailTemplates.id, target.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(emailTemplates).where(eq(emailTemplates.id, target.id)).returning());
        return { affectedRows: updated.length + removed.length };
      },
    });
  });
});
