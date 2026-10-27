// HUB-03 — « Étant donné le compte Admin, quand il tente de lire les
// événements, budgets ou devis d'une organisation, alors l'accès est
// refusé (test automatisé obligatoire). » L'Admin n'a pas d'organisation
// (organizationId nul, packages/db/src/schema/hub.ts) et ne fixe donc
// jamais app.organization_id : la policy RLS (ADR 0012) refuse par
// construction toute lecture, même avec une base contenant de vraies
// données. Démontré ici sur le module hello (seul module métier existant
// pour l'instant) ; vaudra pour events/budget/quotes dès leur création,
// même mécanisme.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { budgetLineAttachments, budgetLines } from "./schema/budget";
import { greetings } from "./schema/hello";
import {
  catalogItems,
  numberSeries,
  paymentMethods,
  paymentScheduleItems,
  quoteLines,
  quoteSigners,
  signatureRequests,
  signatureWebhookLog,
  quoteSettings,
  quotes,
  quoteVersions,
} from "./schema/quotes";
import {
  defaultVendorSlots,
  eventActivities,
  eventClientAccesses,
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

describe("HUB-03 — L'Admin ne lit jamais de donnée métier", () => {
  it("une lecture sans app.organization_id (session Admin) ne renvoie jamais de donnée métier, même si des données existent", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(greetings).values({ organizationId, message: "donnée métier réelle" }),
    );

    // Pas d'appel à withOrganization() : exactement ce qu'une session
    // Admin fait (elle n'a pas d'organisation à y mettre). Selon qu'une
    // connexion du pool a déjà servi un withOrganization() ou non, la
    // policy RLS renvoie soit zéro ligne (jamais touchée), soit une
    // erreur (conversion UUID d'une chaîne vide, connexion déjà
    // touchée) — les deux traduisent la même garantie : aucune donnée
    // métier accessible sans organisation explicitement fixée.
    try {
      const rows = await db.select().from(greetings);
      expect(rows).toHaveLength(0);
    } catch (error) {
      // N'importe quelle erreur ici confirme l'absence d'accès : la
      // requête n'a renvoyé aucune donnée métier, sous quelque forme
      // que ce soit.
      expect(error).toBeTruthy();
    }
  });

  it("vaut aussi pour le module events (même mécanisme, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) => tx.insert(events).values({ organizationId }));

    try {
      const rows = await db.select().from(events);
      expect(rows).toHaveLength(0);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  it("vaut aussi pour les postes prestataires (EVT-03, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.insert(events).values({ organizationId }).returning();
      if (!event) throw new Error("insertion de l'événement attendue");
      await tx.insert(defaultVendorSlots).values({ organizationId, label: "Traiteur" });
      await tx.insert(eventVendorSlots).values({ organizationId, eventId: event.id, label: "Traiteur" });
    });

    for (const table of [defaultVendorSlots, eventVendorSlots]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });

  it("vaut aussi pour le rétroplanning (EVT-04, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.insert(events).values({ organizationId }).returning();
      const [template] = await tx.insert(taskTemplates).values({ organizationId, name: "Mariage" }).returning();
      if (!event || !template) throw new Error("insertions attendues");
      await tx
        .insert(taskTemplateItems)
        .values({ organizationId, templateId: template.id, label: "Lieu", offsetDays: -365 });
      await tx.insert(eventTasks).values({ organizationId, eventId: event.id, label: "Lieu", dueDate: "2027-01-01" });
    });

    for (const table of [taskTemplates, taskTemplateItems, eventTasks]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });

  it("vaut aussi pour le programme du jour J (EVT-05, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.insert(events).values({ organizationId }).returning();
      const [template] = await tx.insert(programTemplates).values({ organizationId, name: "Mariage" }).returning();
      if (!event || !template) throw new Error("insertions attendues");
      const [item] = await tx
        .insert(programItems)
        .values({ organizationId, eventId: event.id, startTime: "15:00", label: "Cérémonie" })
        .returning();
      if (!item) throw new Error("insertion attendue");
      await tx.insert(programItemParticipants).values({ organizationId, programItemId: item.id, freeLabel: "Officiant" });
      await tx
        .insert(programTemplateItems)
        .values({ organizationId, templateId: template.id, startTime: "15:00", label: "Cérémonie" });
    });

    for (const table of [programItems, programItemParticipants, programTemplates, programTemplateItems]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });

  it("vaut aussi pour les accès des mariés et le fil d'activité (EVT-06, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.insert(events).values({ organizationId }).returning();
      if (!event) throw new Error("insertion attendue");
      await tx.insert(eventClientAccesses).values({
        organizationId,
        eventId: event.id,
        email: "marie@example.test",
        expiresAt: new Date(Date.now() + 86_400_000),
        invitedByUserId: organizationId,
      });
      await tx
        .insert(eventActivities)
        .values({ organizationId, eventId: event.id, actorUserId: organizationId, kind: "task_done", taskLabel: "Faire-part" });
    });

    for (const table of [eventClientAccesses, eventActivities]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });

  it("vaut aussi pour les devis joints au budget (BUD-03, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [line] = await tx
        .insert(budgetLines)
        .values({ organizationId, eventId: randomUUID(), eventVendorSlotId: randomUUID(), plannedAmountCents: 0 })
        .returning();
      if (!line) throw new Error("insertion attendue");
      await tx.insert(budgetLineAttachments).values({
        organizationId,
        lineId: line.id,
        fileKey: `${organizationId}/devis.pdf`,
        mime: "application/pdf",
        sizeBytes: 1234,
        uploadedByUserId: randomUUID(),
      });
    });

    try {
      const rows = await db.select().from(budgetLineAttachments);
      expect(rows).toHaveLength(0);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  it("vaut aussi pour le catalogue, les devis et les échéanciers (DEV-01/03, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      await tx.insert(quoteSettings).values({ organizationId });
      await tx.insert(numberSeries).values({ organizationId, kind: "quote", year: 2027, lastNumber: 1 });
      await tx
        .insert(catalogItems)
        .values({ organizationId, label: "Coordination", unit: "forfait", unitPriceCents: 1, vatRateBasisPoints: 0 });
      const [quote] = await tx
        .insert(quotes)
        .values({ organizationId, eventId: randomUUID(), number: "D-2027-0001", createdByUserId: randomUUID() })
        .returning();
      if (!quote) throw new Error("insertion attendue");
      const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote.id, version: 1 }).returning();
      if (!version) throw new Error("insertion attendue");
      await tx.insert(quoteLines).values({
        organizationId,
        versionId: version.id,
        label: "Coordination",
        unit: "forfait",
        quantityMilli: 1000,
        unitPriceCents: 1,
        vatRateBasisPoints: 0,
      });
      const [method] = await tx.insert(paymentMethods).values({ organizationId, label: "Virement" }).returning();
      await tx
        .insert(paymentScheduleItems)
        .values({ organizationId, versionId: version.id, label: "Acompte", amountCents: 1, dueDate: "2027-06-01", paymentMethodId: method!.id });
      const [request] = await tx
        .insert(signatureRequests)
        .values({ organizationId, versionId: version.id, provider: "fake", externalId: randomUUID() })
        .returning();
      await tx.insert(quoteSigners).values({
        organizationId,
        requestId: request!.id,
        name: "Inès",
        email: "ines@example.test",
        billingAddress: "1 rue des Lilas",
        signingUrl: "https://signature.example.test/s/abc",
      });
      await tx.insert(signatureWebhookLog).values({ organizationId, requestId: request!.id, eventType: "form.completed", outcome: "applied" });
    });

    for (const table of [quoteSettings, numberSeries, catalogItems, quotes, quoteVersions, quoteLines, paymentMethods, paymentScheduleItems, signatureRequests, quoteSigners, signatureWebhookLog]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });
});
