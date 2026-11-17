// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — une ligne supprimée est cachée par la base : ni lue,
// ni modifiée, ni supprimée, sauf quand la transaction voit la corbeille (includingDeleted) ; le
// contenu d'un évènement supprimé est caché avec lui. PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { includingDeleted } from "./actor";
import { createAppConnection } from "./client";
import { budgetLines, vendorPayments } from "./schema/budget";
import { eventPlaces, events, eventTaskComments, eventTasks, programItems } from "./schema/events";
import { contactMembers, contacts } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const deletedNow = { deletedAt: dsql`now()`, deletedBy: dsql`nullif(current_setting('app.actor_id', true), '')::uuid` };

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
  return row;
}

async function refusal(work: Promise<unknown>): Promise<string> {
  return work.then(
    () => "",
    (error: unknown) => String((error as { cause?: unknown }).cause ?? error),
  );
}

async function seedEventWithTask(organizationId: string) {
  return withOrganization(db, organizationId, async (tx) => {
    const event = first(await tx.insert(events).values({ organizationId }).returning());
    const task = first(await tx.insert(eventTasks).values({ organizationId, eventId: event.id, label: "Envoyer les faire-part", dueDate: "2027-03-01" }).returning());
    return { event, task };
  });
}

describe("DAT-03 — Suppression logique cachée par la base (ADR 0073)", () => {
  it("une ligne marquée disparaît des lectures, ne se modifie plus, et reparaît quand la transaction voit la corbeille", async () => {
    const organizationId = randomUUID();
    const { event, task } = await seedEventWithTask(organizationId);
    await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.update(eventTasks).set(deletedNow).where(eq(eventTasks.id, task.id))));

    const visible = await withOrganization(db, organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, event.id)));
    expect(visible).toEqual([]);
    const updated = await withOrganization(db, organizationId, (tx) => tx.update(eventTasks).set({ label: "modifiée" }).where(eq(eventTasks.id, task.id)).returning());
    expect(updated).toEqual([]);
    const removed = await withOrganization(db, organizationId, (tx) => tx.delete(eventTasks).where(eq(eventTasks.id, task.id)).returning());
    expect(removed).toEqual([]);

    const trashed = await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.id, task.id))));
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.deletedAt).toBeInstanceOf(Date);
    expect(trashed[0]?.label).toBe("Envoyer les faire-part");
  });

  it("marquer une ligne hors des fonctions de la corbeille est refusé par la base", async () => {
    const organizationId = randomUUID();
    const { task } = await seedEventWithTask(organizationId);
    const message = await refusal(withOrganization(db, organizationId, (tx) => tx.update(eventTasks).set(deletedNow).where(eq(eventTasks.id, task.id))));
    expect(message).toMatch(/row-level security/);
  });

  it("HUB-17 — le contenu d'un évènement supprimé est caché avec lui, puis revient entier à la restauration", async () => {
    const organizationId = randomUUID();
    const { event, task } = await seedEventWithTask(organizationId);
    await withOrganization(db, organizationId, async (tx) => {
      await tx.insert(programItems).values({ organizationId, eventId: event.id, label: "Cérémonie", startTime: "15:00" });
      await tx.insert(eventPlaces).values({ organizationId, eventId: event.id, label: "Domaine des Roses" });
      await tx.insert(eventTaskComments).values({ organizationId, eventId: event.id, taskId: task.id, body: "Relancer l'imprimeur" });
    });
    const count = async () =>
      withOrganization(db, organizationId, async (tx) => ({
        tasks: (await tx.select().from(eventTasks)).length,
        program: (await tx.select().from(programItems)).length,
        places: (await tx.select().from(eventPlaces)).length,
        comments: (await tx.select().from(eventTaskComments)).length,
      }));
    expect(await count()).toEqual({ tasks: 1, program: 1, places: 1, comments: 1 });

    await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.update(events).set(deletedNow).where(eq(events.id, event.id))));
    expect(await count()).toEqual({ tasks: 0, program: 0, places: 0, comments: 0 });
    const blocked = await refusal(withOrganization(db, organizationId, (tx) => tx.insert(eventTasks).values({ organizationId, eventId: event.id, label: "Nouvelle", dueDate: "2027-03-02" })));
    expect(blocked).toMatch(/row-level security/);

    await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.update(events).set({ deletedAt: null, deletedBy: null }).where(eq(events.id, event.id))));
    expect(await count()).toEqual({ tasks: 1, program: 1, places: 1, comments: 1 });
  });

  it("une organisation ne voit jamais la corbeille d'une autre, même en la demandant", async () => {
    const owner = randomUUID();
    const other = randomUUID();
    const { task } = await seedEventWithTask(owner);
    await includingDeleted(() => withOrganization(db, owner, (tx) => tx.update(eventTasks).set(deletedNow).where(eq(eventTasks.id, task.id))));
    const seen = await includingDeleted(() => withOrganization(db, other, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.id, task.id))));
    expect(seen).toEqual([]);
    const restored = await includingDeleted(() =>
      withOrganization(db, other, (tx) => tx.update(eventTasks).set({ deletedAt: null }).where(eq(eventTasks.id, task.id)).returning()),
    );
    expect(restored).toEqual([]);
  });

  it("un contact à la corbeille ne retient pas son adresse e-mail, et ses liens de foyer sont cachés avec lui", async () => {
    const organizationId = randomUUID();
    const email = `lea-${randomUUID()}@exemple.test`;
    const { lea, household } = await withOrganization(db, organizationId, async (tx) => {
      const lea = first(await tx.insert(contacts).values({ organizationId, firstName: "Léa", lastName: "Martin", email }).returning());
      const household = first(await tx.insert(contacts).values({ organizationId, kind: "household", name: "Foyer Martin" }).returning());
      await tx.insert(contactMembers).values({ organizationId, groupContactId: household.id, memberContactId: lea.id });
      return { lea, household };
    });
    await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.update(contacts).set(deletedNow).where(eq(contacts.id, lea.id))));

    const members = await withOrganization(db, organizationId, (tx) => tx.select().from(contactMembers).where(eq(contactMembers.groupContactId, household.id)));
    expect(members).toEqual([]);
    const again = await withOrganization(db, organizationId, (tx) => tx.insert(contacts).values({ organizationId, firstName: "Léa", lastName: "Martin", email }).returning());
    expect(again).toHaveLength(1);
  });

  it("les paiements d'une ligne de budget supprimée sont cachés avec elle", async () => {
    const organizationId = randomUUID();
    const eventId = randomUUID();
    const line = await withOrganization(db, organizationId, async (tx) => {
      const line = first(await tx.insert(budgetLines).values({ organizationId, eventId, eventVendorSlotId: randomUUID(), label: "Dîner", committedAmountCents: 960000 }).returning());
      await tx.insert(vendorPayments).values({ organizationId, eventId, lineId: line.id, label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-04-09" });
      return line;
    });
    await includingDeleted(() => withOrganization(db, organizationId, (tx) => tx.update(budgetLines).set(deletedNow).where(eq(budgetLines.id, line.id))));
    const payments = await withOrganization(db, organizationId, (tx) => tx.select().from(vendorPayments).where(eq(vendorPayments.eventId, eventId)));
    expect(payments).toEqual([]);
  });
});
