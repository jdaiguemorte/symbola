// Lot 58 (PAR-09, PRE-08, EVT-08 ; D4, D5 ; ADR 0097) — clôture d'un évènement, évaluation des
// prestataires, bilan, archivage, modèle et duplication, contre un vrai PostgreSQL (RLS) : horloge
// simulée (J+1 dans le fuseau de l'évènement), envoi de la demande d'avis relu, tests d'abus (lecture
// seule d'un archivé, prestataire non retenu, autre organisation).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addBudgetLine, listBudgetLines } from "@/modules/budget/service";
import {
  addEventTask,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  archiveEvent,
  changeEventStatus,
  closingDue,
  createProspect,
  createProspectSource,
  draftReviewRequest,
  EventArchivedError,
  EventNotClosableError,
  EventNotFoundError,
  EventTemplateInvalidError,
  getClosingSettings,
  getEvent,
  getEventClosing,
  getEventTemplate,
  listClosingCandidates,
  listEvents,
  listEventTasks,
  listEventTemplates,
  listEventVendorSlots,
  listVendorCandidates,
  ReviewRequestError,
  saveClosingNotes,
  saveClosingSettings,
  sendReviewRequest,
  unarchiveEvent,
  updateVendorCandidate,
  type ReviewRecipient,
} from "@/modules/events/service";
import { addCommission, listEventQuotes, setPlannerFeeTerms } from "@/modules/quotes/service";
import { createVendor, getVendorCollaborationHistory } from "@/modules/vendors/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createEventFromTemplate, duplicateEvent, saveEventAsTemplate } from "@/lib/events/event-templates";
import { closeEventNow, EvaluationNotAllowedError, evaluateEventVendor, loadClosing } from "./load";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function atelier() {
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, siren: "123456789", metier: "wedding_planner" });
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const eventId = (
    await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, eventDate: "2027-06-12", clients: [{ firstName: "Léa", lastName: "Martin", email: `lea-${randomUUID()}@example.test` }], applyTemplate: false })
  ).id;
  await changeEventStatus({ organizationId, eventId, changedByUserId: planner.id, toStatus: "confirmed" });
  // Rétroplanning, programme, un poste avec une ligne de budget et un prestataire retenu du carnet.
  await addEventTask(organizationId, eventId, { label: "Réserver le lieu", dueDate: "2026-09-15", responsible: "planner" });
  await addEventTask(organizationId, eventId, { label: "Essayage", dueDate: "2027-05-12", responsible: "clients" });
  await addProgramItem(organizationId, eventId, { startTime: "15:00", endTime: "16:00", label: "Cérémonie laïque", vendorSlotIds: [], freeParticipants: [] });
  const caterer = await addEventVendorSlot(organizationId, eventId, "Traiteur");
  await addBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer.id, label: "Menu" });
  const { vendor } = await createVendor(organizationId, { name: "Maison Haddad", typeId: null });
  const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Haddad", vendorId: vendor.id });
  await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: planner.id });
  const photographer = await addEventVendorSlot(organizationId, eventId, "Photographe");
  const { vendor: other } = await createVendor(organizationId, { name: "Studio Lumière", typeId: null });
  await addVendorCandidate({ organizationId, eventId, vendorSlotId: photographer.id, vendorName: "Studio Lumière", vendorId: other.id });
  return { organizationId, plannerId: planner.id, eventId, vendorId: vendor.id, otherVendorId: other.id };
}

type Atelier = Awaited<ReturnType<typeof atelier>>;

async function recipients(context: Atelier): Promise<ReviewRecipient[]> {
  const event = (await getEvent(context.organizationId, context.eventId))!;
  return event.clients.filter((client) => client.email && client.contactId).map((client) => ({ contactId: client.contactId!, firstName: client.firstName, email: client.email! }));
}

describe("PAR-09 — Clôturer et capitaliser (lot 58)", () => {
  it("à J+1, dans le fuseau de l'évènement, il est « À clôturer » ; la liste dit ce qui reste (soldes, échéances, commissions, évaluations, leçons, avis), le temps passé reste facultatif", async () => {
    const context = await atelier();
    const event = (await getEvent(context.organizationId, context.eventId))!;
    expect(closingDue(event, new Date("2027-06-12T21:00:00Z"))).toBe(false);
    expect(closingDue(event, new Date("2027-06-12T22:30:00Z"))).toBe(true);
    expect((await listClosingCandidates(context.organizationId)).map((row) => row.id)).toContain(context.eventId);
    const state = (await loadClosing(context.organizationId, context.eventId))!;
    expect(state.items.map((item) => [item.step, item.status])).toEqual([
      ["balance_invoice", "done"],
      ["vendor_payments", "done"],
      ["commissions", "done"],
      ["evaluations", "todo"],
      ["time_spent", "optional"],
      ["lessons", "todo"],
      ["review_request", "todo"],
    ]);
    expect(state.complete).toBe(false);
  });

  it("la demande d'avis prend le lien réglé par la planner, se relit et se modifie avant l'envoi ; sans lien, seulement le remerciement ; une variable restée vide arrête tout", async () => {
    const context = await atelier();
    expect(draftReviewRequest({ locale: "fr", firstNames: ["Léa"], organization: "Atelier", reviewUrl: null })).toMatchObject({ withReview: false });
    await expect(saveClosingSettings(context.organizationId, { reviewUrl: "http://avis.example.test", reviewLabel: null })).rejects.toThrow();
    await saveClosingSettings(context.organizationId, { reviewUrl: "https://g.page/r/atelier-avis", reviewLabel: "Google" });
    const settings = await getClosingSettings(context.organizationId);
    const draft = draftReviewRequest({ locale: "fr", firstNames: ["Léa"], organization: "Atelier", reviewUrl: settings.reviewUrl });
    expect(draft.withReview).toBe(true);
    expect(draft.body).toContain("https://g.page/r/atelier-avis");
    expect(draft.body).toContain("Bonjour Léa");
    const sent: { to: string; subject: string; body: string }[] = [];
    const sendMail = async (recipient: ReviewRecipient, text: { subject: string; body: string }) => {
      sent.push({ to: recipient.email, ...text });
    };
    const to = await recipients(context);
    await expect(sendReviewRequest({ organizationId: context.organizationId, eventId: context.eventId, recipients: to, subject: draft.subject, body: `${draft.body}\n{{prénom}}`, withReview: true, sendMail })).rejects.toBeInstanceOf(ReviewRequestError);
    expect(sent).toEqual([]);
    const edited = `${draft.body}\n\nP.-S. Les photos arrivent la semaine prochaine.`;
    const closing = await sendReviewRequest({ organizationId: context.organizationId, eventId: context.eventId, recipients: to, subject: draft.subject, body: edited, withReview: true, sendMail });
    expect(sent).toEqual([{ to: to[0]!.email, subject: draft.subject, body: edited }]);
    expect(closing).toMatchObject({ reviewRequestKind: "thanks_with_review" });
    expect(closing.reviewRequestedAt).not.toBeNull();
  });

  it("bilan : marge = honoraires + commissions − frais propres, au centime ; sans temps saisi, pas de marge par heure ; le budget final se fige à la clôture", async () => {
    const context = await atelier();
    await setPlannerFeeTerms(context.organizationId, context.eventId, { kind: "flat", flatCents: 350_000, percentBasisPoints: null, base: "estimated" });
    await addCommission(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, vendorName: "Maison Haddad", nature: "commission", amountCents: 42_050 });
    await saveClosingNotes(context.organizationId, context.eventId, { ownExpenses: [{ label: "Déplacements", amountCents: 12_033 }, { label: "Sous-traitance", amountCents: 6_000 }] });
    let state = (await loadClosing(context.organizationId, context.eventId))!;
    expect(state.financial).toMatchObject({ feesCents: 350_000, commissionsCents: 42_050, ownExpensesCents: 18_033, marginCents: 374_017, marginPerHourCents: null });
    expect(state.items.find((item) => item.step === "commissions")).toMatchObject({ status: "todo", count: 1 });
    await saveClosingNotes(context.organizationId, context.eventId, { timeSpentMinutes: 60 * 40 });
    state = (await loadClosing(context.organizationId, context.eventId))!;
    expect(state.financial.marginPerHourCents).toBe(9_350);
    const closed = await closeEventNow(context.organizationId, context.eventId, context.plannerId, new Date("2027-06-13T08:00:00Z"));
    expect(closed.budgetSnapshot).toEqual({ estimatedCents: 0, committedCents: 0, paidCents: 0, remainingCents: 0, varianceCents: 0 });
    expect((await getEvent(context.organizationId, context.eventId))!.status).toBe("closed");
    expect((await listClosingCandidates(context.organizationId)).map((row) => row.id)).not.toContain(context.eventId);
  });

  it("clôture complète en moins de quinze minutes (chronométrée) : évaluation, leçons, frais, avis, clôture, archivage", async () => {
    const context = await atelier();
    const started = performance.now();
    await evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 5, punctuality: 5, quality: 5, value: null, comment: "Service impeccable" });
    await saveClosingNotes(context.organizationId, context.eventId, { lessons: ["Prévoir un plan B pluie", "Confirmer le traiteur à J-7", "Doubler les navettes"], ownExpenses: [{ label: "Déplacements", amountCents: 9_000 }] });
    const draft = draftReviewRequest({ locale: "fr", firstNames: ["Léa"], organization: "Atelier", reviewUrl: null });
    await sendReviewRequest({ organizationId: context.organizationId, eventId: context.eventId, recipients: await recipients(context), subject: draft.subject, body: draft.body, withReview: false, sendMail: async () => {} });
    const state = (await loadClosing(context.organizationId, context.eventId))!;
    expect(state.complete).toBe(true);
    await closeEventNow(context.organizationId, context.eventId, context.plannerId);
    await archiveEvent({ organizationId: context.organizationId, eventId: context.eventId, userId: context.plannerId });
    expect(performance.now() - started).toBeLessThan(15 * 60 * 1000);
  });

  it("archivage : seulement un évènement terminé ; il sort des listes courantes, reste consultable (filtre « Archivés »), en lecture seule ; il se désarchive", async () => {
    const context = await atelier();
    await expect(archiveEvent({ organizationId: context.organizationId, eventId: context.eventId, userId: context.plannerId })).rejects.toBeInstanceOf(EventNotClosableError);
    await closeEventNow(context.organizationId, context.eventId, context.plannerId);
    await archiveEvent({ organizationId: context.organizationId, eventId: context.eventId, userId: context.plannerId });
    expect((await listEvents({ organizationId: context.organizationId, archived: "exclude" })).map((event) => event.id)).not.toContain(context.eventId);
    expect((await listEvents({ organizationId: context.organizationId, archived: "only" })).map((event) => event.id)).toEqual([context.eventId]);
    expect((await getEvent(context.organizationId, context.eventId))!.archivedAt).not.toBeNull();
    // Lecture seule (test d'abus) : tâches, notes de clôture, évaluation, statut.
    await expect(addEventTask(context.organizationId, context.eventId, { label: "Ajout", dueDate: "2027-07-01", responsible: "planner" })).rejects.toBeInstanceOf(EventArchivedError);
    await expect(saveClosingNotes(context.organizationId, context.eventId, { lessons: ["Trop tard"] })).rejects.toBeInstanceOf(EventArchivedError);
    await expect(evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 3, punctuality: null, quality: null, value: null, comment: null })).rejects.toBeInstanceOf(EventArchivedError);
    await expect(changeEventStatus({ organizationId: context.organizationId, eventId: context.eventId, changedByUserId: context.plannerId, toStatus: "option" })).rejects.toBeInstanceOf(EventArchivedError);
    await unarchiveEvent({ organizationId: context.organizationId, eventId: context.eventId, userId: context.plannerId });
    await saveClosingNotes(context.organizationId, context.eventId, { lessons: ["Désarchivé"] });
    expect((await listEvents({ organizationId: context.organizationId, archived: "exclude" })).map((event) => event.id)).toContain(context.eventId);
  });

  it("isolation : une autre organisation ne lit ni la clôture, ni les réglages, ni n'archive ou ne clôture l'évènement", async () => {
    const context = await atelier();
    await saveClosingNotes(context.organizationId, context.eventId, { lessons: ["Secret"], timeSpentMinutes: 600 });
    await saveClosingSettings(context.organizationId, { reviewUrl: "https://g.page/r/atelier-avis", reviewLabel: "Google" });
    const other = await atelier();
    expect(await getEventClosing(other.organizationId, context.eventId)).toBeNull();
    expect(await loadClosing(other.organizationId, context.eventId)).toBeNull();
    expect(await getClosingSettings(other.organizationId)).toEqual({ reviewUrl: null, reviewLabel: null });
    await expect(saveClosingNotes(other.organizationId, context.eventId, { lessons: ["Intrusion"] })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(archiveEvent({ organizationId: other.organizationId, eventId: context.eventId, userId: other.plannerId })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(closeEventNow(other.organizationId, context.eventId, other.plannerId)).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await getEventClosing(context.organizationId, context.eventId))!.lessons).toEqual(["Secret"]);
  });
});

describe("PRE-08 — Évaluation après l'évènement et historique des collaborations (lot 58)", () => {
  it("note et critères pour un prestataire retenu ; l'historique donne la moyenne et la dernière collaboration ; une nouvelle note remplace l'ancienne pour le même évènement", async () => {
    const context = await atelier();
    await evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 3, punctuality: 2, quality: null, value: null, comment: null });
    await evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 4, punctuality: 5, quality: 4, value: 3, comment: "Très pro" });
    const second = await duplicateEvent(context.organizationId, context.eventId, { eventDate: "2028-06-10", userId: context.plannerId, locale: "fr", includeVendors: true });
    const candidate = (await listVendorCandidates(context.organizationId, second)).find((entry) => entry.vendorId === context.vendorId)!;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidate.id, status: "retained", changedByUserId: context.plannerId });
    await evaluateEventVendor(context.organizationId, { eventId: second, vendorId: context.vendorId, userId: context.plannerId, rating: 5, punctuality: null, quality: null, value: null, comment: null });
    const history = await getVendorCollaborationHistory(context.organizationId, context.vendorId);
    expect(history).toMatchObject({ count: 2, averageTenths: 45 });
    expect(history.evaluations.map((evaluation) => [evaluation.eventId, evaluation.rating])).toEqual([
      [second, 5],
      [context.eventId, 4],
    ]);
    expect(history.evaluations[1]).toMatchObject({ punctuality: 5, quality: 4, value: 3, comment: "Très pro" });
  });

  it("abus : un prestataire non retenu ne s'évalue pas ; une note hors de 1 à 5 est refusée ; une autre organisation ne voit rien et n'évalue rien", async () => {
    const context = await atelier();
    await expect(evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.otherVendorId, userId: context.plannerId, rating: 2, punctuality: null, quality: null, value: null, comment: null })).rejects.toBeInstanceOf(EvaluationNotAllowedError);
    await expect(evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 0, punctuality: null, quality: null, value: null, comment: null })).rejects.toThrow();
    await evaluateEventVendor(context.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: context.plannerId, rating: 4, punctuality: null, quality: null, value: null, comment: "Interne" });
    const other = await atelier();
    expect(await getVendorCollaborationHistory(other.organizationId, context.vendorId)).toMatchObject({ count: 0, evaluations: [] });
    await expect(evaluateEventVendor(other.organizationId, { eventId: context.eventId, vendorId: context.vendorId, userId: other.plannerId, rating: 1, punctuality: null, quality: null, value: null, comment: null })).rejects.toBeInstanceOf(EventNotFoundError);
  });
});

describe("EVT-08 — Duplication et modèle d'évènement (lot 58)", () => {
  it("dupliquer à une autre date : rétroplanning recalculé, programme, postes et lignes du budget sans montant ; ni client, ni devis", async () => {
    const context = await atelier();
    const copyId = await duplicateEvent(context.organizationId, context.eventId, { eventDate: "2028-06-17", userId: context.plannerId, locale: "fr", includeVendors: false });
    const copy = (await getEvent(context.organizationId, copyId))!;
    expect(copy).toMatchObject({ status: "option", eventDate: "2028-06-17", clients: [] });
    const tasks = await listEventTasks(context.organizationId, copyId);
    expect(tasks.map((task) => [task.label, task.dueDate])).toEqual(expect.arrayContaining([["Réserver le lieu", "2027-09-21"], ["Essayage", "2028-05-17"]]));
    const lines = await listBudgetLines(context.organizationId, copyId);
    expect((await listEventVendorSlots(context.organizationId, copyId)).map((slot) => slot.label)).toEqual(["Traiteur", "Photographe"]);
    expect(lines.categories.map((category) => category.label)).toEqual(["Traiteur"]);
    expect(lines.lines.filter((line) => line.label === "Menu").map((line) => line.estimatedAmountCents)).toEqual([null]);
    expect(await listVendorCandidates(context.organizationId, copyId)).toEqual([]);
    expect(await listEventQuotes(context.organizationId, copyId)).toEqual([]);
  });

  it("enregistrer comme modèle : aucune donnée personnelle ; le contrôle refuse un nom de client, un e-mail ou un téléphone et dit où ; les prestataires seulement si la case est cochée", async () => {
    const context = await atelier();
    const plain = await saveEventAsTemplate(context.organizationId, context.eventId, { name: "Mariage champêtre", includeVendors: false });
    expect(plain.content.vendors).toEqual([]);
    expect(JSON.stringify(plain.content)).not.toMatch(/Léa|Martin|@/);
    const withVendors = await saveEventAsTemplate(context.organizationId, context.eventId, { name: "Mariage champêtre avec traiteur", includeVendors: true });
    expect(withVendors.content.vendors).toEqual([{ slotLabel: "Traiteur", vendorId: context.vendorId, name: "Maison Haddad" }]);
    await expect(saveEventAsTemplate(context.organizationId, context.eventId, { name: "Mariage Martin", includeVendors: false })).rejects.toMatchObject({ reason: "personal_data", findings: [{ place: "name", label: "Mariage Martin", kind: "client_name" }] });
    await addEventTask(context.organizationId, context.eventId, { label: "Rappeler Léa au 06 12 34 56 78", dueDate: "2027-06-01", responsible: "planner" });
    const refused = await saveEventAsTemplate(context.organizationId, context.eventId, { name: "Mariage", includeVendors: false }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(EventTemplateInvalidError);
    expect((refused as EventTemplateInvalidError).findings).toEqual([
      { place: "task", label: "Rappeler Léa au 06 12 34 56 78", kind: "phone" },
      { place: "task", label: "Rappeler Léa au 06 12 34 56 78", kind: "client_name" },
    ]);
    await expect(duplicateEvent(context.organizationId, context.eventId, { eventDate: "2028-06-17", userId: context.plannerId, locale: "fr", includeVendors: false })).rejects.toBeInstanceOf(EventTemplateInvalidError);
    const created = await createEventFromTemplate(context.organizationId, withVendors.id, { eventDate: "2029-05-26", userId: context.plannerId, locale: "fr" });
    expect((await listVendorCandidates(context.organizationId, created)).map((candidate) => [candidate.vendorName, candidate.status])).toEqual([["Maison Haddad", "shortlisted"]]);
    expect((await getEvent(context.organizationId, created))!.clients).toEqual([]);
  });

  it("isolation : une autre organisation ne lit ni n'emploie les modèles", async () => {
    const context = await atelier();
    const template = await saveEventAsTemplate(context.organizationId, context.eventId, { name: "Mariage champêtre", includeVendors: false });
    const other = await atelier();
    expect(await listEventTemplates(other.organizationId)).toEqual([]);
    expect(await getEventTemplate(other.organizationId, template.id)).toBeNull();
    await expect(createEventFromTemplate(other.organizationId, template.id, { eventDate: "2029-01-01", userId: other.plannerId, locale: "fr" })).rejects.toThrow();
    await expect(saveEventAsTemplate(other.organizationId, context.eventId, { name: "Vol", includeVendors: true })).rejects.toBeInstanceOf(EventNotFoundError);
  });
});
