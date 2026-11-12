// PRD-EVT-01/02 — critère obligatoire (CLAUDE.md §6) : étant donné deux
// organisations A et B avec des événements, quand A lit/liste/modifie,
// aucune donnée de B n'est visible ou modifiable. Test contre un vrai
// PostgreSQL, avec le rôle applicatif (jamais le rôle admin).
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import {
  defaultVendorSlots,
  eventActivities,
  eventLinks,
  eventLinkCodes,
  eventLinkSessions,
  eventTaskReminders,
  eventDecisions,
  eventDayDocuments,
  eventDocuments,
  eventLinkSharedSlots,
  eventClients,
  events,
  eventTasks,
  eventTypes,
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

describe("PRD-EVT-01/02 — Isolation entre organisations (module events, PostgreSQL réel)", () => {
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

  it("lot 16 (ADR 0045) — une organisation ne voit et ne modifie jamais les types d'événement d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(eventTypes).values({ organizationId, label: "Séminaire", audience: "clients" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventTypes)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventTypes).set({ label: "falsifié", audience: "couple" }).where(eq(eventTypes.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("PRD-EVT-03 — une organisation ne voit et ne modifie jamais la liste de postes par défaut d'une autre", async () => {
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

  it("PRD-EVT-03 — une organisation ne voit et ne modifie jamais les postes prestataires d'une autre", async () => {
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
            .set({ label: "falsifié" })
            .where(eq(eventVendorSlots.id, targetRow.id))
            .returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("PRD-EVT-04 — une organisation ne voit et ne modifie jamais les modèles de rétroplanning d'une autre", async () => {
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

  it("PRD-EVT-04 — une organisation ne voit et ne modifie jamais les tâches du rétroplanning d'une autre", async () => {
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

  it("PRD-EVT-05 — une organisation ne voit et ne modifie jamais le programme du jour J d'une autre", async () => {
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

  it("PRD-EVT-05 — une organisation ne voit et ne modifie jamais les intervenants du programme d'une autre", async () => {
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

  it("PRD-EVT-05 — une organisation ne voit et ne modifie jamais les modèles de programme d'une autre", async () => {
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

  it("L26-SEC-10 — une organisation ne voit et ne modifie jamais les liens personnels d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [row] = await tx
            .insert(eventLinks)
            .values({ organizationId, eventId: event.id, audience: "client", personName: "Léa Martin", email: "lea@example.test", rubrics: ["tasks"] })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventLinks)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventLinks).set({ rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"] }).where(eq(eventLinks.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("L26-SEC-10 — une organisation ne voit et ne prolonge jamais les sessions de lien d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [link] = await tx.insert(eventLinks).values({ organizationId, eventId: event!.id, audience: "client", personName: "Léa", email: "lea@example.test" }).returning();
          const [row] = await tx
            .insert(eventLinkSessions)
            .values({ organizationId, linkId: link!.id, tokenHash: `h-${organizationId}`, expiresAt: new Date(Date.now() + 86_400_000) })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventLinkSessions)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventLinkSessions).set({ expiresAt: new Date(Date.now() + 365 * 86_400_000) }).where(eq(eventLinkSessions.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("SEC-10, lot 27b — une organisation ne voit ni ne retire jamais les décisions d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx
            .insert(eventDecisions)
            .values({ organizationId, eventId: event!.id, kind: "program", title: "", snapshot: { kind: "program", programUpdatedAt: null, itemCount: 1 } })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventDecisions)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventDecisions).set({ status: "withdrawn" }).where(eq(eventDecisions.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("SEC-10, lot 29b — une organisation ne voit, ne renomme ni ne supprime jamais les documents d'événement d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx
            .insert(eventDocuments)
            .values({ organizationId, eventId: event!.id, label: "Plan de table", fileKey: `${organizationId}/plan.pdf`, mime: "application/pdf", sizeBytes: 1024, uploadedByUserId: organizationId })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventDocuments)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventDocuments).set({ label: "Intrus" }).where(eq(eventDocuments.id, targetRow.id)).returning(),
        );
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(eventDocuments).where(eq(eventDocuments.id, targetRow.id)).returning());
        return { affectedRows: updated.length + deleted.length };
      },
    });
  });

  it("SEC-10, lot 29b — une organisation ne voit ni ne change jamais les documents embarqués d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx.insert(eventDayDocuments).values({ organizationId, eventId: event!.id, source: "event_document", sourceId: organizationId }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventDayDocuments)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(eventDayDocuments).where(eq(eventDayDocuments.id, targetRow.id)).returning());
        return { affectedRows: deleted.length };
      },
    });
  });

  it("SEC-10, lot 27a — une organisation ne voit ni n'efface jamais les rappels envoyés d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [task] = await tx.insert(eventTasks).values({ organizationId, eventId: event!.id, label: "Choisir les alliances", dueDate: "2027-03-10", responsible: "clients" }).returning();
          const [link] = await tx.insert(eventLinks).values({ organizationId, eventId: event!.id, audience: "client", personName: "Léa", email: "lea@example.test", rubrics: ["tasks"] }).returning();
          const [row] = await tx.insert(eventTaskReminders).values({ organizationId, taskId: task!.id, linkId: link!.id, threshold: "week" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventTaskReminders)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventTaskReminders).set({ threshold: "eve" }).where(eq(eventTaskReminders.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("SEC-10, lot 26b — une organisation ne voit ni ne réactive jamais les codes à usage unique d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [link] = await tx.insert(eventLinks).values({ organizationId, eventId: event!.id, audience: "client", personName: "Léa", email: "lea@example.test", otpRequired: true }).returning();
          const [row] = await tx
            .insert(eventLinkCodes)
            .values({ organizationId, linkId: link!.id, codeHash: `h-${organizationId}`, expiresAt: new Date(Date.now() + 600_000), consumedAt: new Date() })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventLinkCodes)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventLinkCodes).set({ consumedAt: null, attempts: 0 }).where(eq(eventLinkCodes.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("L26-SEC-10 — une organisation ne voit et n'ajoute jamais de catégorie partagée au lien d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [link] = await tx.insert(eventLinks).values({ organizationId, eventId: event!.id, audience: "client", personName: "Bernard", email: "bernard@example.test", rubrics: ["budget"], budgetScope: "selected" }).returning();
          const [slot] = await tx.insert(eventVendorSlots).values({ organizationId, eventId: event!.id, label: "Traiteur" }).returning();
          const [row] = await tx.insert(eventLinkSharedSlots).values({ organizationId, linkId: link!.id, vendorSlotId: slot!.id }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventLinkSharedSlots)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventLinkSharedSlots).set({ updatedAt: new Date() }).where(eq(eventLinkSharedSlots.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("PRD-EVT-06 — une organisation ne voit et ne modifie jamais le fil d'activité d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          if (!event) throw new Error("insertion de l'événement attendue");
          const [row] = await tx
            .insert(eventActivities)
            .values({ organizationId, eventId: event.id, actorUserId: organizationId, kind: "task_done", taskLabel: "Faire-part" })
            .returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventActivities)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventActivities).set({ taskLabel: "falsifié" }).where(eq(eventActivities.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
