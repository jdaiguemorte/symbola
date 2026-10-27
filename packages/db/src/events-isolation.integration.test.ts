// EVT-01/02 — critère obligatoire (CLAUDE.md §6) : étant donné deux
// organisations A et B avec des événements, quand A lit/liste/modifie,
// aucune donnée de B n'est visible ou modifiable. Test contre un vrai
// PostgreSQL, avec le rôle applicatif (jamais le rôle admin).
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { eventClients, events } from "./schema/events";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("EVT-01/02 — Isolation entre organisations (module events, PostgreSQL réel)", () => {
  it("une organisation ne voit et ne modifie jamais les événements d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const inserted = await tx.insert(events).values({ organizationId }).returning();
          const row = inserted[0];
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(events)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(events).set({ venueName: "falsifié" }).where(eq(events.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("une organisation ne voit et ne modifie jamais les clients d'un événement d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const inserted = await tx
            .insert(eventClients)
            .values({ organizationId, eventId: event.id, firstName: "Prénom" })
            .returning();
          const row = inserted[0];
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventClients)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(eventClients)
            .set({ firstName: "falsifié" })
            .where(eq(eventClients.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
