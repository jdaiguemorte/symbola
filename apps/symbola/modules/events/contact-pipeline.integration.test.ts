// Lot 44 (CRM-01, CRM-02 ; D1 à D11 ; ADR 0084) — formulaire de contact public et pipeline en
// colonnes, contre un vrai PostgreSQL (RLS) : création du prospect, contact retrouvé sans être modifié,
// champs obligatoires et masqués, message gardé tel quel, demandes « à vérifier », réglages, étapes,
// déplacements, « Gagné » et « Perdu », isolation entre organisations (SEC-36).
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { prospectRequests } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createContact, getContact } from "@/modules/hub/service";
import { eventsPrivacy } from "./privacy";
import {
  acceptProspectRequest,
  addPipelineStage,
  ContactFormInvalidError,
  ContactFormSlugTakenError,
  ContactSubmissionInvalidError,
  createLossReason,
  createProspect,
  createProspectSource,
  discardProspectRequest,
  getEvent,
  getEventProspectRequest,
  getEventsPipeline,
  listEventActivity,
  listNewProspectRequests,
  listPipelineStages,
  listProspectRequestsToReview,
  listProspectSources,
  LossReasonRequiredError,
  losePipelineCard,
  movePipelineCard,
  movePipelineStage,
  PipelineMoveRefusedError,
  PipelineStageInvalidError,
  ProspectRequestNotFoundError,
  purgeStaleProspectRequests,
  removePipelineStage,
  renamePipelineStage,
  resolvePublicContactForm,
  saveContactFormSettings,
  submitContactForm,
  suggestContactFormSlug,
  winPipelineCard,
  type PublicContactFormView,
} from "./service";

const plannerId = randomUUID();
const POLICY = "https://www.atelier-camille.test/confidentialite";
const notify = vi.fn(async () => undefined);

afterEach(() => {
  notify.mockClear();
});

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function openForm(organizationId: string, overrides: Partial<Parameters<typeof saveContactFormSettings>[1]> = {}): Promise<PublicContactFormView> {
  const slug = `atelier-${randomUUID().slice(0, 8)}`;
  await saveContactFormSettings(organizationId, { active: true, slug, hiddenFields: [], privacyPolicyUrl: POLICY, allowedOrigins: [], notifyOwner: true, locale: "fr", ...overrides });
  const form = await resolvePublicContactForm(overrides.slug ?? slug, "fr");
  if (!form) throw new Error("formulaire introuvable");
  return form;
}

const LEA = { firstName: "Léa", lastName: "Martin", email: "Lea.Martin@example.test", phone: "", eventDate: "2027-06-12", period: "", place: "Domaine des Tilleuls, Mâcon", budget: "25 000 €", guests: "120", message: "Bonjour,\nnous cherchons une wedding planner." };

async function requestRows(organizationId: string) {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) => tx.select().from(prospectRequests));
  } finally {
    await sql.end();
  }
}

describe("CRM-01 — Formulaire de contact intégrable : la demande crée un prospect", () => {
  it("un envoi crée l'évènement Option à la première étape, avec date, lieu, budget, invités et source", async () => {
    const organizationId = await organization();
    const instagram = await createProspectSource(organizationId, "Instagram");
    const form = await openForm(organizationId);
    const outcome = await submitContactForm(form, { ...LEA, sourceId: instagram.id }, { notify });
    expect(outcome.kind).toBe("created");
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    const event = await getEvent(organizationId, eventId);
    expect(event).toMatchObject({ status: "option", eventDate: "2027-06-12", venueName: "Domaine des Tilleuls, Mâcon", wantedBudgetCents: 2_500_000, guestsEstimated: 120, prospectSourceId: instagram.id });
    expect(event!.clients.map((client) => [client.firstName, client.lastName, client.email])).toEqual([["Léa", "Martin", "lea.martin@example.test"]]);
    const pipeline = await getEventsPipeline(organizationId, "fr");
    expect(pipeline.cards.find((card) => card.eventId === eventId)?.stageId).toBe(pipeline.stages[0]!.id);
    expect(notify).toHaveBeenCalledWith({ organizationId, eventId, locale: "fr" });
  });

  it("sans source choisie (ou champ masqué), la source « Formulaire de contact » est ajoutée puis reprise", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId, { hiddenFields: ["source"] });
    const first = await submitContactForm(form, { ...LEA, sourceId: randomUUID() }, { notify });
    const second = await submitContactForm(form, { ...LEA, email: "autre@example.test" }, { notify });
    const sources = await listProspectSources(organizationId);
    expect(sources.filter((source) => source.label === "Formulaire de contact")).toHaveLength(1);
    for (const outcome of [first, second]) {
      expect((await getEvent(organizationId, outcome.kind === "created" ? outcome.eventId : ""))?.prospectSourceId).toBe(sources[0]!.id);
    }
  });

  it("D5 — le contact existant est retrouvé par son e-mail (sans majuscules) et sa fiche n'est jamais modifiée", async () => {
    const organizationId = await organization();
    const existing = await createContact(organizationId, { kind: "person", firstName: "Léa", lastName: "Durand", email: "lea.martin@example.test", phone: "06 11 22 33 44" });
    const form = await openForm(organizationId);
    const outcome = await submitContactForm(form, { ...LEA, firstName: "Pirate", lastName: "Usurpateur", phone: "07 00 00 00 00" }, { notify });
    const event = await getEvent(organizationId, outcome.kind === "created" ? outcome.eventId : "");
    expect(event!.clients[0]!.contactId).toBe(existing.id);
    expect(await getContact(organizationId, existing.id)).toMatchObject({ firstName: "Léa", lastName: "Durand", phone: "06 11 22 33 44" });
  });

  it("le nom, et l'e-mail ou le téléphone, sont obligatoires ; une date ou un nombre d'invités invalides sont refusés", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    await expect(submitContactForm(form, { ...LEA, firstName: "" }, { notify })).rejects.toMatchObject({ field: "name" });
    await expect(submitContactForm(form, { ...LEA, email: "", phone: "" }, { notify })).rejects.toMatchObject({ field: "contact" });
    await expect(submitContactForm(form, { ...LEA, email: "pas-une-adresse" }, { notify })).rejects.toBeInstanceOf(ContactSubmissionInvalidError);
    await expect(submitContactForm(form, { ...LEA, eventDate: "2027-02-30" }, { notify })).rejects.toMatchObject({ field: "date" });
    await expect(submitContactForm(form, { ...LEA, guests: "-3" }, { notify })).rejects.toMatchObject({ field: "guests" });
    const phoneOnly = await submitContactForm(form, { ...LEA, email: "", phone: "06 12 34 56 78" }, { notify });
    expect(phoneOnly.kind).toBe("created");
    expect((await getEventsPipeline(organizationId, "fr")).cards).toHaveLength(1);
  });

  it("D3 — un champ masqué est ignoré, même si la requête l'envoie", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId, { hiddenFields: ["budget", "guests", "date", "place"] });
    const outcome = await submitContactForm(form, LEA, { notify });
    const event = await getEvent(organizationId, outcome.kind === "created" ? outcome.eventId : "");
    expect(event).toMatchObject({ eventDate: null, wantedBudgetCents: null, guestsEstimated: null, venueName: null });
  });

  it("le message et la période sont gardés tels quels, balises comprises ; une tranche de budget reste du texte", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    const message = "<script>alert('x')</script> <b>Bonjour</b> & merci";
    const outcome = await submitContactForm(form, { ...LEA, eventDate: "", period: "au printemps 2028", budget: "entre 20 et 30 k€", message }, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    expect(await getEventProspectRequest(organizationId, eventId)).toMatchObject({ message, period: "au printemps 2028", budgetRange: "entre 20 et 30 k€" });
    expect((await getEvent(organizationId, eventId))?.wantedBudgetCents).toBeNull();
  });

  it("l'événement interne events.prospect.received ne porte aucune donnée personnelle (SEC-20)", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    await submitContactForm(form, LEA, { notify });
    const { sql, db } = createAppConnection();
    try {
      const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(domainEvents));
      const received = rows.filter((row) => row.name === "events.prospect.received" && row.organizationId === organizationId);
      expect(received).toHaveLength(1);
      expect(JSON.stringify(received[0]!.payload)).not.toMatch(/lea|martin|example\.test|Bonjour/i);
    } finally {
      await sql.end();
    }
  });

  it("D6 et réglage D7 — sans e-mail à la titulaire si elle l'a coupé ; jamais d'e-mail au prospect", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId, { notifyOwner: false });
    await submitContactForm(form, LEA, { notify });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("CRM-01 — Anti-spam : message à liens mis de côté (D4)", () => {
  it("trois liens : demande « à vérifier », rien n'est créé ; acceptée, elle devient un prospect ; effacée, elle disparaît", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    const spam = "Voyez https://a.example http://b.example et www.c.example";
    const outcome = await submitContactForm(form, { ...LEA, message: spam }, { notify });
    expect(outcome.kind).toBe("to_review");
    expect(notify).not.toHaveBeenCalled();
    expect((await getEventsPipeline(organizationId, "fr")).cards).toHaveLength(0);
    const [review] = await listProspectRequestsToReview(organizationId);
    expect(review).toMatchObject({ name: "Léa Martin", email: "lea.martin@example.test", message: spam });
    const eventId = await acceptProspectRequest(organizationId, review!.id);
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
    expect(await getEventProspectRequest(organizationId, eventId)).toMatchObject({ message: spam });
    expect(await listProspectRequestsToReview(organizationId)).toEqual([]);
    await expect(acceptProspectRequest(organizationId, review!.id)).rejects.toBeInstanceOf(ProspectRequestNotFoundError);

    const second = await submitContactForm(form, { ...LEA, email: "x@example.test", message: spam }, { notify });
    await discardProspectRequest(organizationId, second.kind === "to_review" ? second.requestId : "");
    expect(await listProspectRequestsToReview(organizationId)).toEqual([]);
  });

  it("une demande « à vérifier » non traitée est effacée après 30 jours, pas avant (horloge simulée)", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    const receivedAt = new Date("2027-01-01T10:00:00Z");
    await submitContactForm(form, { ...LEA, message: "https://a.test https://b.test https://c.test" }, { notify, now: receivedAt });
    expect(await purgeStaleProspectRequests(organizationId, new Date("2027-01-31T09:59:59Z"))).toBe(0);
    expect(await purgeStaleProspectRequests(organizationId, new Date("2027-01-31T10:00:01Z"))).toBe(1);
    expect(await requestRows(organizationId)).toEqual([]);
  });
});

describe("CRM-01 — Réglages du formulaire et mention d'information (RGP-03, D1, D2)", () => {
  it("le formulaire ne s'ouvre pas sans l'adresse de la politique de confidentialité ; fermé, il répond « introuvable »", async () => {
    const organizationId = await organization();
    const slug = `atelier-${randomUUID().slice(0, 8)}`;
    await expect(saveContactFormSettings(organizationId, { active: true, slug, hiddenFields: [], privacyPolicyUrl: null, allowedOrigins: [], notifyOwner: true, locale: "fr" })).rejects.toMatchObject({ field: "privacyPolicyUrl" });
    await expect(saveContactFormSettings(organizationId, { active: true, slug, hiddenFields: [], privacyPolicyUrl: "http://non-chiffre.test", allowedOrigins: [], notifyOwner: true, locale: "fr" })).rejects.toBeInstanceOf(ContactFormInvalidError);
    await saveContactFormSettings(organizationId, { active: false, slug, hiddenFields: [], privacyPolicyUrl: null, allowedOrigins: [], notifyOwner: true, locale: "fr" });
    expect(await resolvePublicContactForm(slug, "fr")).toBeNull();
  });

  it("la mention nomme l'organisation, la durée des prospects, le contact et la politique de la planner", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    expect(form.notice).toContain(form.organizationName);
    expect(form.notice).toMatch(/\d+ mois/);
    expect(form.notice).toContain(POLICY);
    expect(form.notice).not.toMatch(/\{[a-z]+\}/);
  });

  it("D2 — adresse proposée depuis le nom, unique ; l'ancienne adresse cesse de répondre", async () => {
    const organizationId = await organization();
    const other = await organization();
    const form = await openForm(organizationId);
    expect(await suggestContactFormSlug("Atelier Camille R.")).toMatch(/^atelier-camille-r(-\d+)?$/);
    await expect(saveContactFormSettings(other, { active: true, slug: form.slug, hiddenFields: [], privacyPolicyUrl: POLICY, allowedOrigins: [], notifyOwner: true, locale: "fr" })).rejects.toBeInstanceOf(ContactFormSlugTakenError);
    const renamed = `${form.slug}-bis`;
    await saveContactFormSettings(organizationId, { active: true, slug: renamed, hiddenFields: [], privacyPolicyUrl: POLICY, allowedOrigins: [], notifyOwner: true, locale: "fr" });
    expect(await resolvePublicContactForm(form.slug, "fr")).toBeNull();
    expect(await resolvePublicContactForm(renamed, "fr")).not.toBeNull();
  });

  it("D1 — sites autorisés : https seulement, cinq au plus, réduits à leur origine", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId, { allowedOrigins: ["https://www.atelier-camille.test/contact", "atelier-camille.test", " "] });
    expect(form.allowedOrigins).toEqual(["https://www.atelier-camille.test", "https://atelier-camille.test"]);
    const base = { active: true, slug: form.slug, hiddenFields: [], privacyPolicyUrl: POLICY, notifyOwner: true, locale: "fr" as const };
    await expect(saveContactFormSettings(organizationId, { ...base, allowedOrigins: ["http://atelier-camille.test"] })).rejects.toMatchObject({ field: "allowedOrigins" });
    await expect(saveContactFormSettings(organizationId, { ...base, allowedOrigins: ["https://*.atelier.test"] })).rejects.toMatchObject({ field: "allowedOrigins" });
    await expect(saveContactFormSettings(organizationId, { ...base, allowedOrigins: ["https://a.test", "https://b.test", "https://c.test", "https://d.test", "https://e.test", "https://f.test"] })).rejects.toMatchObject({ field: "allowedOrigins" });
  });
});

describe("CRM-02 — Pipeline en colonnes aux étapes paramétrables", () => {
  it("D9 — quatre étapes de départ à la première ouverture ; ajout, renommage, ordre ; une à dix étapes", async () => {
    const organizationId = await organization();
    expect((await listPipelineStages(organizationId, "fr")).map((stage) => stage.label)).toEqual(["Nouvelle demande", "Premier échange", "Rendez-vous", "Devis envoyé"]);
    const added = await addPipelineStage(organizationId, "  Visite du lieu ", "fr");
    expect(added.label).toBe("Visite du lieu");
    await renamePipelineStage(organizationId, added.id, "Visite");
    await movePipelineStage(organizationId, added.id, "up", "fr");
    expect((await listPipelineStages(organizationId, "fr")).map((stage) => stage.label)).toEqual(["Nouvelle demande", "Premier échange", "Rendez-vous", "Visite", "Devis envoyé"]);
    await expect(addPipelineStage(organizationId, "", "fr")).rejects.toBeInstanceOf(PipelineStageInvalidError);
    for (let index = 0; index < 5; index += 1) await addPipelineStage(organizationId, `Étape ${index}`, "fr");
    await expect(addPipelineStage(organizationId, "Onzième", "fr")).rejects.toMatchObject({ reason: "too_many" });
  });

  it("retirer une étape non vide est refusé sans destination ; avec destination, ses cartes y passent", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    const outcome = await submitContactForm(form, LEA, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    const [first, second] = await listPipelineStages(organizationId, "fr");
    await expect(removePipelineStage({ organizationId, stageId: first!.id, destinationId: null, userId: plannerId, locale: "fr" })).rejects.toMatchObject({ reason: "not_empty" });
    expect(await removePipelineStage({ organizationId, stageId: first!.id, destinationId: second!.id, userId: plannerId, locale: "fr" })).toEqual({ moved: 1 });
    const pipeline = await getEventsPipeline(organizationId, "fr");
    expect(pipeline.stages.map((stage) => stage.label)).toEqual(["Premier échange", "Rendez-vous", "Devis envoyé"]);
    expect(pipeline.cards[0]).toMatchObject({ eventId, stageId: second!.id });
    for (const stage of pipeline.stages.slice(1)) await removePipelineStage({ organizationId, stageId: stage.id, destinationId: null, userId: plannerId, locale: "fr" });
    await expect(removePipelineStage({ organizationId, stageId: second!.id, destinationId: null, userId: plannerId, locale: "fr" })).rejects.toMatchObject({ reason: "too_few" });
  });

  it("un déplacement change l'étape et entre dans l'historique de l'évènement (« Passé à l'étape Rendez-vous »)", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: "Petit" }], eventDate: "2027-09-04" });
    const stages = await listPipelineStages(organizationId, "fr");
    expect(await movePipelineCard({ organizationId, eventId, stageId: stages[2]!.id, userId: plannerId, locale: "fr" })).toBe("moved");
    expect(await movePipelineCard({ organizationId, eventId, stageId: stages[2]!.id, userId: plannerId, locale: "fr" })).toBe("unchanged");
    const activity = await listEventActivity(organizationId, eventId);
    expect(activity[0]).toMatchObject({ kind: "stage_changed", taskLabel: "Rendez-vous" });
    const pipeline = await getEventsPipeline(organizationId, "fr");
    expect(pipeline.cards[0]).toMatchObject({ names: "Inès", stageId: stages[2]!.id, sourceLabel: "Salon" });
    expect(pipeline.stages[2]!.cardCount).toBe(1);
  });

  it("D11 — dans une colonne, la plus ancienne activité en haut ; la date déjà prise est signalée (CRM-04)", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const older = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Ancienne" }], eventDate: "2027-06-12" });
    const newer = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Récente" }], eventDate: "2027-06-12" });
    const cards = (await getEventsPipeline(organizationId, "fr")).cards;
    expect(cards.map((card) => card.eventId)).toEqual([older.id, newer.id]);
    expect(cards.every((card) => card.dateTaken)).toBe(true);
  });

  it("D9 — « Gagné » confirme l'évènement, qui quitte le pipeline ; « Perdu » exige le motif (et la note pour « Autre »)", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const won = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Gagné" }] });
    const lost = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Perdu" }] });
    await winPipelineCard({ organizationId, eventId: won.id, userId: plannerId });
    expect((await getEvent(organizationId, won.id))?.status).toBe("confirmed");
    await expect(winPipelineCard({ organizationId, eventId: won.id, userId: plannerId })).rejects.toThrow();
    const budget = await createLossReason(organizationId, "Budget", false);
    const other = await createLossReason(organizationId, "Autre", true);
    await expect(losePipelineCard({ organizationId, eventId: lost.id, userId: plannerId, lossReasonId: null, lossReasonNote: null })).rejects.toMatchObject({ field: "reason" });
    await expect(losePipelineCard({ organizationId, eventId: lost.id, userId: plannerId, lossReasonId: other.id, lossReasonNote: " " })).rejects.toBeInstanceOf(LossReasonRequiredError);
    await losePipelineCard({ organizationId, eventId: lost.id, userId: plannerId, lossReasonId: budget.id, lossReasonNote: "Trop cher" });
    expect(await getEvent(organizationId, lost.id)).toMatchObject({ status: "cancelled", lossReasonId: budget.id, lossReasonNote: "Trop cher" });
    expect((await getEventsPipeline(organizationId, "fr")).cards).toEqual([]);
  });

  it("« Aujourd'hui » : la nouvelle demande, avec l'alerte de date prise, tant qu'elle est à la première étape", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const confirmed = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Déjà" }], eventDate: "2027-06-12" });
    await winPipelineCard({ organizationId, eventId: confirmed.id, userId: plannerId });
    const form = await openForm(organizationId);
    const outcome = await submitContactForm(form, LEA, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    expect(await listNewProspectRequests(organizationId, "fr")).toEqual([expect.objectContaining({ eventId, names: "Léa", eventDate: "2027-06-12", dateTaken: true })]);
    const stages = await listPipelineStages(organizationId, "fr");
    await movePipelineCard({ organizationId, eventId, stageId: stages[1]!.id, userId: plannerId, locale: "fr" });
    expect(await listNewProspectRequests(organizationId, "fr")).toEqual([]);
  });
});

describe("SEC-36 — Abus et isolation du formulaire et du pipeline", () => {
  it("l'adresse d'une organisation ne crée rien dans une autre ; une liste d'une autre organisation est ignorée", async () => {
    const a = await organization();
    const b = await organization();
    const sourceOfB = await createProspectSource(b, "Source de B");
    const form = await openForm(a);
    const outcome = await submitContactForm(form, { ...LEA, sourceId: sourceOfB.id }, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    expect(await getEvent(b, eventId)).toBeNull();
    expect((await getEventsPipeline(b, "fr")).cards).toEqual([]);
    expect((await getEvent(a, eventId))?.prospectSourceId).not.toBe(sourceOfB.id);
  });

  it("une organisation ne lit ni ne déplace les cartes, les étapes ou les demandes d'une autre", async () => {
    const a = await organization();
    const b = await organization();
    const form = await openForm(a);
    const outcome = await submitContactForm(form, LEA, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    const stagesOfA = await listPipelineStages(a, "fr");
    const stagesOfB = await listPipelineStages(b, "fr");
    await expect(movePipelineCard({ organizationId: b, eventId, stageId: stagesOfB[1]!.id, userId: plannerId, locale: "fr" })).rejects.toMatchObject({ reason: "not_found" });
    await expect(movePipelineCard({ organizationId: a, eventId, stageId: stagesOfB[1]!.id, userId: plannerId, locale: "fr" })).rejects.toBeInstanceOf(PipelineMoveRefusedError);
    await expect(renamePipelineStage(b, stagesOfA[0]!.id, "Piratée")).rejects.toMatchObject({ reason: "not_found" });
    await expect(removePipelineStage({ organizationId: b, stageId: stagesOfA[1]!.id, destinationId: null, userId: plannerId, locale: "fr" })).rejects.toMatchObject({ reason: "not_found" });
    expect(await getEventProspectRequest(b, eventId)).toBeNull();
    expect(await requestRows(b)).toEqual([]);
    await expect(winPipelineCard({ organizationId: b, eventId, userId: plannerId })).rejects.toThrow();
    const spam = await submitContactForm(form, { ...LEA, message: "https://a.test https://b.test https://c.test" }, { notify });
    const requestId = spam.kind === "to_review" ? spam.requestId : "";
    expect(await listProspectRequestsToReview(b)).toEqual([]);
    await expect(acceptProspectRequest(b, requestId)).rejects.toBeInstanceOf(ProspectRequestNotFoundError);
    await expect(discardProspectRequest(b, requestId)).rejects.toBeInstanceOf(ProspectRequestNotFoundError);
    expect((await getEventsPipeline(a, "fr")).stages.map((stage) => stage.label)[0]).toBe("Nouvelle demande");
  });

  it("une adresse désactivée, ancienne ou inconnue répond « introuvable », comme une adresse mal formée", async () => {
    const organizationId = await organization();
    const form = await openForm(organizationId);
    await saveContactFormSettings(organizationId, { active: false, slug: form.slug, hiddenFields: [], privacyPolicyUrl: POLICY, allowedOrigins: [], notifyOwner: true, locale: "fr" });
    expect(await resolvePublicContactForm(form.slug, "fr")).toBeNull();
    expect(await resolvePublicContactForm(`inconnue-${randomUUID().slice(0, 8)}`, "fr")).toBeNull();
    expect(await resolvePublicContactForm("../../etc", "fr")).toBeNull();
    // Un formulaire fermé après l'affichage de la page n'enregistre rien.
    expect(await submitContactForm(form, LEA, { notify })).toEqual({ kind: "ignored" });
    expect((await getEventsPipeline(organizationId, "fr")).cards).toEqual([]);
  });
});

describe("RGP-05 — La demande du formulaire au contrat privacy/v1 du module events", () => {
  it("trouvée par le message ou les champs en attente, exportée avec l'évènement, effacée à l'oubli ; jamais celle d'une autre organisation", async () => {
    const organizationId = await organization();
    const other = await organization();
    const form = await openForm(organizationId);
    const outcome = await submitContactForm(form, { ...LEA, message: "Mariage de Léa Martin et Hugo Bernard" }, { notify });
    const eventId = outcome.kind === "created" ? outcome.eventId : "";
    const pending = await submitContactForm(form, { ...LEA, firstName: "Zoé", lastName: "Bernard", email: "zoe@example.test", message: "https://a.test https://b.test https://c.test" }, { notify });
    const found = await eventsPrivacy.find({ organizationId, terms: { name: "Bernard" } });
    const requests = found.filter((record) => record.kind === "prospect_request");
    expect(requests.map((record) => record.eventId).sort()).toEqual([eventId, null].sort());
    expect(await eventsPrivacy.find({ organizationId: other, terms: { name: "Bernard" } })).toEqual([]);
    const related = await eventsPrivacy.related({ organizationId, eventIds: [eventId] });
    expect(related.find((record) => record.kind === "prospect_request")?.fields.message).toContain("Hugo Bernard");
    const erasure = { organizationId, records: requests.map((record) => ({ kind: record.kind, recordId: record.recordId })), rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2026-11-18" };
    const plan = await eventsPrivacy.planErasure(erasure);
    expect(plan.map((item) => item.fate)).toEqual(["deleted", "deleted"]);
    await eventsPrivacy.erase(erasure);
    expect(await getEventProspectRequest(organizationId, eventId)).toBeNull();
    expect(await listProspectRequestsToReview(organizationId)).toEqual([]);
    expect(pending.kind).toBe("to_review");
  });
});
