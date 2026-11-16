// Lot 36a (CRM-03, DAT-12, SEC-10) — critère obligatoire (CLAUDE.md § 6) sur chaque nouvelle
// table : les contacts du hub, leurs notes et (lot 36b) les membres des foyers et entreprises. Une organisation ne voit et ne modifie jamais les
// lignes d'une autre ; l'unicité de l'adresse e-mail vaut par organisation, pas au-delà.
// PostgreSQL réel, rôle applicatif.
import { createHash, randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { calendarFeeds, contactMembers, contactNotes, contacts, emailTemplates, messageTemplates, messageTemplateVersions, storageSnapshots, users } from "./schema/hub";
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

describe("HUB-21 / SEC-10 — Isolation des modèles de messages entre organisations (lot 38b, PostgreSQL réel)", () => {
  it("une organisation ne voit, ne change ni ne supprime jamais les modèles de messages d'une autre, ni leurs versions ; une version ne se modifie pas", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, async (tx) => first(await tx.insert(messageTemplates).values({ organizationId, name: "Proposer un rendez-vous", locale: "fr" }).returning())),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(messageTemplates)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(messageTemplates).set({ name: "falsifié" }).where(eq(messageTemplates.id, target.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(messageTemplates).where(eq(messageTemplates.id, target.id)).returning());
        return { affectedRows: updated.length + removed.length };
      },
    });
    const [a, b] = [randomUUID(), randomUUID()];
    const template = await withOrganization(db, a, async (tx) => first(await tx.insert(messageTemplates).values({ organizationId: a, name: "Réponse", locale: "fr" }).returning()));
    const version = await withOrganization(db, a, async (tx) => first(await tx.insert(messageTemplateVersions).values({ organizationId: a, templateId: template.id, version: 1, subject: "Merci", body: "Bonjour {{prénom}}" }).returning()));
    expect(await withOrganization(db, b, (tx) => tx.select().from(messageTemplateVersions).where(eq(messageTemplateVersions.id, version.id)))).toHaveLength(0);
    expect(await refusal(withOrganization(db, a, (tx) => tx.update(messageTemplateVersions).set({ body: "falsifié" }).where(eq(messageTemplateVersions.id, version.id))))).toMatch(/permission denied/);
  });
});

describe("HUB-29 / SEC-10 — Isolation des adresses de calendrier entre organisations (lot 38b, PostgreSQL réel)", () => {
  it("une organisation ne voit ni ne révoque jamais l'adresse de calendrier d'une autre ; seules la révocation et la date de lecture se modifient", async () => {
    const [user] = await db.insert(users).values({ email: `flux-${randomUUID()}@example.test` }).returning();
    const randomHash = () => createHash("sha256").update(randomUUID()).digest("hex");
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, async (tx) => first(await tx.insert(calendarFeeds).values({ organizationId, userId: user!.id, tokenHash: randomHash() }).returning())),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(calendarFeeds)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(calendarFeeds).set({ revokedAt: new Date() }).where(eq(calendarFeeds.id, target.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(calendarFeeds).where(eq(calendarFeeds.id, target.id)).returning());
        return { affectedRows: updated.length + removed.length };
      },
    });
    const organizationId = randomUUID();
    const feed = await withOrganization(db, organizationId, async (tx) => first(await tx.insert(calendarFeeds).values({ organizationId, userId: user!.id, tokenHash: randomHash() }).returning()));
    await withOrganization(db, organizationId, (tx) => tx.update(calendarFeeds).set({ lastUsedAt: new Date(), revokedAt: new Date() }).where(eq(calendarFeeds.id, feed.id)));
    expect(await refusal(withOrganization(db, organizationId, (tx) => tx.update(calendarFeeds).set({ tokenHash: randomHash() }).where(eq(calendarFeeds.id, feed.id))))).toMatch(/permission denied/);
  });
});
