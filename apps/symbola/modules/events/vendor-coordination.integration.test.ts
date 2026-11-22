// Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; D1 à D10 ; ADR 0085) — prestataires par lien,
// contre un vrai PostgreSQL (RLS), Garage, ClamAV et Mailpit, par la porte d'entrée du module.
// Tests d'abus (CLAUDE.md § 2.11, SEC-36) : les prestataires consultés ne se voient pas entre eux ;
// un lien n'ouvre que son évènement et son poste ; un lien d'une autre organisation, retiré ou
// expiré est refusé ; un clic d'e-mail n'enregistre rien. Horloge simulée pour les envois planifiés.
import { setRelationMailSender } from "@/modules/hub/service";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { recipientsDigest } from "@/modules/hub/service";
import { listBudgetLines } from "@/modules/budget/service";
import { CONSUMERS, runEventWorkerOnce } from "@/lib/event-worker";
import { starterVendorFollowUpTasks } from "@symbola/starter-templates";
import {
  addEventPlace,
  addEventVendorSlot,
  addVendorCandidate,
  answerLinkDecision,
  answerVendorBrief,
  attachEventDocument,
  attachVendorInvoiceByLink,
  attachVendorQuoteByLink,
  compareVendorScenarios,
  confirmVendorRoadmap,
  createEventLink,
  createProspect,
  createProspectSource,
  createVendorScenario,
  getVendorComparison,
  getVendorConsultationView,
  getVendorRoadmapView,
  getVendorCoordinationSettings,
  LinkAccessDeniedError,
  listEventDecisions,
  listEventLinks,
  listEventTasks,
  listLinkDecisions,
  listLinkSharedDocuments,
  listVendorAnswerNotices,
  listVendorCandidates,
  listVendorRoadmapAlerts,
  openEventLink,
  requestDecision,
  revokeEventLink,
  saveVendorBrief,
  sendVendorBrief,
  sendVendorBriefReminders,
  sendVendorRoadmaps,
  setLinkOptionFeedback,
  setVendorScenarioChoice,
  changeRetainedVendor,
  updateEventTask,
  updateVendorCandidate,
  VendorBriefInvalidError,
  VendorCandidateNotFoundError,
} from "./service";

// Lot 65d (MSG-01 ; ADR 0110) : ces tests vérifient l'envoi par Symbola, réglage « Symbola les envoie
// pour moi » : rien n'y change. Le réglage par défaut (la planner envoie de sa messagerie) est vérifié
// dans modules/hub/relation-mail.integration.test.ts.
async function symbolaSends(organizationId: string): Promise<string> {
  await setRelationMailSender(organizationId, "symbola");
  return organizationId;
}

// Le worker ne fait tourner que le consommateur du module Budget : lancé avec tous les consommateurs,
// il traiterait aussi les événements des autres fichiers de tests joués en parallèle (une facture
// d'acompte émise par le consommateur « quotes » sous un test des factures, par exemple).
const budgetWorker = () => runEventWorkerOnce({ budget: CONSUMERS.budget! });
const plannerId = randomUUID();
const MAILPIT_API = "http://localhost:8025/api/v1";
const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const TINY_PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
// Fichier de test antivirus normalisé (EICAR), reconnu par ClamAV.
const EICAR = new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return await symbolaSends((await createOrganization(db, `Org ${randomUUID()}`)).id);
  } finally {
    await sql.end();
  }
}

type MailpitSummary = { ID: string; Subject: string; To: { Address: string }[] };
type MailpitMessage = { Subject: string; Text: string; HTML: string; To: { Address: string }[]; Cc: { Address: string }[] | null; Bcc: { Address: string }[] | null };

async function mailsTo(email: string, count = 1): Promise<MailpitMessage[]> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: MailpitSummary[] };
    if (messages.length >= count) return Promise.all(messages.map(async (message) => (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as MailpitMessage));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

async function mailCount(email: string): Promise<number> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
  return ((await response.json()) as { messages: unknown[] }).messages.length;
}

// Le jeton d'un bouton de l'e-mail (« /lien?reponse=oui#jeton »).
function tokenOf(message: MailpitMessage, answer: "oui" | "non"): string {
  const match = new RegExp(`/lien\\?reponse=${answer}#([^\\s"<>]+)`).exec(message.Text);
  if (!match) throw new Error("bouton absent de l'e-mail");
  return match[1]!;
}

// Mariage de Léa et Maxime le 12 juin 2027 ; trois fleuristes consultés pour le poste des fleurs, un
// photographe pour un autre poste ; une photo d'inspiration dans les documents.
async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const created = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Maxime", lastName: "Durand" },
    ],
    eventDate: "2027-06-12",
  });
  const eventId = created.id;
  const flowers = await addEventVendorSlot(organizationId, eventId, "Poste A");
  const photo = await addEventVendorSlot(organizationId, eventId, "Poste B");
  const elodie = await addVendorCandidate({ organizationId, eventId, vendorSlotId: flowers.id, vendorName: "Atelier Élodie" });
  const pivoine = await addVendorCandidate({ organizationId, eventId, vendorSlotId: flowers.id, vendorName: "Pivoine & Cie" });
  const silence = await addVendorCandidate({ organizationId, eventId, vendorSlotId: flowers.id, vendorName: "Fleurs du Silence" });
  const studio = await addVendorCandidate({ organizationId, eventId, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
  await addEventPlace(organizationId, eventId, { label: "Domaine des Tilleuls", address: "1 allée des Tilleuls", city: "Lyon" });
  const inspiration = await attachEventDocument({ organizationId, eventId, label: "Inspiration pivoines", content: TINY_PNG, uploadedByUserId: plannerId });
  return { eventId, flowersId: flowers.id, photoId: photo.id, elodieId: elodie.id, pivoineId: pivoine.id, silenceId: silence.id, studioId: studio.id, inspirationId: inspiration.id };
}

const recipient = (candidateId: string, name: string) => ({ candidateId, name, email: `${name.toLowerCase().replace(/[^a-z]/g, "")}-${randomUUID()}@example.test` });

async function briefSent(organizationId: string, setup: Awaited<ReturnType<typeof wedding>>, options: { deadline?: string; showBudget?: boolean } = {}) {
  await saveVendorBrief({
    organizationId,
    eventId: setup.eventId,
    vendorSlotId: setup.flowersId,
    need: "Arche fleurie et douze centres de table, tons pastel.",
    guestCount: 120,
    indicativeBudgetCents: 350_000,
    showBudget: options.showBudget ?? false,
    deadline: options.deadline ?? "2027-03-10",
    documentIds: [setup.inspirationId],
  });
  const recipients = [recipient(setup.elodieId, "Elodie"), recipient(setup.pivoineId, "Pivoine"), recipient(setup.silenceId, "Silence")];
  const delivery = await sendVendorBrief({
    organizationId,
    eventId: setup.eventId,
    vendorSlotId: setup.flowersId,
    sentByUserId: plannerId,
    recipients,
    confirmedDigest: recipientsDigest(recipients),
    locale: "fr",
    now: new Date("2027-03-01T09:00:00Z"),
  });
  const links = await listEventLinks(organizationId, setup.eventId);
  const linkOf = (candidateId: string) => links.find((link) => link.vendorCandidateId === candidateId && link.status === "active")!.id;
  return { delivery, recipients, elodie: { ...recipients[0]!, linkId: linkOf(setup.elodieId) }, pivoine: { ...recipients[1]!, linkId: linkOf(setup.pivoineId) }, silence: { ...recipients[2]!, linkId: linkOf(setup.silenceId) } };
}

describe("PRE-03 — Demande de devis groupée : un brief à plusieurs prestataires, cloisonné", () => {
  it("un brief à trois prestataires crée trois liens et trois e-mails distincts, sans copie ; chacun passe à « Consulté »", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    expect(sent.delivery.sent).toBe(3);
    expect(new Set([sent.elodie.linkId, sent.pivoine.linkId, sent.silence.linkId]).size).toBe(3);
    for (const person of [sent.elodie, sent.pivoine, sent.silence]) {
      const [mail] = await mailsTo(person.email);
      expect(mail!.To.map((to) => to.Address)).toEqual([person.email]);
      expect(mail!.Cc ?? []).toEqual([]);
      expect(mail!.Bcc ?? []).toEqual([]);
    }
    const candidates = await listVendorCandidates(organizationId, setup.eventId);
    for (const id of [setup.elodieId, setup.pivoineId, setup.silenceId]) expect(candidates.find((candidate) => candidate.id === id)!.status).toBe("contacted");
    // Le photographe d'un autre poste n'est pas touché.
    expect(candidates.find((candidate) => candidate.id === setup.studioId)!.status).toBe("shortlisted");
  });

  it("abus : aucun e-mail, aucune page, aucune réponse ne contient le nom, le montant ou la réponse d'un autre consulté", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    await attachVendorQuoteByLink({ organizationId, linkId: sent.pivoine.linkId, content: TINY_PDF, quoteAmountCents: 412_345, message: "Avec plaisir" });
    const [mail] = await mailsTo(sent.elodie.email);
    for (const other of ["Pivoine", "Silence", "Lumière"]) {
      expect(mail!.Text).not.toContain(other);
      expect(mail!.HTML).not.toContain(other);
    }
    const view = await getVendorConsultationView(organizationId, sent.elodie.linkId);
    // Les identifiants (UUID aléatoires) peuvent contenir « 4123 » par hasard : ils sont retirés avant la recherche du montant.
    const serialized = JSON.stringify(view).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>");
    for (const other of ["Pivoine", "Silence", "Studio", "4123", "412345", "Avec plaisir"]) expect(serialized).not.toContain(other);
    expect(view.vendorName).toBe("Atelier Élodie");
    expect(view.answer.quoteAmountCents).toBeNull();
  });

  it("le brief porte le besoin, la date, le lieu et les inspirations ; le budget indicatif est masqué par défaut (D10)", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const hidden = await briefSent(organizationId, setup);
    const view = await getVendorConsultationView(organizationId, hidden.elodie.linkId);
    expect(view.stage).toBe("consultation");
    expect(view.brief!.need).toContain("Arche fleurie");
    expect(view.brief!.guestCount).toBe(120);
    expect(view.brief!.budgetCents).toBeNull();
    expect(view.eventDate).toBe("2027-06-12");
    expect(view.places.map((place) => place.label)).toEqual(["Domaine des Tilleuls"]);
    expect(view.brief!.documents.map((document) => document.id)).toEqual([setup.inspirationId]);

    const otherOrg = await organization();
    const other = await wedding(otherOrg);
    const shown = await briefSent(otherOrg, other, { showBudget: true });
    expect((await getVendorConsultationView(otherOrg, shown.elodie.linkId)).brief!.budgetCents).toBe(350_000);
  });

  it("un envoi à plusieurs ne part qu'après l'écran de contrôle des destinataires (MSG-02)", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    await saveVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, need: "Bouquet", guestCount: null, indicativeBudgetCents: null, showBudget: false, deadline: "2027-03-10", documentIds: [] });
    const recipients = [recipient(setup.elodieId, "Elodie"), recipient(setup.pivoineId, "Pivoine")];
    await expect(sendVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, sentByUserId: plannerId, recipients, confirmedDigest: null, locale: "fr" })).rejects.toThrow(/destinataires à confirmer/);
    expect(await mailCount(recipients[0]!.email)).toBe(0);
  });

  it("abus : un destinataire d'un autre poste ou d'une autre organisation est refusé ; une inspiration d'un autre évènement aussi", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const other = await wedding(organizationId);
    await expect(
      saveVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, need: "Bouquet", guestCount: null, indicativeBudgetCents: null, showBudget: false, deadline: "2027-03-10", documentIds: [other.inspirationId] }),
    ).rejects.toBeInstanceOf(VendorBriefInvalidError);
    await saveVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, need: "Bouquet", guestCount: null, indicativeBudgetCents: null, showBudget: false, deadline: "2027-03-10", documentIds: [] });
    const wrong = [recipient(setup.studioId, "Studio")];
    await expect(sendVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, sentByUserId: plannerId, recipients: wrong, confirmedDigest: null, locale: "fr" })).rejects.toBeInstanceOf(VendorBriefInvalidError);
    const foreign = [recipient(other.elodieId, "Autre")];
    await expect(sendVendorBrief({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, sentByUserId: plannerId, recipients: foreign, confirmedDigest: null, locale: "fr" })).rejects.toBeInstanceOf(VendorBriefInvalidError);
    expect(await mailCount(wrong[0]!.email)).toBe(0);
  });
});

describe("PRE-04 — Espace prestataire par lien personnel", () => {
  it("le bouton de l'e-mail n'enregistre rien sans le toucher de confirmation ; sans compte ni code, la réponse « disponible » et la photo du devis rangent le devis", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    const [mail] = await mailsTo(sent.elodie.email);
    // Le logiciel de messagerie ouvre le lien pour le vérifier : une session, rien d'autre.
    const opened = await openEventLink(tokenOf(mail!, "oui"));
    expect(opened.outcome).toBe("opened");
    expect((await getVendorConsultationView(organizationId, sent.elodie.linkId)).answer.availability).toBeNull();
    expect((await listVendorCandidates(organizationId, setup.eventId)).find((candidate) => candidate.id === setup.elodieId)!.status).toBe("contacted");
    // Le toucher de confirmation, puis le devis en photo.
    await answerVendorBrief({ organizationId, linkId: sent.elodie.linkId, availability: "available" });
    await attachVendorQuoteByLink({ organizationId, linkId: sent.elodie.linkId, content: TINY_PNG, quoteAmountCents: 285_000, message: "Pivoines de saison" });
    const elodie = (await listVendorCandidates(organizationId, setup.eventId)).find((candidate) => candidate.id === setup.elodieId)!;
    expect(elodie.status).toBe("quote_received");
    expect(elodie.quoteAmountCents).toBe(285_000);
    expect(elodie.hasQuoteFile).toBe(true);
    const view = await getVendorConsultationView(organizationId, sent.elodie.linkId);
    expect(view.answer).toMatchObject({ availability: "available", quoteAmountCents: 285_000, hasQuoteFile: true, message: "Pivoines de saison" });
    // « Aujourd'hui » de la planner le signale.
    expect((await listVendorAnswerNotices(organizationId)).map((notice) => notice.candidateId)).toContain(setup.elodieId);
  });

  it("« Indisponible » écarte le prestataire (motif « indisponible ») ; il peut changer d'avis tant que la planner n'a pas tranché", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    await answerVendorBrief({ organizationId, linkId: sent.pivoine.linkId, availability: "unavailable" });
    let rows = (await getVendorComparison(organizationId, setup.eventId, setup.flowersId)).rows;
    expect(rows.find((row) => row.candidateId === setup.pivoineId)).toMatchObject({ status: "dismissed", dismissalReason: "unavailable", availability: "unavailable" });
    await answerVendorBrief({ organizationId, linkId: sent.pivoine.linkId, availability: "available" });
    rows = (await getVendorComparison(organizationId, setup.eventId, setup.flowersId)).rows;
    expect(rows.find((row) => row.candidateId === setup.pivoineId)).toMatchObject({ status: "contacted", dismissalReason: null, availability: "available" });
    // La planner retient Élodie : les autres ne peuvent plus répondre.
    await updateVendorCandidate({ organizationId, candidateId: setup.elodieId, status: "retained", changedByUserId: plannerId });
    await expect(answerVendorBrief({ organizationId, linkId: sent.pivoine.linkId, availability: "available" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect((await getVendorConsultationView(organizationId, sent.pivoine.linkId)).stage).toBe("declined");
  });

  it("un lien de consultation ne montre ni programme, ni contacts, ni tâches ; une fois retenu, l'espace complet et le dépôt de facture", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    const consultation = await getVendorConsultationView(organizationId, sent.elodie.linkId);
    expect(Object.keys(consultation).sort()).toEqual(["answer", "brief", "canAnswer", "clientFirstNames", "eventDate", "places", "slotLabel", "stage", "vendorName"]);
    await expect(attachVendorInvoiceByLink({ organizationId, linkId: sent.elodie.linkId, content: TINY_PDF, label: "Facture Atelier Élodie" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getVendorRoadmapView(organizationId, sent.elodie.linkId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await updateVendorCandidate({ organizationId, candidateId: setup.elodieId, status: "retained", changedByUserId: plannerId });
    expect((await getVendorConsultationView(organizationId, sent.elodie.linkId)).stage).toBe("retained");
    await attachVendorInvoiceByLink({ organizationId, linkId: sent.elodie.linkId, content: TINY_PDF, label: "Facture Atelier Élodie" });
    const roadmap = await getVendorRoadmapView(organizationId, sent.elodie.linkId);
    expect(roadmap.invoice).not.toBeNull();
    // La facture est rangée dans les documents de l'évènement, non partagée.
    expect(await listLinkSharedDocuments(organizationId, sent.elodie.linkId)).toEqual([]);
  });

  it("fichiers (SEC-21) : type falsifié refusé, fichier de test antivirus refusé", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    await expect(attachVendorQuoteByLink({ organizationId, linkId: sent.elodie.linkId, content: new TextEncoder().encode("<html><script>alert(1)</script></html>") })).rejects.toThrow(/devis refusé/);
    await expect(attachVendorQuoteByLink({ organizationId, linkId: sent.elodie.linkId, content: EICAR })).rejects.toThrow(/devis refusé/);
    const elodie = (await listVendorCandidates(organizationId, setup.eventId)).find((candidate) => candidate.id === setup.elodieId)!;
    expect(elodie.hasQuoteFile).toBe(false);
  });
});

describe("PAR-05 (D2) — Relance la veille de la date limite, horloge simulée", () => {
  it("seuls les non-répondants sont relancés, une fois ; ni après une réponse, ni vers un lien retiré", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup, { deadline: "2027-03-10" });
    await answerVendorBrief({ organizationId, linkId: sent.elodie.linkId, availability: "available" });
    await revokeEventLink(organizationId, sent.pivoine.linkId);
    // L'avant-veille, rien ; la veille à 10 h, Paris : seul le troisième fleuriste.
    expect(await sendVendorBriefReminders(organizationId, new Date("2027-03-08T09:00:00Z"))).toBe(0);
    expect(await sendVendorBriefReminders(organizationId, new Date("2027-03-09T09:00:00Z"))).toBe(1);
    expect(await sendVendorBriefReminders(organizationId, new Date("2027-03-09T10:00:00Z"))).toBe(0);
    const silence = await mailsTo(sent.silence.email, 2);
    expect(silence).toHaveLength(2);
    expect(await mailCount(sent.elodie.email)).toBe(1);
    expect(await mailCount(sent.pivoine.email)).toBe(1);
    // Le lien de la relance ouvre la page ; l'ancien bouton ne vaut plus (nouveau jeton).
    const reminder = silence.find((message) => /rappel/i.test(message.Subject))!;
    const brief = silence.find((message) => message !== reminder)!;
    expect((await openEventLink(tokenOf(brief, "oui"))).outcome).toBe("invalid");
    expect((await openEventLink(tokenOf(reminder, "oui"))).outcome).toBe("opened");
    const rows = (await getVendorComparison(organizationId, setup.eventId, setup.flowersId)).rows;
    expect(rows.find((row) => row.candidateId === setup.silenceId)!.remindedAt).not.toBeNull();
  });

  it("hors des heures d'envoi, ou après la date limite, rien ne part", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    await briefSent(organizationId, setup, { deadline: "2027-03-10" });
    expect(await sendVendorBriefReminders(organizationId, new Date("2027-03-09T04:00:00Z"))).toBe(0);
    expect(await sendVendorBriefReminders(organizationId, new Date("2027-03-11T09:00:00Z"))).toBe(0);
  });
});

describe("BUD-05 — Comparaison des devis et scénarios d'options", () => {
  it("deux scénarios se comparent côte à côte, totaux exacts au centime, devis sans montant « à préciser »", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    await updateVendorCandidate({ organizationId, candidateId: setup.elodieId, quoteAmountCents: 285_050 });
    await updateVendorCandidate({ organizationId, candidateId: setup.pivoineId, quoteAmountCents: 199_999 });
    await updateVendorCandidate({ organizationId, candidateId: setup.studioId, quoteAmountCents: 240_001 });
    const generous = await createVendorScenario(organizationId, setup.eventId, "Généreux");
    const sober = await createVendorScenario(organizationId, setup.eventId, "Sobre");
    await setVendorScenarioChoice(organizationId, generous.id, setup.flowersId, setup.elodieId);
    await setVendorScenarioChoice(organizationId, generous.id, setup.photoId, setup.studioId);
    await setVendorScenarioChoice(organizationId, sober.id, setup.flowersId, setup.silenceId);
    const comparison = await compareVendorScenarios(organizationId, setup.eventId, [generous.id, sober.id]);
    expect(comparison.slots.map((slot) => slot.id)).toEqual([setup.flowersId, setup.photoId]);
    expect(comparison.columns.map((column) => [column.totalCents, column.pendingCount])).toEqual([
      [525_051, 0],
      [0, 1],
    ]);
    // Le comparatif d'un poste est trié par montant, les devis sans montant à la fin.
    const rows = (await getVendorComparison(organizationId, setup.eventId, setup.flowersId)).rows;
    expect(rows.map((row) => row.candidateId)).toEqual([setup.pivoineId, setup.elodieId, setup.silenceId]);
  });

  it("abus : un scénario ne prend qu'un prestataire consulté de ce poste et de cet évènement", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const scenario = await createVendorScenario(organizationId, setup.eventId, "A");
    await expect(setVendorScenarioChoice(organizationId, scenario.id, setup.flowersId, setup.studioId)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    const otherOrg = await organization();
    await expect(setVendorScenarioChoice(otherOrg, scenario.id, setup.flowersId, setup.elodieId)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    await expect(compareVendorScenarios(otherOrg, setup.eventId, [scenario.id])).resolves.toMatchObject({ columns: [] });
  });
});

async function clientLink(organizationId: string, eventId: string, rights: { rubrics: ("tasks" | "program" | "vendor_options" | "budget" | "quotes")[]; budgetScope: "all" | "selected"; sharedSlotIds: string[] }) {
  const delivery = await createEventLink({
    organizationId,
    eventId,
    createdByUserId: plannerId,
    audience: "client",
    locale: "fr",
    link: { personName: "Léa", email: `lea-${randomUUID()}@example.test`, rights },
  });
  return delivery.link.id;
}

function followUpLabels(vendor: string): string[] {
  return starterVendorFollowUpTasks("fr").map((task) => task.label.replace("{{prestataire}}", vendor));
}

async function committedOf(organizationId: string, eventId: string, candidateId: string): Promise<(number | null)[]> {
  return (await listBudgetLines(organizationId, eventId)).lines.filter((line) => line.vendorCandidateId === candidateId).map((line) => line.committedAmountCents);
}

async function optionDecision(organizationId: string, setup: Awaited<ReturnType<typeof wedding>>) {
  await updateVendorCandidate({ organizationId, candidateId: setup.elodieId, quoteAmountCents: 285_000, shownToClients: true });
  await updateVendorCandidate({ organizationId, candidateId: setup.pivoineId, quoteAmountCents: 199_000, shownToClients: true });
  return requestDecision({ organizationId, eventId: setup.eventId, requestedByUserId: plannerId, kind: "option", slotId: setup.flowersId });
}

describe("PRE-09 — Sélection partagée au client, avec avis et choix (D6, D7)", () => {
  it("le client ne voit que la sélection figée ; son avis est enregistré et la planner le lit dans le comparatif", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const decision = await optionDecision(organizationId, setup);
    // Montré après la demande : hors de la sélection figée.
    await updateVendorCandidate({ organizationId, candidateId: setup.silenceId, shownToClients: true });
    const linkId = await clientLink(organizationId, setup.eventId, { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] });
    const [seen] = await listLinkDecisions(organizationId, linkId);
    expect(seen!.snapshot.kind === "option" && seen!.snapshot.options.map((option) => option.candidateId)).toEqual([setup.elodieId, setup.pivoineId]);
    await setLinkOptionFeedback({ organizationId, linkId, decisionId: decision.id, candidateId: setup.elodieId, opinion: "like", comment: "Superbe arche" });
    await expect(setLinkOptionFeedback({ organizationId, linkId, decisionId: decision.id, candidateId: setup.silenceId, opinion: "like", comment: null })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    const rows = (await getVendorComparison(organizationId, setup.eventId, setup.flowersId)).rows;
    expect(rows.find((row) => row.candidateId === setup.elodieId)!.feedback).toMatchObject([{ opinion: "like", comment: "Superbe arche", personName: "Léa" }]);
  });

  it("le choix rend le prestataire Retenu, écarte les autres, engage la ligne de budget et crée les tâches de suivi", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const decision = await optionDecision(organizationId, setup);
    const linkId = await clientLink(organizationId, setup.eventId, { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] });
    await answerLinkDecision({ organizationId, linkId, decisionId: decision.id, answer: "approved", choiceId: setup.elodieId, comment: null });
    const candidates = await listVendorCandidates(organizationId, setup.eventId);
    expect(candidates.find((candidate) => candidate.id === setup.elodieId)!.status).toBe("retained");
    expect(candidates.find((candidate) => candidate.id === setup.pivoineId)!.status).toBe("dismissed");
    expect(candidates.find((candidate) => candidate.id === setup.silenceId)!.status).toBe("dismissed");
    expect(candidates.find((candidate) => candidate.id === setup.studioId)!.status).toBe("shortlisted");
    expect((await listEventTasks(organizationId, setup.eventId)).map((task) => task.label).filter((label) => followUpLabels("Atelier Élodie").includes(label)).sort()).toEqual([...followUpLabels("Atelier Élodie")].sort());
    await budgetWorker();
    expect(await committedOf(organizationId, setup.eventId, setup.elodieId)).toEqual([285_000]);
    expect((await listEventDecisions(organizationId, setup.eventId)).find((row) => row.id === decision.id)!.engagedAt).not.toBeNull();
  });

  it("la planner modifie le prestataire retenu à tout moment, sans limite de durée : l'engagé passe au nouveau devis, les tâches non commencées de l'ancien partent, celles commencées restent", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const decision = await optionDecision(organizationId, setup);
    const linkId = await clientLink(organizationId, setup.eventId, { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] });
    await answerLinkDecision({ organizationId, linkId, decisionId: decision.id, answer: "approved", choiceId: setup.elodieId, comment: null });
    await budgetWorker();
    const elodieTasks = (await listEventTasks(organizationId, setup.eventId)).filter((task) => followUpLabels("Atelier Élodie").includes(task.label));
    await updateEventTask({ organizationId, taskId: elodieTasks[0]!.id, done: true });
    // Bien plus tard (aucun délai) : Pivoine est retenue à la place d'Élodie.
    await changeRetainedVendor({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, candidateId: setup.pivoineId, userId: plannerId, now: new Date(Date.now() + 90 * 86_400_000) });
    const candidates = await listVendorCandidates(organizationId, setup.eventId);
    expect(candidates.find((candidate) => candidate.id === setup.pivoineId)!.status).toBe("retained");
    expect(candidates.find((candidate) => candidate.id === setup.elodieId)!.status).toBe("dismissed");
    const labels = (await listEventTasks(organizationId, setup.eventId)).map((task) => task.label);
    expect(labels).toContain(elodieTasks[0]!.label);
    expect(labels.filter((label) => followUpLabels("Atelier Élodie").includes(label))).toEqual([elodieTasks[0]!.label]);
    expect(labels.filter((label) => followUpLabels("Pivoine & Cie").includes(label)).sort()).toEqual([...followUpLabels("Pivoine & Cie")].sort());
    await budgetWorker();
    expect(await committedOf(organizationId, setup.eventId, setup.elodieId)).toEqual([null]);
    expect(await committedOf(organizationId, setup.eventId, setup.pivoineId)).toEqual([199_000]);
  });

  it("ne plus retenir personne : l'engagé est libéré, chacun revient en lice ; le client ne change pas seul son choix", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const decision = await optionDecision(organizationId, setup);
    const linkId = await clientLink(organizationId, setup.eventId, { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] });
    await answerLinkDecision({ organizationId, linkId, decisionId: decision.id, answer: "approved", choiceId: setup.elodieId, comment: null });
    await expect(answerLinkDecision({ organizationId, linkId, decisionId: decision.id, answer: "approved", choiceId: setup.pivoineId, comment: null })).rejects.toThrow(/décision invalide/);
    await budgetWorker();
    await changeRetainedVendor({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, candidateId: null, userId: plannerId });
    const candidates = await listVendorCandidates(organizationId, setup.eventId);
    expect(candidates.find((candidate) => candidate.id === setup.elodieId)!.status).toBe("quote_received");
    expect(candidates.find((candidate) => candidate.id === setup.pivoineId)!.status).toBe("quote_received");
    expect(candidates.find((candidate) => candidate.id === setup.silenceId)!.status).toBe("shortlisted");
    expect((await listEventTasks(organizationId, setup.eventId)).filter((task) => followUpLabels("Atelier Élodie").includes(task.label))).toEqual([]);
    await budgetWorker();
    expect(await committedOf(organizationId, setup.eventId, setup.elodieId)).toEqual([null]);
    // La planner redemande un choix : une nouvelle décision « options ».
    await expect(requestDecision({ organizationId, eventId: setup.eventId, requestedByUserId: plannerId, kind: "option", slotId: setup.flowersId })).resolves.toMatchObject({ status: "pending" });
  });

  it("abus : on ne retient qu'un prestataire consulté de ce poste et de cette organisation", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    await expect(changeRetainedVendor({ organizationId, eventId: setup.eventId, vendorSlotId: setup.flowersId, candidateId: setup.studioId, userId: plannerId })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    const otherOrg = await organization();
    await expect(changeRetainedVendor({ organizationId: otherOrg, eventId: setup.eventId, vendorSlotId: setup.flowersId, candidateId: setup.elodieId, userId: plannerId })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    expect((await listVendorCandidates(organizationId, setup.eventId)).find((candidate) => candidate.id === setup.elodieId)!.status).toBe("shortlisted");
  });

  it("abus : un payeur qui n'a pas le poste dans son périmètre ne voit pas la décision et n'y répond pas", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const decision = await optionDecision(organizationId, setup);
    const payer = await clientLink(organizationId, setup.eventId, { rubrics: ["vendor_options", "budget"], budgetScope: "selected", sharedSlotIds: [setup.photoId] });
    expect(await listLinkDecisions(organizationId, payer)).toEqual([]);
    await expect(answerLinkDecision({ organizationId, linkId: payer, decisionId: decision.id, answer: "approved", choiceId: setup.elodieId, comment: null })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(setLinkOptionFeedback({ organizationId, linkId: payer, decisionId: decision.id, candidateId: setup.elodieId, opinion: "like", comment: null })).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });
});

describe("PAR-05 (D8) — Feuille de route à J-30 et J-7, confirmation, alerte", () => {
  async function retained(organizationId: string) {
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    await updateVendorCandidate({ organizationId, candidateId: setup.elodieId, status: "retained", changedByUserId: plannerId });
    return { setup, sent };
  }

  it("envoyée à J-30 puis à J-7 (dans le fuseau de l'évènement), une seule fois chacune ; jamais à un prestataire écarté", async () => {
    const organizationId = await organization();
    const { sent } = await retained(organizationId);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-05-12T09:00:00Z"))).toBe(0);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-05-13T09:00:00Z"))).toBe(1);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-05-14T09:00:00Z"))).toBe(0);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-06-05T09:00:00Z"))).toBe(1);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-06-06T09:00:00Z"))).toBe(0);
    // Élodie : brief + J-30 + J-7 ; Pivoine (écartée) : le brief seulement.
    expect(await mailsTo(sent.elodie.email, 3)).toHaveLength(3);
    expect(await mailCount(sent.pivoine.email)).toBe(1);
  });

  it("une panne : J-30 est rattrapée le lendemain ; la confirmation est horodatée ; sans elle, l'alerte trois jours après J-7", async () => {
    const organizationId = await organization();
    const { sent } = await retained(organizationId);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-05-14T09:00:00Z"))).toBe(1);
    expect(await sendVendorRoadmaps(organizationId, new Date("2027-06-05T09:00:00Z"))).toBe(1);
    expect(await listVendorRoadmapAlerts(organizationId, new Date("2027-06-08T08:00:00Z"))).toEqual([]);
    expect((await listVendorRoadmapAlerts(organizationId, new Date("2027-06-08T09:30:00Z"))).map((alert) => alert.vendorName)).toEqual(["Atelier Élodie"]);
    await confirmVendorRoadmap({ organizationId, linkId: sent.elodie.linkId, now: new Date("2027-06-08T10:00:00Z") });
    const view = await getVendorRoadmapView(organizationId, sent.elodie.linkId);
    expect(view.sent.find((roadmap) => roadmap.stage === "j7")!.confirmedAt).toBe("2027-06-08T10:00:00.000Z");
    expect(view.awaitingConfirmation).toBe(false);
    expect(await listVendorRoadmapAlerts(organizationId, new Date("2027-06-09T09:00:00Z"))).toEqual([]);
  });
});

describe("SEC-36 — Isolation des prestataires par lien", () => {
  it("le lien d'un prestataire n'ouvre que son évènement et son poste ; un lien d'une autre organisation ou retiré est refusé", async () => {
    const organizationId = await organization();
    const setup = await wedding(organizationId);
    const sent = await briefSent(organizationId, setup);
    const otherOrg = await organization();
    await expect(getVendorConsultationView(otherOrg, sent.elodie.linkId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(answerVendorBrief({ organizationId: otherOrg, linkId: sent.elodie.linkId, availability: "available" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await revokeEventLink(organizationId, sent.silence.linkId);
    await expect(getVendorConsultationView(organizationId, sent.silence.linkId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(attachVendorQuoteByLink({ organizationId, linkId: sent.silence.linkId, content: TINY_PDF })).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("organisation A ne lit ni brief, ni comparatif, ni scénario, ni réponse de B", async () => {
    const organizationA = await organization();
    const organizationB = await organization();
    const setupB = await wedding(organizationB);
    await briefSent(organizationB, setupB);
    const comparison = await getVendorComparison(organizationA, setupB.eventId, setupB.flowersId);
    expect(comparison.rows).toEqual([]);
    expect(comparison.brief).toBeNull();
    expect(await listVendorAnswerNotices(organizationA)).toEqual([]);
    expect(await getVendorCoordinationSettings(organizationA, "fr", "wedding_planner")).toMatchObject({ briefDeadlineDays: 7 });
  });
});
