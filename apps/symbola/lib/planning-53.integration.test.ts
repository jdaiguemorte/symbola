// Lot 53 (CHR-10, CHR-05, HUB-24, GC-02 ; D6 à D8 ; ADR 0095) — contre un vrai PostgreSQL (RLS) et Mailpit,
// avec une horloge simulée : tâches hors évènement et récurrentes dans « Aujourd'hui » ; jalons et santé du
// planning qui s'explique ; terme des clients d'un type sur l'écran (tableau), dans un e-mail et dans un
// devis (figé à l'envoi) ; radar des risques expliqué, seuils réglés, module fermé sans alerte ni erreur,
// passage du matin une fois par jour. Isolation entre organisations (SEC-36).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser, removeMember } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import {
  addEventTask,
  addStandaloneTask,
  clientTermForEvent,
  createEventLink,
  createProspect,
  createProspectSource,
  deleteStandaloneTask,
  getPlanningHealth,
  listOrganizationTasks,
  listStandaloneTasks,
  PlanningInputError,
  setEventTypeClientTerm,
  setPlanningHealthThresholds,
  setStandaloneTaskDone,
  setEventTeamMember,
  setTaskMilestone,
  spawnDueRecurringTasks,
  updateStandaloneTask,
  addVendorCandidate,
  addEventVendorSlot,
  updateVendorCandidate,
} from "@/modules/events/service";
import { addVendorDocument, createVendor, listVendorDocumentKinds, setVendorBankDetails } from "@/modules/vendors/service";
import { listAutomationRuns, listNotifications, notificationRecipients, notify, saveEmailTemplate, saveOnboardingStep, setModuleEnabled, setRiskRule } from "@/modules/hub/service";
import { addQuoteLine, createQuote, getDocumentSettings, getQuote, sendQuote, updateDocumentSettings } from "@/modules/quotes/service";
import { ensureEventTypes } from "@/lib/events/event-types";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { loadTodayItems } from "@/lib/today/load";
import { runMorningPass } from "./notification-jobs";
import { loadRiskRadar } from "./risk-radar/load";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function workspace(eventDate = "2027-06-12") {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  const owner = await createUser(db, { organizationId, email: `proprietaire-${randomUUID()}@example.test`, role: "owner" });
  const types = await ensureEventTypes(organizationId, "fr");
  const seminar = types.find((type) => type.audience === "clients") ?? types[0]!;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate, eventTypeId: seminar.id });
  return { organizationId, ownerId: owner.id, eventId: event.id, eventTypeId: seminar.id };
}

const words = { clientTask: "client", amount: () => "", decision: () => "", paymentDeclaration: () => "", quoteFollowUp: () => "", prospectFollowUp: "", depositBlocked: () => "", vendorContract: () => "", dateConflict: () => "", linkRenewal: () => "", standaloneTask: "Hors évènement" };

describe("CHR-10 — Tâches hors évènement et tâches récurrentes (lot 53, D6)", () => {
  it("une tâche hors évènement apparaît dans « Aujourd'hui », se coche, et sa répétition mensuelle fait naître la suivante une seule fois", async () => {
    const { organizationId } = await workspace();
    const today = "2027-01-20";
    const task = await addStandaloneTask(organizationId, { label: "Déclaration de TVA", dueDate: today, recurrence: "monthly" });
    const { items } = await loadTodayItems(organizationId, { events: true, quotes: false, budget: false }, words, "fr", new Date(`${today}T09:00:00Z`));
    expect(items.find((item) => item.key === `standalone-task:${task.id}`)).toMatchObject({ title: "Déclaration de TVA", eventId: null, detail: "Hors évènement", action: { kind: "check_standalone_task", taskId: task.id } });
    // Une tâche hors évènement n'est pas une tâche d'évènement.
    expect((await listOrganizationTasks({ organizationId, today, horizonDays: null })).map((row) => row.id)).not.toContain(task.id);
    await setStandaloneTaskDone(organizationId, task.id, true, new Date(`${today}T10:00:00Z`), today);
    await setStandaloneTaskDone(organizationId, task.id, true, new Date(`${today}T11:00:00Z`), today);
    expect((await listStandaloneTasks(organizationId)).map((row) => [row.label, row.dueDate, row.recurrence])).toEqual([["Déclaration de TVA", "2027-02-20", "monthly"]]);
  });

  it("à sa date, une tâche récurrente non faite fait naître la suivante (passage du matin), une seule fois", async () => {
    const { organizationId } = await workspace();
    await addStandaloneTask(organizationId, { label: "Renouveler l'assurance", dueDate: "2027-03-31", recurrence: "yearly" });
    expect(await spawnDueRecurringTasks(organizationId, "2027-03-30")).toBe(0);
    expect(await spawnDueRecurringTasks(organizationId, "2027-03-31")).toBe(1);
    expect(await spawnDueRecurringTasks(organizationId, "2027-04-01")).toBe(0);
    expect((await listStandaloneTasks(organizationId)).map((row) => row.dueDate)).toEqual(["2027-03-31", "2028-03-31"]);
  });

  it("abus : une autre organisation ne coche ni ne supprime la tâche ; une saisie invalide est refusée", async () => {
    const a = await workspace();
    const b = await workspace();
    const task = await addStandaloneTask(a.organizationId, { label: "Relancer la comptable", dueDate: "2027-01-10", recurrence: null });
    await expect(setStandaloneTaskDone(b.organizationId, task.id, true)).rejects.toBeInstanceOf(PlanningInputError);
    await expect(deleteStandaloneTask(b.organizationId, task.id)).rejects.toBeInstanceOf(PlanningInputError);
    expect(await listStandaloneTasks(b.organizationId)).toEqual([]);
    await expect(addStandaloneTask(a.organizationId, { label: "", dueDate: "2027-13-40", recurrence: "daily" })).rejects.toBeInstanceOf(PlanningInputError);
    await deleteStandaloneTask(a.organizationId, task.id);
    expect(await listStandaloneTasks(a.organizationId)).toEqual([]);
  });
});

describe("CHR-10 — Modifier une tâche hors évènement (lot 67b ; recette du 24/11/2026, R02)", () => {
  it("l'intitulé, l'échéance et la répétition se modifient ; la tâche garde son identité", async () => {
    const { organizationId } = await workspace();
    const task = await addStandaloneTask(organizationId, { label: "Déclaration de TVA", dueDate: "2027-01-20", recurrence: null });
    const updated = await updateStandaloneTask(organizationId, task.id, { label: "Déclaration de TVA du trimestre", dueDate: "2027-01-24", recurrence: "quarterly" });
    expect(updated).toMatchObject({ id: task.id, label: "Déclaration de TVA du trimestre", dueDate: "2027-01-24", recurrence: "quarterly", done: false });
    expect(await listStandaloneTasks(organizationId)).toEqual([updated]);
  });

  it("changer la répétition ne touche pas une occurrence déjà faite ni la suivante déjà née", async () => {
    const { organizationId } = await workspace();
    const task = await addStandaloneTask(organizationId, { label: "Point comptable", dueDate: "2027-01-10", recurrence: "monthly" });
    await setStandaloneTaskDone(organizationId, task.id, true, new Date("2027-01-10T09:00:00Z"), "2027-01-10");
    const [next] = await listStandaloneTasks(organizationId);
    await updateStandaloneTask(organizationId, next!.id, { label: "Point comptable", dueDate: next!.dueDate, recurrence: null });
    const all = await listStandaloneTasks(organizationId, { includeDone: true });
    expect(all.map((entry) => [entry.dueDate, entry.recurrence, entry.done])).toEqual([
      ["2027-01-10", "monthly", true],
      ["2027-02-10", null, false],
    ]);
  });

  it("abus : une autre organisation ne modifie pas la tâche ; une tâche d'évènement ou supprimée non plus ; une saisie invalide est refusée", async () => {
    const a = await workspace();
    const b = await workspace();
    const task = await addStandaloneTask(a.organizationId, { label: "Assurance", dueDate: "2027-03-01", recurrence: "yearly" });
    const change = { label: "Détournée", dueDate: "2027-03-02", recurrence: null };
    await expect(updateStandaloneTask(b.organizationId, task.id, change)).rejects.toBeInstanceOf(PlanningInputError);
    await expect(updateStandaloneTask(a.organizationId, task.id, { label: "", dueDate: "2027-13-40", recurrence: "daily" })).rejects.toBeInstanceOf(PlanningInputError);
    await expect(updateStandaloneTask(a.organizationId, "pas-un-identifiant", change)).rejects.toBeInstanceOf(PlanningInputError);
    expect(await listStandaloneTasks(a.organizationId)).toEqual([task]);
    await deleteStandaloneTask(a.organizationId, task.id);
    await expect(updateStandaloneTask(a.organizationId, task.id, change)).rejects.toBeInstanceOf(PlanningInputError);
  });
});

describe("CHR-05 — Jalons, alertes de retard et indicateur de santé du planning (lot 53)", () => {
  it("l'indicateur s'explique (jalons d'abord) ; un jalon en retard pèse plus ; les seuils se règlent ; une autre organisation n'y touche pas", async () => {
    const { organizationId, eventId } = await workspace();
    const late = await addEventTask(organizationId, eventId, { label: "Envoyer les faire-part", dueDate: "2027-01-05", responsible: "planner" });
    const milestone = await addEventTask(organizationId, eventId, { label: "Contrat traiteur signé", dueDate: "2027-01-08", responsible: "planner" });
    expect((await getPlanningHealth(organizationId, eventId, "2027-01-10")).state).toBe("watch");
    await setTaskMilestone(organizationId, eventId, milestone.id, true);
    const health = await getPlanningHealth(organizationId, eventId, "2027-01-10");
    expect(health).toMatchObject({ state: "late", points: 4 });
    expect(health.contributors.map((contributor) => [contributor.taskId, contributor.isMilestone, contributor.daysLate])).toEqual([
      [milestone.id, true, 2],
      [late.id, false, 5],
    ]);
    await setPlanningHealthThresholds(organizationId, { watchPoints: 2, latePoints: 10, milestoneWeight: 3 });
    expect((await getPlanningHealth(organizationId, eventId, "2027-01-10")).state).toBe("watch");
    await expect(setPlanningHealthThresholds(organizationId, { watchPoints: 5, latePoints: 2, milestoneWeight: 3 })).rejects.toBeInstanceOf(PlanningInputError);
    const other = await workspace();
    await expect(setTaskMilestone(other.organizationId, eventId, late.id, true)).rejects.toBeInstanceOf(PlanningInputError);
  });
});

describe("HUB-24 — Vocabulaire réglable par type d'évènement (lot 53, D8)", () => {
  it("un terme libre s'applique à l'écran (le service), dans un e-mail ({{terme_clients}}) et dans un devis ; un devis déjà émis ne change pas", async () => {
    const { organizationId, ownerId, eventId, eventTypeId } = await workspace();
    expect(await clientTermForEvent(organizationId, eventId, "fr")).toMatchObject({ custom: false });
    await setEventTypeClientTerm(organizationId, { eventTypeId, locale: "fr", term: { term: "le commanditaire", gender: "masculine", number: "singular" } });
    expect(await clientTermForEvent(organizationId, eventId, "fr")).toEqual({ term: "le commanditaire", gender: "masculine", number: "singular", custom: true });
    // E-mail : le modèle de l'organisation emploie {{terme_clients}}.
    await saveEmailTemplate({ organizationId, kind: "client_link", locale: "fr", subject: "Votre espace", body: "Bonjour {{prénom}},\n\nVoici l'espace de {{terme_clients}} :\n\n{{lien}}" });
    const email = `lea-${randomUUID()}@example.test`;
    await createEventLink({ organizationId, eventId, createdByUserId: ownerId, audience: "client", locale: "fr", link: { personName: "Léa Martin", email, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } } });
    const listed = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages: { ID: string }[] };
    const message = (await (await fetch(`${MAILPIT_API}/message/${listed.messages[0]!.ID}`)).json()) as { Text: string };
    expect(message.Text).toContain("Voici l'espace de le commanditaire");
    // Devis : le terme se fige avec la version envoyée.
    await fillRequiredMentions(organizationId);
    await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), iban: "FR7630006000011234567890189", bic: "AGRIFRPP" });
    const quote = await createQuote({ organizationId, eventId, createdByUserId: ownerId });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000, vatRateBasisPoints: 2000 });
    await sendQuote({ organizationId, quoteId: quote.id });
    await setEventTypeClientTerm(organizationId, { eventTypeId, locale: "fr", term: { term: "les invitants", gender: "masculine", number: "plural" } });
    expect((await getQuote(organizationId, quote.id)).current.seller?.clientTerm).toEqual({ fr: "le commanditaire", en: null });
    // Abus : une autre organisation ne règle pas le terme de ce type.
    const other = await workspace();
    await expect(setEventTypeClientTerm(other.organizationId, { eventTypeId, locale: "fr", term: { term: "intrus", gender: "masculine", number: "singular" } })).rejects.toBeInstanceOf(PlanningInputError);
    await expect(setEventTypeClientTerm(organizationId, { eventTypeId, locale: "fr", term: { term: "x".repeat(41), gender: "masculine", number: "singular" } })).rejects.toBeInstanceOf(PlanningInputError);
  });
});

describe("GC-02 — Radar des risques quotidien (lot 53, D7)", () => {
  it("un jalon en retard est détecté avec sa règle expliquée ; le seuil réglé change le résultat ; toutes les règles sont disponibles", async () => {
    const { organizationId, eventId } = await workspace("2027-02-20");
    const milestone = await addEventTask(organizationId, eventId, { label: "Liste d'invités close", dueDate: "2027-01-05", responsible: "planner" });
    await setTaskMilestone(organizationId, eventId, milestone.id, true);
    const now = new Date("2027-01-10T08:00:00Z");
    const radar = await loadRiskRadar(organizationId, now);
    expect(radar.alerts).toEqual([expect.objectContaining({ rule: "milestone_late", key: `milestone_late:${milestone.id}`, eventNames: expect.stringContaining("Léa"), facts: { task: "Liste d'invités close", daysLate: 5 }, href: `/events/${eventId}?onglet=retroplanning&tache=${milestone.id}` })]);
    expect(radar.rules.every((rule) => rule.available)).toBe(true);
    await setRiskRule(organizationId, { rule: "milestone_late", enabled: true, thresholdDays: 7 });
    expect((await loadRiskRadar(organizationId, now)).alerts).toEqual([]);
  });

  it("un module fermé ne produit aucune alerte, et aucune erreur", async () => {
    const { organizationId, eventId } = await workspace("2027-02-20");
    const milestone = await addEventTask(organizationId, eventId, { label: "Liste d'invités close", dueDate: "2027-01-05", responsible: "planner" });
    await setTaskMilestone(organizationId, eventId, milestone.id, true);
    await setModuleEnabled(appDatabase(), { adminUserId: randomUUID(), organizationId, moduleKey: "events", enabled: false });
    const radar = await loadRiskRadar(organizationId, new Date("2027-01-10T08:00:00Z"));
    expect(radar.alerts).toEqual([]);
    expect(radar.rules.every((rule) => rule.module !== "events" || !rule.available)).toBe(true);
  });

  it("le passage du matin (après 6 h à Paris) prévient une fois : tâches en retard, jalon, alerte du radar ; le journal le garde", async () => {
    const { organizationId, ownerId, eventId } = await workspace("2027-02-20");
    const milestone = await addEventTask(organizationId, eventId, { label: "Contrat traiteur signé", dueDate: "2027-01-05", responsible: "planner" });
    await addEventTask(organizationId, eventId, { label: "Envoyer les faire-part", dueDate: "2027-01-06", responsible: "planner" });
    await setTaskMilestone(organizationId, eventId, milestone.id, true);
    expect(await runMorningPass(organizationId, new Date("2027-01-10T04:30:00Z"))).toBe(false);
    expect(await runMorningPass(organizationId, new Date("2027-01-10T05:30:00Z"))).toBe(true);
    expect(await runMorningPass(organizationId, new Date("2027-01-10T09:00:00Z"))).toBe(false);
    const types = (await listNotifications(organizationId, ownerId)).map((notification) => notification.type).sort();
    expect(types).toEqual(["milestone_late", "risk_alert", "task_overdue"]);
    expect(await listAutomationRuns(organizationId, "risk_radar")).toEqual([expect.objectContaining({ result: "done", objectLabel: "1" })]);
    // Le lendemain : rien de neuf pour les mêmes objets.
    expect(await runMorningPass(organizationId, new Date("2027-01-11T06:00:00Z"))).toBe(true);
    expect(await listNotifications(organizationId, ownerId)).toHaveLength(3);
  });
});

describe("HUB-15 — Destinataire : le planner principal de l'évènement, sinon la Propriétaire (lot 53, D3)", () => {
  it("le planner principal reçoit les notifications de son évènement ; retiré de l'équipe, la Propriétaire les reprend ; le Comptable ne reçoit rien", async () => {
    const { organizationId, ownerId, eventId } = await workspace();
    const db = appDatabase();
    const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, role: "member" });
    const accountant = await createUser(db, { organizationId, email: `comptable-${randomUUID()}@example.test`, role: "accountant" });
    await setEventTeamMember({ organizationId, eventId, userId: planner.id, role: "lead", byUserId: ownerId });
    expect(await notificationRecipients(organizationId, eventId)).toEqual([planner.id]);
    expect(await notificationRecipients(organizationId, null)).toEqual([ownerId]);
    await notify({ organizationId, type: "client_decision", eventId, objectKey: "d1", params: { title: "Choix du traiteur" }, href: `/events/${eventId}?onglet=maries` });
    await notify({ organizationId, type: "prospect_request", eventId: null, objectKey: "r1", href: "/events/pipeline" });
    expect((await listNotifications(organizationId, planner.id)).map((notification) => notification.type)).toEqual(["client_decision"]);
    expect((await listNotifications(organizationId, ownerId)).map((notification) => notification.type)).toEqual(["prospect_request"]);
    expect(await listNotifications(organizationId, accountant.id)).toEqual([]);
    // Le planner principal retiré de l'organisation : la Propriétaire reprend ses alertes.
    expect(await removeMember(db, { organizationId, userId: planner.id, removedByUserId: ownerId })).toBe("removed");
    expect(await notificationRecipients(organizationId, eventId)).toEqual([ownerId]);
  });
});

describe("GC-02 — Radar : pièces des prestataires retenus et IBAN « à vérifier » (lots 48a et 53)", () => {
  it("une pièce d'un prestataire retenu qui expire avant l'évènement et son IBAN changé par lien sont détectés, avec leur règle ; rien sans le module Prestataires", async () => {
    const { organizationId, ownerId, eventId } = await workspace("2027-07-15");
    const now = new Date("2027-04-01T08:00:00Z");
    const kinds = await listVendorDocumentKinds(organizationId, "fr");
    const { vendor } = await createVendor(organizationId, { name: "Traiteur Saveurs", typeId: null });
    await addVendorDocument({ organizationId, vendorId: vendor.id, kindId: kinds[0]!.id, fileName: "assurance.pdf", content: new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1")), validUntil: "2027-06-30", userId: ownerId, now });
    await setVendorBankDetails(organizationId, vendor.id, { iban: "DE89370400440532013000", bic: null }, { kind: "link", linkId: randomUUID() });
    const slot = await addEventVendorSlot(organizationId, eventId, "Traiteur");
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: "Traiteur Saveurs", vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: ownerId });
    const radar = await loadRiskRadar(organizationId, now);
    expect(radar.rules.filter((rule) => !rule.available)).toEqual([]);
    const byRule = new Map(radar.alerts.map((alert) => [alert.rule, alert]));
    expect(byRule.get("document_expired")).toMatchObject({ eventId, facts: { vendor: "Traiteur Saveurs", document: kinds[0]!.label, expiresOn: "2027-06-30" }, href: `/prestataires/${vendor.id}` });
    expect(byRule.get("iban_to_verify")).toMatchObject({ eventId, facts: { vendor: "Traiteur Saveurs" }, href: `/prestataires/${vendor.id}` });
    // Le passage du matin prévient aussi : IBAN à vérifier (immédiat), alertes du radar.
    await runMorningPass(organizationId, now);
    const types = (await listNotifications(organizationId, ownerId)).map((notification) => notification.type);
    expect(types).toContain("iban_to_verify");
    expect(types.filter((type) => type === "risk_alert").length).toBeGreaterThanOrEqual(2);
    // Module Prestataires fermé : ces règles sont indisponibles, sans alerte ni erreur.
    await setModuleEnabled(appDatabase(), { adminUserId: randomUUID(), organizationId, moduleKey: "vendors", enabled: false });
    const closed = await loadRiskRadar(organizationId, now);
    expect(closed.alerts.filter((alert) => alert.rule === "document_expired" || alert.rule === "iban_to_verify")).toEqual([]);
    expect(closed.rules.filter((rule) => !rule.available).map((rule) => rule.rule).sort()).toEqual(["document_expired", "iban_to_verify"]);
  });
});
