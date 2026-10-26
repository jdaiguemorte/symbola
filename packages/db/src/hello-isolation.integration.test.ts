// SOC-05 — critère obligatoire (CLAUDE.md §6) : étant donné deux
// organisations A et B avec des données, quand A lit/liste/modifie, aucune
// donnée de B n'est visible ou modifiable. Test contre un vrai PostgreSQL,
// avec le rôle applicatif (jamais le rôle admin) : la RLS ne peut pas être
// vérifiée de façon crédible autrement.
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { greetings } from "./schema/hello";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("SOC-05 — Isolation entre organisations (module hello, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les lignes d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const inserted = await tx
            .insert(greetings)
            .values({ organizationId, message: `bonjour depuis ${organizationId}` })
            .returning();
          const row = inserted[0];
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(greetings)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(greetings)
            .set({ message: "falsifié" })
            .where(eq(greetings.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
