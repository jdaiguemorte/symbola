// PRD-BUD-03 — critère obligatoire (CLAUDE.md §6) sur la nouvelle table
// budget_line_attachments : une organisation ne voit et ne modifie jamais
// les devis joints d'une autre. PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { alertThresholds, budgetLineAttachments, budgetLines, vendorPayments } from "./schema/budget";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("PRD-BUD-03 — Isolation entre organisations (devis joints, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les devis joints d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [line] = await tx
            .insert(budgetLines)
            .values({ organizationId, eventId: randomUUID(), eventVendorSlotId: randomUUID(), label: "Lieu", estimatedAmountCents: 0 })
            .returning();
          if (!line) throw new Error("insertion de la ligne attendue");
          const [row] = await tx
            .insert(budgetLineAttachments)
            .values({
              organizationId,
              lineId: line.id,
              fileKey: `${organizationId}/devis.pdf`,
              mime: "application/pdf",
              sizeBytes: 1234,
              uploadedByUserId: randomUUID(),
            })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(budgetLineAttachments)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(budgetLineAttachments)
            .set({ fileKey: "falsifié" })
            .where(eq(budgetLineAttachments.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});

// Lot 28a (BUD-02) — critère obligatoire sur la nouvelle table alert_thresholds :
// le seuil d'alerte d'une organisation (ou d'un de ses événements) ne se lit ni
// ne se modifie depuis une autre.
describe("BUD-02 — Isolation entre organisations (seuils d'alerte, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les seuils d'alerte d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(alertThresholds).values({ organizationId, eventId: randomUUID(), percent: 90 }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(alertThresholds)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(alertThresholds).set({ percent: 500 }).where(eq(alertThresholds.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});

// Lot 28b (BUD-03) — critère obligatoire sur la nouvelle table vendor_payments :
// les échéances d'une organisation ne se lisent ni ne se modifient depuis une autre.
describe("BUD-03 — Isolation entre organisations (échéances des prestataires, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les échéances d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const eventId = randomUUID();
          const [line] = await tx
            .insert(budgetLines)
            .values({ organizationId, eventId, eventVendorSlotId: randomUUID(), label: "Dîner", committedAmountCents: 960000 })
            .returning();
          if (!line) throw new Error("insertion de la ligne attendue");
          const [row] = await tx
            .insert(vendorPayments)
            .values({ organizationId, eventId, lineId: line.id, label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-04-09" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendorPayments)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(vendorPayments).set({ paidOn: "2027-01-01" }).where(eq(vendorPayments.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
