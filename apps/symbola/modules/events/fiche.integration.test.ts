// Lot 34b (EVT-03, CHR-02 ; D10 à D13) — fiche d'identité et tâches, contre un vrai PostgreSQL
// (RLS) et le stockage privé : une seule liste de lieux (le premier est le lieu de réception),
// invités, style et notes, tâche confiée à un prestataire retenu (visible et cochée dans son
// espace), pièces jointes contrôlées et commentaires réservés à l'équipe, RGPD, isolation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { EICAR_TEST_STRING } from "@symbola/files";
import type { EventLinkRights } from "@symbola/contracts";
import {
  addEventPlace,
  addEventTask,
  addEventVendorSlot,
  addTaskComment,
  addVendorCandidate,
  attachTaskFile,
  createEventLink,
  createProspect,
  createProspectSource,
  EventDocumentRejectedError,
  EventNotFoundError,
  EventPlaceNotFoundError,
  EventTaskNotFoundError,
  getEvent,
  getTaskAttachmentFile,
  getVendorLinkView,
  LinkAccessDeniedError,
  listEventActivity,
  listEventPlaces,
  listEvents,
  listTaskAttachments,
  listTaskComments,
  makeEventReceptionPlace,
  removeTaskAttachment,
  removeTaskComment,
  setEventIdentity,
  setEventVenue,
  setVendorLinkTaskDone,
  TaskAttachmentNotFoundError,
  TaskCommentNotFoundError,
  TaskVendorInvalidError,
  updateEventPlace,
  updateEventTask,
  updateVendorCandidate,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();
const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const NO_RIGHTS: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };
const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding(options: { venueName?: string | null; venueCity?: string | null } = {}) {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Maxime", lastName: "Durand" },
    ],
    eventDate: "2027-06-12",
    venueName: options.venueName === undefined ? "Domaine des Tilleuls" : options.venueName,
    venueCity: options.venueCity === undefined ? "Senlis" : options.venueCity,
  });
  return { organizationId, eventId: event.id };
}

// Un fleuriste retenu, un photographe seulement consulté, et le lien personnel de chacun.
async function vendors(organizationId: string, eventId: string) {
  const flowers = await addEventVendorSlot(organizationId, eventId, "Fleuriste");
  const photos = await addEventVendorSlot(organizationId, eventId, "Photographe");
  const florist = await addVendorCandidate({ organizationId, eventId, vendorSlotId: flowers.id, vendorName: "Fleurs de Lys" });
  await updateVendorCandidate({ organizationId, candidateId: florist.id, status: "retained", changedByUserId: plannerId });
  const photographer = await addVendorCandidate({ organizationId, eventId, vendorSlotId: photos.id, vendorName: "Studio Lumière" });
  const link = (vendorCandidateId: string, personName: string) =>
    createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "vendor", vendorCandidateId, locale: "fr", link: { personName, email: `${randomUUID()}@example.test`, rights: NO_RIGHTS } });
  return { floristId: florist.id, photographerId: photographer.id, linkId: (await link(florist.id, "Lys")).link.id, photographerLinkId: (await link(photographer.id, "Studio")).link.id };
}

describe("EVT-03 — Une seule liste de lieux, le premier est le lieu de réception (D10)", () => {
  it("le lieu saisi à la création est le premier lieu ; le lieu de réception de la fiche se lit et se modifie par lui", async () => {
    const { organizationId, eventId } = await wedding();
    expect((await listEventPlaces(organizationId, eventId)).map((place) => [place.label, place.city])).toEqual([["Domaine des Tilleuls", "Senlis"]]);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ venueName: "Domaine des Tilleuls", venueCity: "Senlis" });

    await setEventVenue(organizationId, eventId, { venueName: "Château de la Roche", venueCity: "Arras" });
    expect((await listEventPlaces(organizationId, eventId)).map((place) => place.label)).toEqual(["Château de la Roche"]);
    expect((await listEvents({ organizationId, search: "Arras" })).map((event) => event.id)).toEqual([eventId]);

    // Sans nom, la ville sert d'intitulé.
    const cityOnly = await wedding({ venueName: null, venueCity: "Amiens" });
    expect(await getEvent(cityOnly.organizationId, cityOnly.eventId)).toMatchObject({ venueName: "Amiens", venueCity: null });
  });

  it("chaque lieu porte adresse, ville, horaires et contact, contrôlés ; un autre lieu peut devenir le lieu de réception", async () => {
    const { organizationId, eventId } = await wedding();
    const church = await addEventPlace(organizationId, eventId, { label: "Église du village", city: "Senlis" });
    const updated = await updateEventPlace(organizationId, eventId, church.id, {
      label: "Église du village",
      address: "Place de l'Église",
      city: "Senlis",
      startTime: "14:30",
      endTime: "15:30",
      contactName: "Père Martin",
      contactPhone: "03 44 00 00 00",
      contactEmail: "paroisse@example.test",
    });
    expect(updated).toMatchObject({ startTime: "14:30", endTime: "15:30", contactName: "Père Martin", contactEmail: "paroisse@example.test" });
    await expect(updateEventPlace(organizationId, eventId, church.id, { label: "Église", startTime: "25:00" })).rejects.toBeInstanceOf(RangeError);
    await expect(updateEventPlace(organizationId, eventId, church.id, { label: "Église", contactEmail: "pas-un-mail" })).rejects.toBeInstanceOf(RangeError);
    await expect(updateEventPlace(organizationId, eventId, church.id, { label: " " })).rejects.toBeInstanceOf(RangeError);

    await makeEventReceptionPlace(organizationId, eventId, church.id);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ venueName: "Église du village", venueCity: "Senlis" });
    expect((await listEventPlaces(organizationId, eventId)).map((place) => place.label)).toEqual(["Église du village", "Domaine des Tilleuls"]);
  });
});

describe("EVT-03 — Fiche d'identité : invités, style, notes (D11)", () => {
  it("invités estimés et confirmés, style et notes s'enregistrent ; des valeurs hors bornes sont refusées", async () => {
    const { organizationId, eventId } = await wedding();
    await setEventIdentity(organizationId, eventId, { guestsEstimated: 120, guestsConfirmed: 98, style: " Bohème chic ", notes: "Allergie aux fruits à coque\nTable des enfants" });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ guestsEstimated: 120, guestsConfirmed: 98, style: "Bohème chic", notes: "Allergie aux fruits à coque\nTable des enfants" });

    await expect(setEventIdentity(organizationId, eventId, { guestsEstimated: -1, guestsConfirmed: null, style: null, notes: null })).rejects.toBeInstanceOf(RangeError);
    await expect(setEventIdentity(organizationId, eventId, { guestsEstimated: 2.5, guestsConfirmed: null, style: null, notes: null })).rejects.toBeInstanceOf(RangeError);
    await expect(setEventIdentity(organizationId, eventId, { guestsEstimated: null, guestsConfirmed: null, style: "x".repeat(2001), notes: null })).rejects.toBeInstanceOf(RangeError);
    await setEventIdentity(organizationId, eventId, { guestsEstimated: null, guestsConfirmed: null, style: "", notes: "  " });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ guestsEstimated: null, guestsConfirmed: null, style: null, notes: null });
  });
});

describe("CHR-02 — Tâche confiée à un prestataire retenu (D12)", () => {
  it("seul un prestataire engagé sur l'événement la reçoit ; il la voit et la coche dans son espace, au fil d'activité", async () => {
    const { organizationId, eventId } = await wedding();
    const { floristId, photographerId, linkId, photographerLinkId } = await vendors(organizationId, eventId);
    const other = await wedding();
    const otherVendors = await vendors(other.organizationId, other.eventId);
    const flowers = { label: "Livrer les fleurs", dueDate: "2027-06-11", responsible: "vendor" as const };

    await expect(addEventTask(organizationId, eventId, { ...flowers, vendorCandidateId: photographerId })).rejects.toBeInstanceOf(TaskVendorInvalidError);
    await expect(addEventTask(organizationId, eventId, { ...flowers, vendorCandidateId: otherVendors.floristId })).rejects.toBeInstanceOf(TaskVendorInvalidError);
    await expect(addEventTask(organizationId, eventId, flowers)).rejects.toBeInstanceOf(TaskVendorInvalidError);
    const task = await addEventTask(organizationId, eventId, { ...flowers, vendorCandidateId: floristId });
    expect(task).toMatchObject({ responsible: "vendor", vendorCandidateId: floristId });
    await addEventTask(organizationId, eventId, { label: "Envoyer les faire-part", dueDate: "2027-02-12", responsible: "clients" });

    // Son espace ne montre que ses tâches.
    expect((await getVendorLinkView(organizationId, linkId)).tasks).toEqual([{ id: task.id, label: "Livrer les fleurs", dueDate: "2027-06-11", done: false }]);
    expect((await getVendorLinkView(organizationId, photographerLinkId)).tasks).toEqual([]);

    await setVendorLinkTaskDone(organizationId, linkId, task.id, true);
    expect((await getVendorLinkView(organizationId, linkId)).tasks[0]).toMatchObject({ done: true });
    expect((await listEventActivity(organizationId, eventId)).map((entry) => [entry.kind, entry.taskLabel])).toContainEqual(["task_done", "Livrer les fleurs"]);
    // Ni un autre prestataire, ni une autre organisation ne la cochent.
    await expect(setVendorLinkTaskDone(organizationId, photographerLinkId, task.id, false)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(setVendorLinkTaskDone(other.organizationId, otherVendors.linkId, task.id, false)).rejects.toBeInstanceOf(LinkAccessDeniedError);

    // Rendue à la planner, elle quitte son espace.
    await updateEventTask({ organizationId, taskId: task.id, responsible: "planner" });
    expect((await getVendorLinkView(organizationId, linkId)).tasks).toEqual([]);
  });
});

describe("CHR-02 — Pièces jointes et commentaires d'une tâche, réservés à l'équipe (D13)", () => {
  it("un PDF se joint, se lit et se retire ; un contenu non accepté ou un virus est refusé sans rien enregistrer", async () => {
    const { organizationId, eventId } = await wedding();
    const task = await addEventTask(organizationId, eventId, { label: "Plan de table", dueDate: "2027-05-29", responsible: "planner" });
    const attachment = await attachTaskFile({ organizationId, taskId: task.id, label: "Plan de table V2", content: TINY_PDF, uploadedByUserId: plannerId });
    expect(attachment).toMatchObject({ taskId: task.id, eventId, label: "Plan de table V2", mime: "application/pdf" });
    expect((await getTaskAttachmentFile(organizationId, attachment.id)).contentType).toBe("application/pdf");

    await expect(attachTaskFile({ organizationId, taskId: task.id, label: "Notes", content: new TextEncoder().encode("bonjour"), uploadedByUserId: plannerId })).rejects.toMatchObject({ reason: "unsupported_type" });
    await expect(attachTaskFile({ organizationId, taskId: task.id, label: "Virus", content: new TextEncoder().encode(EICAR_TEST_STRING), uploadedByUserId: plannerId })).rejects.toBeInstanceOf(EventDocumentRejectedError);
    expect((await listTaskAttachments(organizationId, task.id)).map((entry) => entry.label)).toEqual(["Plan de table V2"]);

    // Une autre organisation ne joint, ne lit ni ne retire rien.
    const other = await wedding();
    await expect(attachTaskFile({ organizationId: other.organizationId, taskId: task.id, label: "Intrus", content: TINY_PDF, uploadedByUserId: plannerId })).rejects.toBeInstanceOf(EventTaskNotFoundError);
    expect(await listTaskAttachments(other.organizationId, task.id)).toEqual([]);
    await expect(getTaskAttachmentFile(other.organizationId, attachment.id)).rejects.toBeInstanceOf(TaskAttachmentNotFoundError);
    await expect(removeTaskAttachment(other.organizationId, attachment.id)).rejects.toBeInstanceOf(TaskAttachmentNotFoundError);

    await removeTaskAttachment(organizationId, attachment.id);
    expect(await listTaskAttachments(organizationId, task.id)).toEqual([]);
    await expect(getTaskAttachmentFile(organizationId, attachment.id)).rejects.toBeInstanceOf(TaskAttachmentNotFoundError);
  });

  it("le fil garde auteur, date et texte ; seul l'auteur retire son commentaire ; une autre organisation n'y a pas accès", async () => {
    const { organizationId, eventId } = await wedding();
    const task = await addEventTask(organizationId, eventId, { label: "Dégustation", dueDate: "2027-03-14", responsible: "planner" });
    const colleague = randomUUID();
    const first = await addTaskComment({ organizationId, taskId: task.id, authorUserId: plannerId, body: " Le traiteur propose le jeudi.\nÀ confirmer. " });
    await addTaskComment({ organizationId, taskId: task.id, authorUserId: colleague, body: "Jeudi me va." });
    expect((await listTaskComments(organizationId, task.id)).map((comment) => [comment.authorUserId, comment.body])).toEqual([
      [plannerId, "Le traiteur propose le jeudi.\nÀ confirmer."],
      [colleague, "Jeudi me va."],
    ]);
    await expect(addTaskComment({ organizationId, taskId: task.id, authorUserId: plannerId, body: "   " })).rejects.toBeInstanceOf(RangeError);
    await expect(removeTaskComment({ organizationId, commentId: first.id, authorUserId: colleague })).rejects.toBeInstanceOf(TaskCommentNotFoundError);

    const other = await wedding();
    await expect(addTaskComment({ organizationId: other.organizationId, taskId: task.id, authorUserId: plannerId, body: "Intrus" })).rejects.toBeInstanceOf(EventTaskNotFoundError);
    expect(await listTaskComments(other.organizationId, task.id)).toEqual([]);
    await expect(removeTaskComment({ organizationId: other.organizationId, commentId: first.id, authorUserId: plannerId })).rejects.toBeInstanceOf(TaskCommentNotFoundError);

    await removeTaskComment({ organizationId, commentId: first.id, authorUserId: plannerId });
    expect((await listTaskComments(organizationId, task.id)).map((comment) => comment.body)).toEqual(["Jeudi me va."]);
  });
});

describe("RGPD — Contact des lieux, notes, commentaires et pièces jointes (privacy/v1)", () => {
  it("trouvés par la recherche ; effacés quand l'oubli vise l'événement, fichiers compris", async () => {
    const { organizationId, eventId } = await wedding();
    const name = `Vasseur${randomUUID().slice(0, 6)}`;
    const place = (await listEventPlaces(organizationId, eventId))[0]!;
    await updateEventPlace(organizationId, eventId, place.id, { label: place.label, contactName: `Hélène ${name}`, contactPhone: "01 99 00 01 00" });
    await setEventIdentity(organizationId, eventId, { guestsEstimated: 120, guestsConfirmed: null, style: null, notes: `Rappeler ${name} pour le parking` });
    const task = await addEventTask(organizationId, eventId, { label: "Parking", dueDate: "2027-06-01", responsible: "planner" });
    await addTaskComment({ organizationId, taskId: task.id, authorUserId: plannerId, body: `${name} réserve le parking` });
    const attachment = await attachTaskFile({ organizationId, taskId: task.id, label: `Accès ${name}`, content: TINY_PDF, uploadedByUserId: plannerId });

    const found = await eventsPrivacy.find({ organizationId, terms: { name } });
    expect(found.map((record) => record.kind).sort()).toEqual(["event", "event_place", "task_attachment", "task_comment"]);

    await eventsPrivacy.erase({ organizationId, records: [{ kind: "event", recordId: eventId }], rules, today: "2026-11-14" });
    expect(await eventsPrivacy.find({ organizationId, terms: { name } })).toEqual([]);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ guestsEstimated: 120, notes: null, venueName: null });
    expect(await listTaskComments(organizationId, task.id)).toEqual([]);
    await expect(getTaskAttachmentFile(organizationId, attachment.id)).rejects.toBeInstanceOf(TaskAttachmentNotFoundError);
  });

  it("isolation : une autre organisation ne modifie ni les lieux ni la fiche", async () => {
    const { organizationId, eventId } = await wedding();
    const other = await wedding();
    const place = (await listEventPlaces(organizationId, eventId))[0]!;
    await expect(updateEventPlace(other.organizationId, eventId, place.id, { label: "Intrus" })).rejects.toBeInstanceOf(EventPlaceNotFoundError);
    await expect(makeEventReceptionPlace(other.organizationId, eventId, place.id)).rejects.toBeInstanceOf(EventPlaceNotFoundError);
    await expect(setEventIdentity(other.organizationId, eventId, { guestsEstimated: 1, guestsConfirmed: 1, style: null, notes: null })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ venueName: "Domaine des Tilleuls", guestsEstimated: null });
  });
});
