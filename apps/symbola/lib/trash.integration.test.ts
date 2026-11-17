// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille de 30 jours, « Annuler », purge réelle, tous
// modules confondus, contre un vrai PostgreSQL (RLS). Horloge simulée pour la purge (veille, jour
// même). Les abus : une autre organisation ne voit ni ne rend rien ; un commentaire ne revient que
// pour son auteur.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { EventLinkRights } from "@symbola/contracts";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { quotes } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import {
  addEventTask,
  addTaskComment,
  createEventLink,
  createProspect,
  createProspectSource,
  getEvent,
  listEventTasks,
  listTaskComments,
  openEventLink,
  removeEventTask,
  removeTaskComment,
} from "@/modules/events/service";
import { addContactNote, createContact, getContact, listContactNotes, removeContactNote } from "@/modules/hub/service";
import { addQuoteLine, createQuote, listQuotes } from "@/modules/quotes/service";
import {
  ContactDeletionRefusedError,
  deleteContact,
  deleteEvent,
  deleteForGood,
  EventDeletionRefusedError,
  listTrash,
  purgeOrganizationTrash,
  restoreFromTrash,
  TrashItemNotFoundError,
  undoDeletion,
} from "./trash";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const plannerId = randomUUID();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: "Morel" }], applyTemplate: false });
  const task = await addEventTask(organizationId, event.id, { label: "Envoyer les faire-part", dueDate: "2027-03-01", responsible: "planner" });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: plannerId });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination jour J", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000 });
  return { eventId: event.id, taskId: task.id, quoteId: quote.id };
}

describe("HUB-17 — Corbeille de 30 jours avec restauration", () => {
  it("un évènement supprimé disparaît avec son contenu et ses devis, puis revient entier", async () => {
    const organizationId = await organization();
    const { eventId, quoteId } = await wedding(organizationId);

    await deleteEvent(organizationId, eventId);
    expect(await getEvent(organizationId, eventId)).toBeNull();
    expect(await listEventTasks(organizationId, eventId)).toEqual([]);
    expect((await listQuotes(organizationId)).map((quote) => quote.id)).not.toContain(quoteId);
    const trash = await listTrash(organizationId);
    expect(trash).toEqual([expect.objectContaining({ kind: "event", id: eventId, label: "Inès" })]);

    await restoreFromTrash(organizationId, "event", eventId);
    expect(await getEvent(organizationId, eventId)).not.toBeNull();
    expect(await listEventTasks(organizationId, eventId)).toHaveLength(1);
    expect((await listQuotes(organizationId)).map((quote) => quote.id)).toContain(quoteId);
    expect(await listTrash(organizationId)).toEqual([]);
  });

  it("D4 — un évènement qui porte un devis signé ne se supprime pas (il s'annule)", async () => {
    const organizationId = await organization();
    const { eventId, quoteId } = await wedding(organizationId);
    await withDb((db) => withOrganization(db, organizationId, (tx) => tx.update(quotes).set({ status: "signed" }).where(eq(quotes.id, quoteId))));
    await expect(deleteEvent(organizationId, eventId)).rejects.toBeInstanceOf(EventDeletionRefusedError);
    expect(await getEvent(organizationId, eventId)).not.toBeNull();
  });

  it("un contact client d'un évènement ne se supprime pas ; un autre va à la corbeille et revient", async () => {
    const organizationId = await organization();
    const { eventId } = await wedding(organizationId);
    const event = await getEvent(organizationId, eventId);
    const clientId = event!.clients[0]!.contactId!;
    await expect(deleteContact(organizationId, clientId)).rejects.toBeInstanceOf(ContactDeletionRefusedError);

    const florist = await createContact(organizationId, { firstName: "Rose", lastName: "Fleuriste", email: `rose-${randomUUID()}@exemple.test` });
    await deleteContact(organizationId, florist.id);
    expect(await getContact(organizationId, florist.id)).toBeNull();
    await restoreFromTrash(organizationId, "contact", florist.id);
    expect(await getContact(organizationId, florist.id)).not.toBeNull();
  });

  it("abus — le lien personnel d'un évènement à la corbeille ne s'ouvre plus (même réponse qu'un lien retiré), puis revient avec lui", async () => {
    const organizationId = await organization();
    const { eventId } = await wedding(organizationId);
    const rights: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };
    const delivery = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Inès", email: `ines-${randomUUID()}@example.test`, rights } });
    const token = delivery.url.split("#")[1]!;
    await deleteEvent(organizationId, eventId);
    expect(await openEventLink(token)).toEqual({ outcome: "invalid" });
    await restoreFromTrash(organizationId, "event", eventId);
    expect((await openEventLink(token)).outcome).not.toBe("invalid");
  });

  it("une autre organisation ne voit ni ne rend la corbeille d'une autre", async () => {
    const owner = await organization();
    const other = await organization();
    const { eventId } = await wedding(owner);
    await deleteEvent(owner, eventId);
    expect(await listTrash(other)).toEqual([]);
    await expect(restoreFromTrash(other, "event", eventId)).rejects.toBeInstanceOf(TrashItemNotFoundError);
    await expect(deleteForGood(other, "event", eventId)).rejects.toBeInstanceOf(TrashItemNotFoundError);
    expect(await listTrash(owner)).toHaveLength(1);
  });
});

describe("UX-07 — Annuler plutôt que confirmer", () => {
  it("une tâche retirée revient par « Annuler »", async () => {
    const organizationId = await organization();
    const { eventId, taskId } = await wedding(organizationId);
    await removeEventTask(organizationId, taskId);
    expect(await listEventTasks(organizationId, eventId)).toEqual([]);
    await undoDeletion({ organizationId, userId: plannerId, kind: "task", id: taskId });
    expect(await listEventTasks(organizationId, eventId)).toHaveLength(1);
  });

  it("un commentaire ou une note ne revient que pour son auteur", async () => {
    const organizationId = await organization();
    const { taskId } = await wedding(organizationId);
    const comment = await addTaskComment({ organizationId, taskId, authorUserId: plannerId, body: "Relancer l'imprimeur" });
    await removeTaskComment({ organizationId, commentId: comment.id, authorUserId: plannerId });
    await expect(undoDeletion({ organizationId, userId: randomUUID(), kind: "taskComment", id: comment.id })).rejects.toBeInstanceOf(TrashItemNotFoundError);
    await undoDeletion({ organizationId, userId: plannerId, kind: "taskComment", id: comment.id });
    expect(await listTaskComments(organizationId, taskId)).toHaveLength(1);

    const contact = await createContact(organizationId, { firstName: "Léa", lastName: "Martin" });
    const note = await addContactNote(organizationId, { contactId: contact.id, authorUserId: plannerId, body: "Préfère le soir" });
    await removeContactNote(organizationId, { noteId: note.id, authorUserId: plannerId });
    expect(await listContactNotes(organizationId, contact.id)).toEqual([]);
    await undoDeletion({ organizationId, userId: plannerId, kind: "contactNote", id: note.id });
    expect(await listContactNotes(organizationId, contact.id)).toHaveLength(1);
  });
});

describe("DAT-03 — Suppression logique datée, puis purge réelle par tâche de fond", () => {
  it("un élément retiré est purgé après dix minutes, pas avant", async () => {
    const organizationId = await organization();
    const { eventId, taskId } = await wedding(organizationId);
    await removeEventTask(organizationId, taskId);
    await purgeOrganizationTrash(organizationId, new Date(Date.now() + 9 * MINUTE));
    await undoDeletion({ organizationId, userId: plannerId, kind: "task", id: taskId });
    expect(await listEventTasks(organizationId, eventId)).toHaveLength(1);

    await removeEventTask(organizationId, taskId);
    await purgeOrganizationTrash(organizationId, new Date(Date.now() + 11 * MINUTE));
    await expect(undoDeletion({ organizationId, userId: plannerId, kind: "task", id: taskId })).rejects.toBeInstanceOf(TrashItemNotFoundError);
  });

  it("un évènement reste 30 jours à la corbeille (veille : gardé), puis la purge l'efface pour de bon", async () => {
    const organizationId = await organization();
    const { eventId, quoteId } = await wedding(organizationId);
    await deleteEvent(organizationId, eventId);
    const deletedAt = (await listTrash(organizationId))[0]!.deletedAt;

    await purgeOrganizationTrash(organizationId, new Date(deletedAt.getTime() + 30 * DAY - MINUTE));
    expect(await listTrash(organizationId)).toHaveLength(1);

    const result = await purgeOrganizationTrash(organizationId, new Date(deletedAt.getTime() + 30 * DAY + MINUTE));
    expect(result.objects).toBe(1);
    expect(await listTrash(organizationId)).toEqual([]);
    await expect(restoreFromTrash(organizationId, "event", eventId)).rejects.toBeInstanceOf(TrashItemNotFoundError);
    const remaining = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.id, quoteId))));
    expect(remaining).toEqual([]);
  });

  it("la titulaire supprime définitivement un objet de la corbeille, sans attendre", async () => {
    const organizationId = await organization();
    const contact = await createContact(organizationId, { firstName: "Hugo", lastName: "Martin" });
    await deleteContact(organizationId, contact.id);
    await deleteForGood(organizationId, "contact", contact.id);
    expect(await listTrash(organizationId)).toEqual([]);
    await expect(restoreFromTrash(organizationId, "contact", contact.id)).rejects.toBeInstanceOf(TrashItemNotFoundError);
  });
});
