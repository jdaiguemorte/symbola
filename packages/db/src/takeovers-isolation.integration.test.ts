// Lot 71a (HUB-14 ; SEC-09, SEC-10, SEC-11, CLAUDE.md § 6) — tests d'isolation obligatoires des tables
// nouvelles de la reprise d'un mariage : une organisation ne lit ni ne modifie les reprises, les lignes
// de reprise ni les totaux « à répartir » d'une autre, et une connexion sans organisation (l'Admin
// d'exploitation) n'en lit aucune. PostgreSQL réel, rôle applicatif (RLS forcée).
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { unallocatedTotals } from "./schema/budget";
import { imports, takeovers, takeoverSteps } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function seedTakeover(organizationId: string) {
  return withOrganization(db, organizationId, async (tx) => {
    const [takeover] = await tx.insert(takeovers).values({ organizationId, eventId: randomUUID() }).returning();
    if (!takeover) throw new Error("insertion attendue");
    const [step] = await tx.insert(takeoverSteps).values({ organizationId, takeoverId: takeover.id, kind: "budget" }).returning();
    if (!step) throw new Error("insertion attendue");
    const [total] = await tx.insert(unallocatedTotals).values({ organizationId, eventId: takeover.eventId!, committedCents: 2165050, paidCents: 320000 }).returning();
    if (!total) throw new Error("insertion attendue");
    return { takeover, step, total };
  });
}

describe("HUB-14 — Isolation des reprises entre organisations (lot 71a, PostgreSQL réel)", () => {
  it("reprises", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => (await seedTakeover(organizationId)).takeover,
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(takeovers)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(takeovers).set({ completedAt: new Date() }).where(eq(takeovers.id, target.id)).returning());
        return { affectedRows: updated.length };
      },
    });
  });

  it("lignes de reprise", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => (await seedTakeover(organizationId)).step,
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(takeoverSteps)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(takeoverSteps).set({ state: "no_file", decidedAt: new Date() }).where(eq(takeoverSteps.id, target.id)).returning());
        return { affectedRows: updated.length };
      },
    });
  });

  it("totaux « à répartir » du budget", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => (await seedTakeover(organizationId)).total,
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(unallocatedTotals)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(unallocatedTotals).set({ committedCents: 1 }).where(eq(unallocatedTotals.id, target.id)).returning());
        return { affectedRows: updated.length };
      },
    });
  });

  it("une ligne de reprise ne s'écrit pas au nom d'une autre organisation (WITH CHECK)", async () => {
    const a = randomUUID();
    const { takeover } = await seedTakeover(a);
    await expect(
      withOrganization(db, randomUUID(), (tx) => tx.insert(takeoverSteps).values({ organizationId: a, takeoverId: takeover.id, kind: "tasks" })),
    ).rejects.toThrow();
  });

  it("l'Admin d'exploitation (connexion sans organisation) ne lit aucune reprise, ligne, total ni annuaire d'import (SEC-09)", async () => {
    const organizationId = randomUUID();
    await seedTakeover(organizationId);
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(imports).values({
        organizationId,
        createdByUserId: randomUUID(),
        entityType: "program",
        fileName: "programme.pdf",
        fileFormat: "pdf",
        fileSizeBytes: 42,
        headerRowIndex: 0,
        headers: [],
        rowCount: 0,
        expiresAt: new Date(Date.now() + 86_400_000),
        leftovers: { directory: [{ role: "Témoin", company: null, contact: "Bastien Exemple", phone: "0600000000" }] },
      }),
    );
    for (const table of [takeovers, takeoverSteps, unallocatedTotals, imports]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });
});
