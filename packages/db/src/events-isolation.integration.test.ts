// EVT-01/02 — critère obligatoire (CLAUDE.md §6) : étant donné deux
// organisations A et B avec des événements, quand A lit/liste/modifie,
// aucune donnée de B n'est visible ou modifiable. Test contre un vrai
// PostgreSQL, avec le rôle applicatif (jamais le rôle admin).
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import {
  defaultVendorSlots,
  eventClients,
  events,
  eventTasks,
  eventVendorSlots,
  programItemParticipants,
  programItems,
  programTemplateItems,
  programTemplates,
  taskTemplateItems,
  taskTemplates,
} from "./schema/events";
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

  it("EVT-03 — une organisation ne voit et ne modifie jamais la liste de postes par défaut d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(defaultVendorSlots).values({ organizationId, label: "Traiteur" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(defaultVendorSlots)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(defaultVendorSlots)
            .set({ label: "falsifié" })
            .where(eq(defaultVendorSlots.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-03 — une organisation ne voit et ne modifie jamais les postes prestataires d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [row] = await tx
            .insert(eventVendorSlots)
            .values({ organizationId, eventId: event.id, label: "Photographe" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventVendorSlots)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(eventVendorSlots)
            .set({ vendorName: "falsifié" })
            .where(eq(eventVendorSlots.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-04 — une organisation ne voit et ne modifie jamais les modèles de rétroplanning d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [template] = await tx.insert(taskTemplates).values({ organizationId, name: "Mariage" }).returning();
          if (!template) throw new Error("insertion du modèle attendue");
          const [row] = await tx
            .insert(taskTemplateItems)
            .values({ organizationId, templateId: template.id, label: "Réserver le lieu", offsetDays: -365 })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(taskTemplateItems)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(taskTemplateItems)
            .set({ label: "falsifié" })
            .where(eq(taskTemplateItems.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-04 — une organisation ne voit et ne modifie jamais les tâches du rétroplanning d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [row] = await tx
            .insert(eventTasks)
            .values({ organizationId, eventId: event.id, label: "Envoyer les faire-part", dueDate: "2027-03-01" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventTasks)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventTasks).set({ label: "falsifié" }).where(eq(eventTasks.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-05 — une organisation ne voit et ne modifie jamais le programme du jour J d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [row] = await tx
            .insert(programItems)
            .values({ organizationId, eventId: event.id, startTime: "15:00", label: "Cérémonie", internalNote: "Note" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(programItems)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(programItems).set({ label: "falsifié" }).where(eq(programItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-05 — une organisation ne voit et ne modifie jamais les intervenants du programme d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [item] = await tx
            .insert(programItems)
            .values({ organizationId, eventId: event.id, startTime: "15:00", label: "Cérémonie" })
            .returning();
          if (!item) throw new Error("insertion de la ligne attendue");
          const [row] = await tx
            .insert(programItemParticipants)
            .values({ organizationId, programItemId: item.id, freeLabel: "Officiant" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(programItemParticipants)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(programItemParticipants)
            .set({ freeLabel: "falsifié" })
            .where(eq(programItemParticipants.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("EVT-05 — une organisation ne voit et ne modifie jamais les modèles de programme d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [template] = await tx.insert(programTemplates).values({ organizationId, name: "Mariage" }).returning();
          if (!template) throw new Error("insertion du modèle attendue");
          const [row] = await tx
            .insert(programTemplateItems)
            .values({ organizationId, templateId: template.id, startTime: "15:00", label: "Cérémonie" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(programTemplateItems)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx
            .update(programTemplateItems)
            .set({ label: "falsifié" })
            .where(eq(programTemplateItems.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
