// IMP-01 — critère obligatoire (CLAUDE.md §6) sur la table des imports du
// hub : une organisation ne voit ni ne modifie jamais les imports (et donc
// les lignes de fichier en attente) d'une autre. PostgreSQL réel, rôle
// applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { imports } from "./schema/hub";
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
});
