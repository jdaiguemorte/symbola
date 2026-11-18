// PRD-EVT-01/02 — critère obligatoire (CLAUDE.md §6) : étant donné deux
// organisations A et B avec des événements, quand A lit/liste/modifie,
// aucune donnée de B n'est visible ou modifiable. Test contre un vrai
// PostgreSQL, avec le rôle applicatif (jamais le rôle admin).
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import {
  defaultVendorSlots,
  eventActivities,
  eventLinks,
  eventLinkCodes,
  eventLinkSessions,
  eventTaskReminders,
  eventDecisions,
  eventDayContacts,
  eventDayDocuments,
  eventDocumentFolders,
  eventDocumentLinks,
  eventDocuments,
  eventDocumentVersions,
  programVersions,
  contactForms,
  pipelineStages,
  prospectRequests,
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
  eventMessages,
  eventQuestionnaires,
  prospectFollowUps,
  prospectFollowUpSettings,
  questionnaireAnswers,
  questionnaireTemplateItems,
  questionnaireTemplates,
} from "./schema/events";
import { contactDuplicates, contactMerges, contacts } from "./schema/hub";
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
          tx.update(events).set({ notes: "falsifié" }).where(eq(events.id, targetRow.id)).returning(),
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
            // Lot 36a : le client est un contact du hub ; ici, le seul lien.
            .values({ organizationId, eventId: event.id, contactId: randomUUID() })
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
            .set({ position: 99 })
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

  it("SEC-10, lot 30a — une organisation ne voit, ne modifie ni ne supprime jamais les contacts du jour J d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx.insert(eventDayContacts).values({ organizationId, eventId: event!.id, name: "Régisseur", role: "Domaine", phone: "06 00 00 00 00" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),

      listVisible: async (organizationId) =>
        withOrganization(db, organizationId, (tx) => tx.select().from(eventDayContacts)),

      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(eventDayContacts).set({ phone: "06 99 99 99 99" }).where(eq(eventDayContacts.id, targetRow.id)).returning(),
        );
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(eventDayContacts).where(eq(eventDayContacts.id, targetRow.id)).returning());
        return { affectedRows: updated.length + deleted.length };
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

  it("SEC-10, lot 37a — une organisation ne voit, ne change ni ne supprime jamais les dossiers de documents d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx.insert(eventDocumentFolders).values({ organizationId, eventId: event!.id, name: "Plans" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventDocumentFolders)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(eventDocumentFolders).set({ name: "Intrus" }).where(eq(eventDocumentFolders.id, targetRow.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(eventDocumentFolders).where(eq(eventDocumentFolders.id, targetRow.id)).returning());
        return { affectedRows: updated.length + removed.length };
      },
    });
  });

  it("SEC-10, lot 37a — une organisation ne voit, ne change ni ne supprime jamais les versions de documents d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [document] = await tx.insert(eventDocuments).values({ organizationId, eventId: event!.id, label: "Plan", fileKey: `${organizationId}/plan.pdf`, mime: "application/pdf", sizeBytes: 10, uploadedByUserId: organizationId }).returning();
          const [row] = await tx.insert(eventDocumentVersions).values({ organizationId, documentId: document!.id, version: 1, fileKey: `${organizationId}/plan.pdf`, mime: "application/pdf", sizeBytes: 10, uploadedByUserId: organizationId }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventDocumentVersions)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(eventDocumentVersions).set({ fileKey: "intrus" }).where(eq(eventDocumentVersions.id, targetRow.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(eventDocumentVersions).where(eq(eventDocumentVersions.id, targetRow.id)).returning());
        return { affectedRows: updated.length + removed.length };
      },
    });
  });

  it("SEC-10, lot 37a — une organisation ne voit, ne change ni ne supprime jamais les liens de partage de documents d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [document] = await tx.insert(eventDocuments).values({ organizationId, eventId: event!.id, label: "Plan", fileKey: `${organizationId}/plan.pdf`, mime: "application/pdf", sizeBytes: 10, uploadedByUserId: organizationId }).returning();
          const [row] = await tx.insert(eventDocumentLinks).values({ organizationId, eventId: event!.id, documentId: document!.id, tokenHash: `h-${randomUUID()}`, expiresAt: new Date(Date.now() + 86_400_000), createdByUserId: organizationId }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventDocumentLinks)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(eventDocumentLinks).set({ expiresAt: new Date(Date.now() + 99 * 86_400_000) }).where(eq(eventDocumentLinks.id, targetRow.id)).returning());
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(eventDocumentLinks).where(eq(eventDocumentLinks.id, targetRow.id)).returning());
        return { affectedRows: updated.length + removed.length };
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

  it("SEC-10, lot 44 — une organisation ne voit, ne renomme ni ne supprime jamais les étapes du pipeline d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(pipelineStages).values({ organizationId, label: "Nouvelle demande" }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(pipelineStages)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(pipelineStages).set({ label: "falsifiée" }).where(eq(pipelineStages.id, targetRow.id)).returning());
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(pipelineStages).where(eq(pipelineStages.id, targetRow.id)).returning());
        return { affectedRows: updated.length + deleted.length };
      },
    });
  });

  it("SEC-10, lot 44 — une organisation ne voit, ne modifie ni ne supprime jamais les demandes de contact d'une autre", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(prospectRequests).values({ organizationId, state: "to_review", message: "Bonjour", pending: { firstName: "Léa" } }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(prospectRequests)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(prospectRequests).set({ message: "falsifié" }).where(eq(prospectRequests.id, targetRow.id)).returning());
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(prospectRequests).where(eq(prospectRequests.id, targetRow.id)).returning());
        return { affectedRows: updated.length + deleted.length };
      },
    });
  });

  it("SEC-10, lot 44 — le formulaire de contact se lit par son adresse publique, mais ne se modifie ni ne se supprime par une autre organisation, ni ne s'écrit en son nom", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const [form] = await withOrganization(db, a, (tx) => tx.insert(contactForms).values({ organizationId: a, slug: `atelier-${a.slice(0, 8)}` }).returning());
    const fromB = await withOrganization(db, b, (tx) => tx.select({ id: contactForms.id }).from(contactForms).where(eq(contactForms.id, form!.id)));
    // Exception écrite (migration 0160) : la ligne, sans donnée personnelle, se lit pour retrouver l'adresse.
    expect(fromB).toHaveLength(1);
    const updated = await withOrganization(db, b, (tx) => tx.update(contactForms).set({ active: true, allowedOrigins: ["https://pirate.test"] }).where(eq(contactForms.id, form!.id)).returning());
    const deleted = await withOrganization(db, b, (tx) => tx.delete(contactForms).where(eq(contactForms.id, form!.id)).returning());
    expect(updated.length + deleted.length).toBe(0);
    await expect(withOrganization(db, b, (tx) => tx.insert(contactForms).values({ organizationId: a, slug: `pirate-${b.slice(0, 8)}` }))).rejects.toThrow();
  });

  it("SEC-10, lot 37b — une organisation ne voit ni ne supprime jamais les versions diffusées du programme d'une autre ; une version ne se modifie pas", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [event] = await tx.insert(events).values({ organizationId }).returning();
          const [row] = await tx.insert(programVersions).values({ organizationId, eventId: event!.id, number: 1, publishedByUserId: organizationId, items: [{ id: randomUUID(), startTime: "15:00", endTime: null, label: "Cérémonie", location: null, responsible: null, participants: [] }] }).returning();
          if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(programVersions)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const removed = await withOrganization(db, organizationId, (tx) => tx.delete(programVersions).where(eq(programVersions.id, targetRow.id)).returning());
        return { affectedRows: removed.length };
      },
    });
    const organizationId = randomUUID();
    const version = await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.insert(events).values({ organizationId }).returning();
      const [row] = await tx.insert(programVersions).values({ organizationId, eventId: event!.id, number: 1, items: [] }).returning();
      return row!;
    });
    const refused = await withOrganization(db, organizationId, (tx) => tx.update(programVersions).set({ number: 2 }).where(eq(programVersions.id, version.id))).then(
      () => "",
      (error: unknown) => String((error as { cause?: unknown }).cause ?? error),
    );
    expect(refused).toMatch(/permission denied/);
    // Lot 38a (D9) : seules la date et le nombre d'envois d'une version se modifient.
    const notified = await withOrganization(db, organizationId, (tx) => tx.update(programVersions).set({ notifiedAt: new Date(), notifiedCount: 3 }).where(eq(programVersions.id, version.id)).returning());
    expect(notified[0]).toMatchObject({ notifiedCount: 3, number: 1 });
  });

  // Lot 45 (CRM-05 à CRM-09, POR-07, HUB-21 ; SEC-10, SEC-36) : chaque table nouvelle, lue, modifiée et
  // supprimée depuis une autre organisation.
  async function eventOf(organizationId: string): Promise<string> {
    const [event] = await withOrganization(db, organizationId, (tx) => tx.insert(events).values({ organizationId }).returning({ id: events.id }));
    return event!.id;
  }

  // Une table quelconque du lot (types de Drizzle trop étroits pour une fonction commune).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isolate<Row extends { id: string }>(table: any, seed: (organizationId: string) => Promise<Row>, patch: Record<string, unknown>) {
    return assertOrganizationIsolation<Row>({
      seed,
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(table)) as Promise<Row[]>,
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) => tx.update(table).set(patch).where(eq(table.id, targetRow.id)).returning());
        const deleted = await withOrganization(db, organizationId, (tx) => tx.delete(table).where(eq(table.id, targetRow.id)).returning());
        return { affectedRows: (updated as unknown[]).length + (deleted as unknown[]).length };
      },
    });
  }

  it("SEC-10, lot 45 — messages, relances et réglage des relances : invisibles et intouchables depuis une autre organisation", async () => {
    await isolate(eventMessages, async (organizationId) => {
      const eventId = await eventOf(organizationId);
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(eventMessages).values({ organizationId, eventId, kind: "reply", delivery: "sent", subject: "Bonjour", body: "Merci" }).returning());
      return row!;
    }, { body: "falsifié" });
    await isolate(prospectFollowUps, async (organizationId) => {
      const eventId = await eventOf(organizationId);
      const [anchor] = await withOrganization(db, organizationId, (tx) => tx.insert(eventMessages).values({ organizationId, eventId, kind: "reply", delivery: "sent" }).returning());
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(prospectFollowUps).values({ organizationId, eventId, anchorMessageId: anchor!.id, rank: 1, readyAt: new Date(), subject: "Relance", body: "Texte" }).returning());
      return row!;
    }, { body: "falsifié" });
    await isolate(prospectFollowUpSettings, async (organizationId) => {
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(prospectFollowUpSettings).values({ organizationId }).returning());
      return row!;
    }, { autoSend: true });
  });

  it("SEC-10, lot 45 — modèles de questionnaires, questionnaires envoyés et réponses : invisibles et intouchables depuis une autre organisation", async () => {
    const template = async (organizationId: string) => {
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(questionnaireTemplates).values({ organizationId, name: "Découverte", locale: "fr" }).returning());
      return row!;
    };
    await isolate(questionnaireTemplates, template, { name: "volé" });
    await isolate(questionnaireTemplateItems, async (organizationId) => {
      const parent = await template(organizationId);
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(questionnaireTemplateItems).values({ organizationId, templateId: parent.id, version: 1, itemKey: "guests", label: "Invités ?", nature: "number" }).returning());
      return row!;
    }, { label: "falsifiée" });
    const questionnaire = async (organizationId: string) => {
      const eventId = await eventOf(organizationId);
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(eventQuestionnaires).values({ organizationId, eventId, templateVersion: 1, name: "Découverte", locale: "fr", questions: [{ key: "guests", label: "Invités ?", help: null, nature: "number", choices: [], eventField: "guests" }] }).returning());
      return row!;
    };
    await isolate(eventQuestionnaires, questionnaire, { name: "volé" });
    await isolate(questionnaireAnswers, async (organizationId) => {
      const parent = await questionnaire(organizationId);
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(questionnaireAnswers).values({ organizationId, questionnaireId: parent.id, itemKey: "guests", value: 140 }).returning());
      return row!;
    }, { value: 1 });
  });

  it("SEC-10, lot 45 — doublons possibles et trace des fusions : invisibles et intouchables depuis une autre organisation", async () => {
    await isolate(contactDuplicates, async (organizationId) => {
      const rows = await withOrganization(db, organizationId, (tx) => tx.insert(contacts).values([{ organizationId, firstName: "Léa" }, { organizationId, firstName: "Lea" }]).returning({ id: contacts.id }));
      const [first, second] = rows.map((row) => row.id).sort();
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(contactDuplicates).values({ organizationId, firstContactId: first!, secondContactId: second!, reason: "phone" }).returning());
      return row!;
    }, { dismissedAt: new Date() });
    await isolate(contactMerges, async (organizationId) => {
      const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(contactMerges).values({ organizationId, keptContactId: randomUUID(), absorbedContactId: randomUUID() }).returning());
      return row!;
    }, { fieldsFromAbsorbed: ["email"] });
  });
});
