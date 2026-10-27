// BUD-03 — critère obligatoire (CLAUDE.md §6) sur la nouvelle table
// budget_line_attachments : une organisation ne voit et ne modifie jamais
// les devis joints d'une autre. PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { budgetLineAttachments, budgetLines } from "./schema/budget";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("BUD-03 — Isolation entre organisations (devis joints, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les devis joints d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [line] = await tx
            .insert(budgetLines)
            .values({ organizationId, eventId: randomUUID(), eventVendorSlotId: randomUUID(), plannedAmountCents: 0 })
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
