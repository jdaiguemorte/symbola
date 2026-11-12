// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décisions demandées au
// client, contre un vrai PostgreSQL (RLS) : demande au contenu figé, réponse
// horodatée et nominative par la première personne qui a la rubrique, garde
// d'immuabilité en base, remplacement, retrait, fil d'activité et journal ;
// tests d'abus (autre rubrique, autre catégorie, autre événement, autre
// organisation, lien de prestataire).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventDecisions } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventLinkRights } from "@symbola/contracts";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  answerLinkDecision,
  createEventLink,
  createProspect,
  createProspectSource,
  DecisionInvalidError,
  LinkAccessDeniedError,
  listEventActivity,
  listEventDecisions,
  listLinkDecisions,
  requestDecision,
  updateProgramItem,
  updateVendorCandidate,
  withdrawDecision,
} from "./service";

const plannerId = randomUUID();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

// Mariage de Léa : traiteur avec deux options montrées, lieu, un programme.
async function wedding() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const venue = await addEventVendorSlot(organizationId, event.id, "Lieu de réception");
  const haddad = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Maison Haddad" });
  const sud = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Saveurs du Sud" });
  await updateVendorCandidate({ organizationId, candidateId: haddad.id, shownToClients: true, quoteAmountCents: 960000 });
  await updateVendorCandidate({ organizationId, candidateId: sud.id, shownToClients: true });
  const item = await addProgramItem(organizationId, event.id, { startTime: "15:30", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
  const link = async (personName: string, rights: EventLinkRights) =>
    (await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName, email: `${randomUUID()}@example.test`, rights } })).link.id;
  return { organizationId, eventId: event.id, catererId: caterer.id, venueId: venue.id, haddadId: haddad.id, sudId: sud.id, itemId: item.id, link };
}

const COUPLE: EventLinkRights = { rubrics: ["tasks", "program", "vendor_options", "budget"], budgetScope: "all", sharedSlotIds: [] };

describe("POR-03 — Décisions et validations horodatées, lisibles des deux côtés", () => {
  it("choisir entre des options : contenu figé à la demande, réponse nominative et horodatée, visible du client et de la planner", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const decision = await requestDecision({ organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId, kind: "option", slotId: w.catererId, note: "Dégustation faite ?", dueOn: "2027-03-01" });
    expect(decision).toMatchObject({ kind: "option", status: "pending", title: "Traiteur", note: "Dégustation faite ?", dueOn: "2027-03-01" });
    expect(decision.snapshot).toEqual({ kind: "option", slotLabel: "Traiteur", options: [
      { candidateId: w.haddadId, vendorName: "Maison Haddad", quoteAmountCents: 960000 },
      { candidateId: w.sudId, vendorName: "Saveurs du Sud", quoteAmountCents: null },
    ] });
    // Contenu figé : un prestataire renommé après la demande ne change pas la décision.
    await updateVendorCandidate({ organizationId: w.organizationId, candidateId: w.haddadId, quoteAmountCents: 990000 });

    const answered = await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: decision.id, answer: "approved", choiceId: w.haddadId, comment: "Le menu du sud-ouest" });
    expect(answered).toMatchObject({ status: "approved", choiceId: w.haddadId, decidedByName: "Léa Martin", decidedByLinkId: lea, comment: "Le menu du sud-ouest" });
    expect(answered.decidedAt).not.toBeNull();
    expect((await listLinkDecisions(w.organizationId, lea))[0]).toMatchObject({ id: decision.id, status: "approved" });
    expect((await listEventDecisions(w.organizationId, w.eventId))[0]!.snapshot).toMatchObject({ options: [{ quoteAmountCents: 960000 }, {}] });
    const activity = await listEventActivity(w.organizationId, w.eventId);
    expect(activity[0]).toMatchObject({ kind: "decision_made", taskLabel: "Traiteur", actorName: "Léa Martin" });
  });

  it("la première réponse décide ; les autres voient qui a décidé et ne peuvent plus répondre", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const maxime = await w.link("Maxime Dubois", COUPLE);
    const decision = await requestDecision({ organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId, kind: "program" });
    await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: decision.id, answer: "approved" });
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: maxime, decisionId: decision.id, answer: "declined", comment: "Trop tôt" })).rejects.toMatchObject({ reason: "answered" });
    expect((await listLinkDecisions(w.organizationId, maxime))[0]).toMatchObject({ status: "approved", decidedByName: "Léa Martin" });
  });

  it("le programme approuvé puis modifié est signalé des deux côtés", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const decision = await requestDecision({ organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId, kind: "program" });
    await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: decision.id, answer: "approved" });
    expect((await listLinkDecisions(w.organizationId, lea))[0]!.programChanged).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await updateProgramItem(w.organizationId, w.itemId, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    expect((await listLinkDecisions(w.organizationId, lea))[0]!.programChanged).toBe(true);
    expect((await listEventDecisions(w.organizationId, w.eventId))[0]!.programChanged).toBe(true);
  });

  it("demandes refusées : moins de deux options montrées, programme vide, dépense sans montant, déjà une demande en attente sur le même sujet", async () => {
    const w = await wedding();
    const base = { organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId };
    await expect(requestDecision({ ...base, kind: "option", slotId: w.venueId })).rejects.toMatchObject({ reason: "options" });
    await expect(requestDecision({ ...base, kind: "expense", slotId: w.catererId, lineId: randomUUID(), slotLabel: "Traiteur", label: "Acompte", vendorName: null, amountCents: 0 })).rejects.toMatchObject({ reason: "expense" });
    await requestDecision({ ...base, kind: "option", slotId: w.catererId });
    await expect(requestDecision({ ...base, kind: "option", slotId: w.catererId })).rejects.toMatchObject({ reason: "pending" });
  });
});

describe("EVT-09 — Une décision validée ne se modifie pas, elle se remplace", () => {
  it("la base refuse de modifier une décision répondue ; seule l'anonymisation d'une demande d'oubli passe", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const decision = await requestDecision({ organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId, kind: "option", slotId: w.catererId });
    await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: decision.id, answer: "approved", choiceId: w.haddadId, comment: "Oui" });
    const update = (values: Partial<typeof eventDecisions.$inferInsert>) =>
      withDb((db) => withOrganization(db, w.organizationId, (tx) => tx.update(eventDecisions).set(values).where(eq(eventDecisions.id, decision.id))));
    // Drizzle enveloppe l'erreur de la base : le message de la garde est dans sa cause.
    const refusal = async (values: Partial<typeof eventDecisions.$inferInsert>) => {
      try {
        await update(values);
        return "";
      } catch (error) {
        return String((error as { cause?: unknown }).cause ?? error);
      }
    };
    expect(await refusal({ choiceId: w.sudId })).toMatch(/ne se modifie plus/);
    expect(await refusal({ status: "declined" })).toMatch(/ne se modifie plus/);
    expect(await refusal({ comment: "Finalement non" })).toMatch(/ne se modifie plus/);
    await update({ decidedByName: "[anonymisé]", comment: "[anonymisé]" });
    expect((await listEventDecisions(w.organizationId, w.eventId))[0]).toMatchObject({ decidedByName: "[anonymisé]", comment: "[anonymisé]", choiceId: w.haddadId, status: "approved" });
  });

  it("remplacer : une nouvelle demande sur le même objet ; l'ancienne reste lisible, « remplacée par » ; une seule fois", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const base = { organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId };
    const first = await requestDecision({ ...base, kind: "option", slotId: w.catererId });
    // Une demande encore en attente ne se remplace pas (elle se retire).
    await expect(requestDecision({ ...base, kind: "option", slotId: w.catererId, replacesDecisionId: first.id })).rejects.toBeInstanceOf(DecisionInvalidError);
    await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: first.id, answer: "declined", comment: "Aucun ne va" });
    const second = await requestDecision({ ...base, kind: "option", slotId: w.catererId, replacesDecisionId: first.id });
    await expect(requestDecision({ ...base, kind: "program", replacesDecisionId: first.id })).rejects.toMatchObject({ reason: "replace" });
    const all = await listEventDecisions(w.organizationId, w.eventId);
    expect(all.find((decision) => decision.id === first.id)).toMatchObject({ status: "declined", replacedById: second.id, comment: "Aucun ne va" });
    expect(all.find((decision) => decision.id === second.id)).toMatchObject({ status: "pending", replacesDecisionId: first.id });
  });

  it("une demande sans réponse se retire ; retirée, le client ne la voit plus ; répondue, elle ne se retire pas", async () => {
    const w = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const base = { organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId };
    const pending = await requestDecision({ ...base, kind: "option", slotId: w.catererId });
    await withdrawDecision(w.organizationId, pending.id);
    expect(await listLinkDecisions(w.organizationId, lea)).toEqual([]);
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: pending.id, answer: "approved", choiceId: w.haddadId })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    const program = await requestDecision({ ...base, kind: "program" });
    await answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: program.id, answer: "approved" });
    await expect(withdrawDecision(w.organizationId, program.id)).rejects.toBeInstanceOf(DecisionInvalidError);
    const journal = await withDb((db) => withOrganization(db, w.organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, w.organizationId))));
    expect(journal.filter((entry) => entry.action.startsWith("events.decision.")).map((entry) => entry.action).sort()).toEqual([
      "events.decision.answered",
      "events.decision.requested",
      "events.decision.requested",
      "events.decision.withdrawn",
    ]);
  });
});

describe("BUD-07, D10 — Abus : hors de ses rubriques, de ses catégories, de son événement, de son organisation", () => {
  it("un payeur ne valide que les dépenses de ses catégories, ne choisit pas les options ; un prestataire ne voit rien", async () => {
    const w = await wedding();
    const bernard = await w.link("Bernard Martin", { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [w.catererId] });
    const base = { organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: plannerId };
    const caterer = await requestDecision({ ...base, kind: "expense", slotId: w.catererId, lineId: randomUUID(), slotLabel: "Traiteur", label: "Acompte", vendorName: "Maison Haddad", amountCents: 288000 });
    const venue = await requestDecision({ ...base, kind: "expense", slotId: w.venueId, lineId: randomUUID(), slotLabel: "Lieu de réception", label: "Solde", vendorName: null, amountCents: 650000 });
    const option = await requestDecision({ ...base, kind: "option", slotId: w.catererId });
    expect((await listLinkDecisions(w.organizationId, bernard)).map((decision) => decision.id)).toEqual([caterer.id]);
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: bernard, decisionId: venue.id, answer: "approved" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: bernard, decisionId: option.id, answer: "approved", choiceId: w.haddadId })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect(await answerLinkDecision({ organizationId: w.organizationId, linkId: bernard, decisionId: caterer.id, answer: "approved" })).toMatchObject({ status: "approved", decidedByName: "Bernard Martin" });

    const vendorLink = (await createEventLink({ organizationId: w.organizationId, eventId: w.eventId, createdByUserId: plannerId, audience: "vendor", vendorCandidateId: w.haddadId, locale: "fr", link: { personName: "Karim", email: "karim@example.test", rights: COUPLE } })).link.id;
    await expect(listLinkDecisions(w.organizationId, vendorLink)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: vendorLink, decisionId: venue.id, answer: "approved" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("une décision d'un autre événement ou d'une autre organisation répond comme inexistante", async () => {
    const w = await wedding();
    const other = await wedding();
    const lea = await w.link("Léa Martin", COUPLE);
    const elsewhere = await requestDecision({ organizationId: other.organizationId, eventId: other.eventId, requestedByUserId: plannerId, kind: "program" });
    await expect(answerLinkDecision({ organizationId: w.organizationId, linkId: lea, decisionId: elsewhere.id, answer: "approved" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(answerLinkDecision({ organizationId: other.organizationId, linkId: lea, decisionId: elsewhere.id, answer: "approved" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect(await listEventDecisions(w.organizationId, other.eventId)).toEqual([]);
  });
});
