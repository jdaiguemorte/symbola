// DEV-01 — critère obligatoire (CLAUDE.md §6) sur les tables du module
// quotes : une organisation ne voit et ne modifie jamais le catalogue, les
// devis, versions, lignes, séries ni réglages d'une autre. PostgreSQL réel,
// rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import {
  catalogItems,
  numberSeries,
  paymentMethods,
  paymentScheduleItems,
  quoteLines,
  quoteSettings,
  quotes,
  quoteVersions,
} from "./schema/quotes";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function seedQuote(tx: Tx, organizationId: string) {
  const [quote] = await tx
    .insert(quotes)
    .values({ organizationId, eventId: randomUUID(), number: `D-2027-${randomUUID().slice(0, 4)}`, createdByUserId: randomUUID() })
    .returning();
  if (!quote) throw new Error("insertion du devis attendue");
  const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote.id, version: 1 }).returning();
  if (!version) throw new Error("insertion de la version attendue");
  return { quote, version };
}

describe("DEV-01 — Isolation entre organisations (module quotes, PostgreSQL réel)", () => {
  it("catalogue", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx
            .insert(catalogItems)
            .values({ organizationId, label: "Coordination", unit: "forfait", unitPriceCents: 150000, vatRateBasisPoints: 2000 })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(catalogItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(catalogItems).set({ label: "falsifié" }).where(eq(catalogItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, async (tx) => (await seedQuote(tx, organizationId)).quote),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quotes)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quotes).set({ status: "signed" }).where(eq(quotes.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("versions de devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, async (tx) => (await seedQuote(tx, organizationId)).version),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteVersions)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteVersions).set({ legalMention: "falsifié" }).where(eq(quoteVersions.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("lignes de devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { version } = await seedQuote(tx, organizationId);
          const [row] = await tx
            .insert(quoteLines)
            .values({
              organizationId,
              versionId: version.id,
              label: "Coordination",
              unit: "forfait",
              quantityMilli: 1000,
              unitPriceCents: 150000,
              vatRateBasisPoints: 2000,
            })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteLines)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteLines).set({ unitPriceCents: 1 }).where(eq(quoteLines.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("séries de numérotation", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(numberSeries).values({ organizationId, kind: "invoice", year: 2027, lastNumber: 4 }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(numberSeries)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(numberSeries).set({ lastNumber: 0 }).where(eq(numberSeries.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("réglages du module", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(quoteSettings).values({ organizationId }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteSettings)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteSettings).set({ validityDays: 1 }).where(eq(quoteSettings.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("modes de paiement (DEV-03)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(paymentMethods).values({ organizationId, label: "Virement" }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(paymentMethods)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(paymentMethods).set({ label: "falsifié" }).where(eq(paymentMethods.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("échéancier (DEV-03)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { version } = await seedQuote(tx, organizationId);
          const [row] = await tx
            .insert(paymentScheduleItems)
            .values({ organizationId, versionId: version.id, label: "Acompte", amountCents: 50000, dueDate: "2027-06-01" })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(paymentScheduleItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(paymentScheduleItems).set({ paidOn: "2027-06-01" }).where(eq(paymentScheduleItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
