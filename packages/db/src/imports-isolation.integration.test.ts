// IMP-01 — critère obligatoire (CLAUDE.md §6) sur la table des imports du
// hub : une organisation ne voit ni ne modifie jamais les imports (et donc
// les lignes de fichier en attente) d'une autre. PostgreSQL réel, rôle
// applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { importItems, imports, privacyRequests, privacySettings } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

function importValues(organizationId: string) {
  return {
    organizationId,
    createdByUserId: randomUUID(),
    entityType: "events" as const,
    fileName: "mariages.csv",
    fileFormat: "csv",
    fileSizeBytes: 42,
    headerRowIndex: 0,
    headers: ["Prénom"],
    rows: [["Élodie"]],
    sourceLineNumbers: [2],
    rowCount: 1,
    expiresAt: new Date(Date.now() + 86_400_000),
  };
}

describe("IMP-01 — Isolation entre organisations (imports du hub, PostgreSQL réel)", () => {
  it("imports en cours et journal", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(imports).values(importValues(organizationId)).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(imports)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(imports).set({ fileName: "falsifié" }).where(eq(imports.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("éléments écrits par un import confirmé (IMP-05)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [parent] = await tx.insert(imports).values(importValues(organizationId)).returning();
          const [row] = await tx
            .insert(importItems)
            .values({
              organizationId,
              importId: parent!.id,
              position: 0,
              module: "events",
              kind: "event",
              elementId: randomUUID(),
              action: "created",
              previous: null,
              written: { clients: [{ firstName: "Élodie", lastName: "Durand" }] },
            })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(importItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(importItems).set({ undoOutcome: "undone" }).where(eq(importItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("demandes d'exercice de droits (RGPD-04)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx
            .insert(privacyRequests)
            .values({ organizationId, type: "erasure", personLabel: "Élodie Durand", receivedOn: "2026-11-02", dueOn: "2026-12-02", createdByUserId: randomUUID() })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(privacyRequests)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(privacyRequests).set({ status: "closed" }).where(eq(privacyRequests.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("réglages RGPD d'une organisation (RGPD-04/05)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx
            .insert(privacySettings)
            .values({ organizationId, requestAlertDays: 7, prospectRetentionMonths: 36, clientRetentionMonths: 36, accountingRetentionMonths: 120, inactiveAccountMonths: 24 })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return { ...row, id: row.organizationId };
        }),
      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => (await tx.select().from(privacySettings)).map((row) => ({ ...row, id: row.organizationId }))),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(privacySettings).set({ requestAlertDays: 1 }).where(eq(privacySettings.organizationId, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
