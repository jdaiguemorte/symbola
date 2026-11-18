// Lot 51 (EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09, PAR-08 ; D1 à D8, ADR 0091) — le jour J de
// terrain contre un vrai PostgreSQL (RLS), un vrai Mailpit et un vrai ClamAV, par la porte d'entrée
// des modules events et budget. Les actions de la file arrivent une seule fois (identifiant
// d'action) ; rien n'est envoyé sans la validation de la planner ; deux pointages simultanés restent.
// Tests d'abus (CLAUDE.md § 2.11, SEC-36) : une autre organisation ne pointe ni ne lit rien ; un
// prestataire ou un client par son lien ne voit ni la main courante ni le bilan.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { EICAR_TEST_STRING } from "@symbola/files";
import type { DayAction, EventLinkRights, ProgramRecipientDocument } from "@symbola/contracts";
import { addDefaultVendorSlots } from "./service";
import {
  addEventVendorSlot,
  addKeyMoment,
  addProgramItem,
  addVendorCandidate,
  applyDayAction,
  createDayChecklist,
  createEventLink,
  createProspect,
  createProspectSource,
  getDayReport,
  getDayState,
  getEventProgram,
  getEventProgramPublication,
  guestEventContexts,
  importEventProgram,
  KeyMomentInvalidError,
  latestVendorDayShift,
  listDayChecklistTemplates,
  listEventVendorSlots,
  listKeyMoments,
  receiveDayPhoto,
  removeKeyMoment,
} from "./service";
import { addVendorPayment, getLinkBudgetView, listBudgetLines, listDayHandovers, recordDayHandover, setVendorPaymentHandover, updateBudgetLine } from "@/modules/budget/service";

const plannerId = randomUUID();
const camille = randomUUID();
const hugo = randomUUID();
const MAILPIT_API = "http://localhost:8025/api/v1";
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"));
const PROGRAM: EventLinkRights = { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] };
// Petite image JPEG valide (en-tête suffisant pour la détection par le contenu).
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...new Array(200).fill(0), 0xff, 0xd9]);
// Horloge simulée : le jour J du mariage (les heures des téléphones y sont vraisemblables).
const NOW = new Date("2027-06-12T15:00:00Z");
const renderDocument = async (_document: ProgramRecipientDocument) => ({ filename: "programme.pdf", content: PDF });

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
  } finally {
    await sql.end();
  }
}

async function mailsTo(to: string, wait = true): Promise<{ Subject: string }[]> {
  for (let attempt = 0; attempt < (wait ? 30 : 1); attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    // Les e-mails du programme seulement (le lien du prestataire a reçu le sien à sa création).
    const messages = ((await response.json()) as { messages: { Subject: string }[] }).messages.filter((message) => /^(Programme|Schedule)/.test(message.Subject));
    if (messages.length > 0) return messages;
    if (wait) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

const action = <T extends DayAction>(value: Omit<T, "actionId" | "deviceAt"> & { deviceAt?: string; actionId?: string }) =>
  ({ actionId: randomUUID(), deviceAt: "2027-06-12T14:20:00Z", ...value }) as T;

// Mariage de Camille sur trois jours : vendredi (cocktail), samedi (cérémonie, cocktail, bus, dîner),
// dimanche (brunch). Officiante, traiteur et autocariste, chacun avec son lien ; un client.
async function weekend(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  const friday = await addKeyMoment(organizationId, event.id, { name: "Cocktail de bienvenue", date: "2027-06-11" });
  const saturday = await addKeyMoment(organizationId, event.id, { name: "Cérémonie et dîner", date: "2027-06-12" });
  const sunday = await addKeyMoment(organizationId, event.id, { name: "Brunch", date: "2027-06-13" });
  const officiant = await addEventVendorSlot(organizationId, event.id, "Officiante");
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const coach = await addEventVendorSlot(organizationId, event.id, "Autocar");
  const add = (keyMomentId: string, startTime: string, endTime: string | null, label: string, vendorSlotIds: string[]) =>
    addProgramItem(organizationId, event.id, { keyMomentId, startTime, endTime, label, vendorSlotIds, freeParticipants: [] });
  const welcome = await add(friday.id, "19:00", "22:00", "Cocktail de bienvenue", [caterer.id]);
  const ceremony = await add(saturday.id, "16:00", "16:45", "Cérémonie", [officiant.id]);
  const cocktail = await add(saturday.id, "17:00", "19:00", "Vin d'honneur", [caterer.id]);
  const bus = await add(saturday.id, "19:15", null, "Navette", [coach.id]);
  const dinner = await add(saturday.id, "20:00", "23:30", "Dîner", [caterer.id]);
  const brunch = await add(sunday.id, "11:00", "14:00", "Brunch", [caterer.id]);
  const vendorLink = async (slotId: string, name: string) => {
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slotId, vendorName: name });
    const email = `${name.toLowerCase().replace(/[^a-z]/g, "")}-${randomUUID()}@example.test`;
    await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience: "vendor", vendorCandidateId: candidate.id, locale: "fr", link: { personName: name, email, rights: PROGRAM } });
    return email;
  };
  const officiantEmail = await vendorLink(officiant.id, "Officiante Claire");
  const catererEmail = await vendorLink(caterer.id, "Traiteur Karim");
  const coachEmail = await vendorLink(coach.id, "Autocars Martin");
  const clientEmail = `lea-${randomUUID()}@example.test`;
  await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa", email: clientEmail, rights: PROGRAM } });
  return { eventId: event.id, moments: { friday, saturday, sunday }, slots: { officiant, caterer, coach }, items: { welcome, ceremony, cocktail, bus, dinner, brunch }, emails: { officiantEmail, catererEmail, coachEmail, clientEmail } };
}

describe("EVT-04 — Évènements sur plusieurs jours et en plusieurs temps forts", () => {
  it("chaque temps fort a son chrono : trois jours, chaque séquence à son temps fort ; un temps fort qui porte des séquences ne se supprime pas", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const program = await getEventProgram(organizationId, w.eventId);
    const byMoment = (id: string) => program.items.filter((item) => item.keyMomentId === id).map((item) => item.label);
    expect(byMoment(w.moments.friday.id)).toEqual(["Cocktail de bienvenue"]);
    expect(byMoment(w.moments.saturday.id)).toEqual(["Cérémonie", "Vin d'honneur", "Navette", "Dîner"]);
    expect(byMoment(w.moments.sunday.id)).toEqual(["Brunch"]);
    await expect(removeKeyMoment(organizationId, w.eventId, w.moments.sunday.id)).rejects.toBeInstanceOf(KeyMomentInvalidError);
  });

  it("un évènement d'un jour garde un temps fort unique, créé de lui-même à la première séquence, que les invités ne voient pas", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-09-04" });
    const first = await addProgramItem(organizationId, event.id, { startTime: "15:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    const second = await addProgramItem(organizationId, event.id, { startTime: "19:00", label: "Dîner", vendorSlotIds: [], freeParticipants: [] });
    const moments = await listKeyMoments(organizationId, event.id);
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({ name: "Jour J", date: "2027-09-04", autoCreated: true });
    expect(first.keyMomentId).toBe(moments[0]!.id);
    expect(second.keyMomentId).toBe(moments[0]!.id);
    expect((await guestEventContexts(organizationId, [event.id]))[0]!.keyMoments).toEqual([]);
  });

  it("une autre organisation ne rattache pas une séquence à un temps fort qui n'est pas le sien", async () => {
    const [mine, other] = [await organization(), await organization()];
    const w = await weekend(mine);
    const source = await createProspectSource(other, "Salon");
    const event = await createProspect({ organizationId: other, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "X", lastName: null }], eventDate: "2027-06-12" });
    await expect(addProgramItem(other, event.id, { keyMomentId: w.moments.saturday.id, startTime: "10:00", label: "Intrus", vendorSlotIds: [], freeParticipants: [] })).rejects.toThrow();
  });
});

describe("CHR-08 — Modèles de chrono et import", () => {
  it("un chrono existant s'importe depuis un tableur : aperçu d'abord, rien n'est écrit ; puis les séquences et les temps forts manquants", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const csv = ["Temps fort;Date;Début;Fin;Séquence;Lieu;Note", "Brunch;;12h;13h;Photos de groupe;Terrasse;", "Retour;14/06/2027;10:00;;Départ des invités;;=1+1", ";;9h;;Café;;", "Brunch;;;;;;"].join("\n");
    const bytes = new TextEncoder().encode(csv);
    const preview = await importEventProgram({ organizationId, eventId: w.eventId, bytes, apply: null });
    expect(preview.status).toBe("preview");
    if (preview.status !== "preview") return;
    expect(preview.preview.rows.map((row) => [row.moment, row.momentDate, row.label])).toEqual([
      ["Brunch", "2027-06-13", "Photos de groupe"],
      ["Retour", "2027-06-14", "Départ des invités"],
      [null, "2027-06-12", "Café"],
    ]);
    expect(preview.preview.problems).toEqual([{ line: 5, problem: "start" }]);
    expect(preview.preview.newMoments).toEqual([{ name: "Retour", date: "2027-06-14" }]);
    expect(preview.preview.neutralizedCells).toBe(1);
    expect((await getEventProgram(organizationId, w.eventId)).items).toHaveLength(6);

    const applied = await importEventProgram({ organizationId, eventId: w.eventId, bytes, apply: { skipLines: [4] } });
    expect(applied).toEqual({ status: "applied", items: 2, moments: 1, skipped: 1 });
    const moments = await listKeyMoments(organizationId, w.eventId);
    expect(moments.map((moment) => moment.name)).toContain("Retour");
    const items = (await getEventProgram(organizationId, w.eventId)).items;
    const imported = items.find((item) => item.label === "Départ des invités")!;
    expect(imported.keyMomentId).toBe(moments.find((moment) => moment.name === "Retour")!.id);
    expect(imported.internalNote).toBe("'=1+1");
    expect(items.find((item) => item.label === "Photos de groupe")!.keyMomentId).toBe(w.moments.sunday.id);
  });
});

describe("JRJ-05 — Pointage des séquences ; décalage de la suite et information des prestataires", () => {
  it("rien n'est envoyé sans validation ; validé, le programme est décalé, une version diffusée, et seuls les prestataires concernés sont prévenus, une seule fois", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    // 16 h 20 : la cérémonie commence ; le retard est proposé sur le téléphone, rien n'est envoyé.
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "checkpoint", itemId: w.items.ceremony.id, checkpoint: "started" }), renderDocument, now: NOW })).toEqual({ status: "applied" });
    expect(await mailsTo(w.emails.officiantEmail, false)).toEqual([]);
    expect((await getEventProgramPublication(organizationId, w.eventId)).latest).toBeNull();

    // Camille décoche la navette (fixe) : l'autocariste n'est pas prévenu.
    const shift = action<Extract<DayAction, { kind: "shift" }>>({
      kind: "shift",
      keyMomentId: w.moments.saturday.id,
      lateItemId: w.items.ceremony.id,
      minutes: 20,
      itemIds: [w.items.ceremony.id, w.items.cocktail.id, w.items.dinner.id],
      vendorSlotIds: [w.slots.officiant.id, w.slots.caterer.id],
      deviceAt: "2027-06-12T14:21:00Z",
    });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: shift, renderDocument, now: NOW })).toEqual({ status: "applied" });
    const times = Object.fromEntries((await getEventProgram(organizationId, w.eventId)).items.map((item) => [item.label, [item.startTime, item.endTime]]));
    expect(times).toMatchObject({ Cérémonie: ["16:20", "17:05"], "Vin d'honneur": ["17:20", "19:20"], Navette: ["19:15", null], Dîner: ["20:20", "23:50"], Brunch: ["11:00", "14:00"] });
    expect((await getEventProgramPublication(organizationId, w.eventId)).latest?.number).toBe(1);
    expect(await mailsTo(w.emails.officiantEmail)).toHaveLength(1);
    expect(await mailsTo(w.emails.catererEmail)).toHaveLength(1);
    expect(await mailsTo(w.emails.coachEmail, false)).toEqual([]);
    expect(await mailsTo(w.emails.clientEmail, false)).toEqual([]);
    expect(await latestVendorDayShift(organizationId, w.eventId, w.slots.caterer.id)).toMatchObject({ minutes: 20, programVersion: 1 });
    expect(await latestVendorDayShift(organizationId, w.eventId, w.slots.coach.id)).toBeNull();

    // Validation hors ligne rejouée au retour du réseau : ignorée, rien ne part deux fois.
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: shift, renderDocument, now: NOW })).toEqual({ status: "duplicate" });
    expect((await getEventProgram(organizationId, w.eventId)).items.find((item) => item.label === "Cérémonie")!.startTime).toBe("16:20");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mailsTo(w.emails.catererEmail)).toHaveLength(1);
    const state = await getDayState(organizationId, w.eventId);
    expect(state!.shifts).toHaveLength(1);
    expect(state!.shifts[0]).toMatchObject({ outcome: "applied", minutes: 20, notifiedCount: 2 });
  });

  it("un décalage qui ferait sortir une séquence du jour est refusé à l'arrivée : la validation reste, rien n'est décalé ni envoyé", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const result = await applyDayAction({
      organizationId,
      eventId: w.eventId,
      userId: camille,
      action: action({ kind: "shift", keyMomentId: w.moments.saturday.id, lateItemId: w.items.ceremony.id, minutes: 600, itemIds: [w.items.dinner.id], vendorSlotIds: [w.slots.caterer.id] }),
      renderDocument,
      now: NOW,
    });
    expect(result).toEqual({ status: "rejected", reason: "out_of_day" });
    expect((await getEventProgram(organizationId, w.eventId)).items.find((item) => item.label === "Dîner")!.startTime).toBe("20:00");
    expect(await mailsTo(w.emails.catererEmail, false)).toEqual([]);
    expect((await getDayState(organizationId, w.eventId))!.shifts[0]!.outcome).toBe("out_of_day");
  });
});

describe("JRJ-08 — Partage en temps réel avec l'équipe sur place", () => {
  it("deux pointages simultanés de la même séquence par deux membres : les deux restent, la première heure est retenue ; chacun voit le pointage de l'autre", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const fromCamille = action({ kind: "checkpoint", itemId: w.items.cocktail.id, checkpoint: "started", deviceAt: "2027-06-12T15:20:04Z" });
    const fromHugo = action({ kind: "checkpoint", itemId: w.items.cocktail.id, checkpoint: "started", deviceAt: "2027-06-12T15:20:09Z" });
    const results = await Promise.all([
      applyDayAction({ organizationId, eventId: w.eventId, userId: hugo, action: fromHugo, renderDocument, now: NOW }),
      applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: fromCamille, renderDocument, now: NOW }),
    ]);
    expect(results).toEqual([{ status: "applied" }, { status: "applied" }]);
    const state = (await getDayState(organizationId, w.eventId))!;
    expect(state.checkpoints.filter((checkpoint) => checkpoint.itemId === w.items.cocktail.id).map((checkpoint) => checkpoint.userId)).toEqual([camille, hugo]);
    expect(state.actuals.find((actual) => actual.itemId === w.items.cocktail.id)).toMatchObject({ startedAt: "2027-06-12T15:20:04.000Z", startedBy: camille, count: 2 });
  });
});

describe("JRJ-06 — Listes de contrôle d'installation et de démontage, avec photos", () => {
  it("les modèles de départ sont copiés ; une liste se crée pour un temps fort ; une case se coche une fois, la première coche reste", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const templates = await listDayChecklistTemplates(organizationId, "fr");
    expect(templates.map((template) => template.phase)).toEqual(["setup", "setup", "teardown"]);
    const listId = await createDayChecklist({ organizationId, eventId: w.eventId, keyMomentId: w.moments.saturday.id, templateId: templates[0]!.id });
    const first = (await getDayState(organizationId, w.eventId))!.checklists.find((list) => list.id === listId)!.items[0]!;
    const check = action({ kind: "check", checklistItemId: first.id, deviceAt: "2027-06-12T12:00:00Z" });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: check, renderDocument, now: NOW })).toEqual({ status: "applied" });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: hugo, action: { ...check, actionId: randomUUID(), deviceAt: "2027-06-12T12:05:00Z" }, renderDocument, now: NOW })).toEqual({ status: "duplicate" });
    expect((await getDayState(organizationId, w.eventId))!.checklists[0]!.items[0]).toMatchObject({ checkedBy: camille, checkedAt: "2027-06-12T12:00:00.000Z" });
  });

  it("une photo jointe à une case est contrôlée à l'arrivée : acceptée, ou refusée par l'antivirus et signalée, la case restant cochée ; une photo rejouée n'est gardée qu'une fois", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const [template] = await listDayChecklistTemplates(organizationId, "fr");
    const listId = await createDayChecklist({ organizationId, eventId: w.eventId, keyMomentId: w.moments.saturday.id, templateId: template!.id });
    const item = (await getDayState(organizationId, w.eventId))!.checklists.find((list) => list.id === listId)!.items[0]!;
    await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "check", checklistItemId: item.id }), renderDocument, now: NOW });
    const meta = { actionId: randomUUID(), deviceAt: "2027-06-12T12:01:00Z", subject: "checklist_item" as const, subjectId: item.id, subjectActionId: null };
    const accepted = await receiveDayPhoto({ organizationId, eventId: w.eventId, userId: camille, meta, bytes: JPEG, maxBytes: 5_000_000, now: NOW });
    expect(accepted).toMatchObject({ status: "applied", photo: { state: "stored", subject: "checklist_item", subjectId: item.id } });
    expect(await receiveDayPhoto({ organizationId, eventId: w.eventId, userId: camille, meta, bytes: JPEG, maxBytes: 5_000_000, now: NOW })).toMatchObject({ status: "duplicate" });
    const infected = new Uint8Array(Buffer.from(EICAR_TEST_STRING));
    const refused = await receiveDayPhoto({ organizationId, eventId: w.eventId, userId: camille, meta: { ...meta, actionId: randomUUID() }, bytes: infected, maxBytes: 5_000_000, now: NOW });
    expect(refused).toMatchObject({ status: "applied", photo: { state: "rejected", rejection: "virus" } });
    const tooBig = await receiveDayPhoto({ organizationId, eventId: w.eventId, userId: camille, meta: { ...meta, actionId: randomUUID() }, bytes: JPEG, maxBytes: 100, now: NOW });
    expect(tooBig.photo).toMatchObject({ state: "rejected", rejection: "size" });
    const after = (await getDayState(organizationId, w.eventId))!.checklists[0]!.items[0]!;
    expect(after.checkedBy).toBe(camille);
    expect(after.photos.map((photo) => photo.state)).toEqual(["stored", "rejected", "rejected"]);
  });
});

describe("JRJ-07 — Main courante : incident horodaté, dicté, avec photo", () => {
  it("l'incident garde l'heure du téléphone et sa gravité ; sa photo, envoyée après lui, le retrouve par son action ; un rejeu est ignoré", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const incident = action<Extract<DayAction, { kind: "incident" }>>({ kind: "incident", body: "Le traiteur arrive par l'entrée de service, portail bloqué", severity: "follow_up", keyMomentId: w.moments.saturday.id, deviceAt: "2027-06-12T14:41:00Z" });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: incident, renderDocument, now: NOW })).toEqual({ status: "applied" });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: incident, renderDocument, now: NOW })).toEqual({ status: "duplicate" });
    const photo = await receiveDayPhoto({ organizationId, eventId: w.eventId, userId: camille, meta: { actionId: randomUUID(), deviceAt: "2027-06-12T14:41:05Z", subject: "incident", subjectId: null, subjectActionId: incident.actionId }, bytes: JPEG, maxBytes: 5_000_000, now: NOW });
    expect(photo.status).toBe("applied");
    const [saved] = (await getDayState(organizationId, w.eventId))!.incidents;
    expect(saved).toMatchObject({ body: incident.body, severity: "follow_up", deviceAt: "2027-06-12T14:41:00.000Z", userId: camille, keyMomentId: w.moments.saturday.id });
    expect(saved!.photos).toHaveLength(1);
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "incident", body: "  ", severity: null, keyMomentId: null }), renderDocument, now: NOW })).toEqual({ status: "rejected", reason: "body" });
  });
});

describe("JRJ-09 — Liste des paiements à remettre le jour même", () => {
  it("chaque remise se pointe une fois ; l'échéance passe à « remise » et réglée dans le budget du client", async () => {
    const organizationId = await organization();
    await addDefaultVendorSlots(organizationId, ["Traiteur"]);
    const w = await weekend(organizationId);
    const slot = (await listEventVendorSlots(organizationId, w.eventId)).find((entry) => entry.label === "Traiteur")!;
    await updateBudgetLine({ organizationId, eventId: w.eventId, eventVendorSlotId: slot.id, field: "committed", amountCents: 900000, changedByUserId: plannerId });
    const line = (await listBudgetLines(organizationId, w.eventId)).lines.find((entry) => entry.eventVendorSlotId === slot.id)!;
    await addVendorPayment({ organizationId, eventId: w.eventId, lineId: line.id, label: "Solde", fixedAmountCents: 300000, dueOn: "2027-06-12", changedByUserId: plannerId });
    const paymentId = (await listBudgetLines(organizationId, w.eventId)).lines.flatMap((entry) => entry.payments).find((payment) => payment.label === "Solde")!.id;
    expect(await listDayHandovers(organizationId, w.eventId)).toEqual([]);
    await setVendorPaymentHandover({ organizationId, eventId: w.eventId, paymentId, onDay: true, method: "Chèque", by: "Camille", changedByUserId: plannerId });
    expect(await listDayHandovers(organizationId, w.eventId)).toEqual([expect.objectContaining({ paymentId, amountCents: 300000, method: "Chèque", by: "Camille", handedOverAt: null })]);

    const handedOverAt = new Date("2027-06-12T21:30:00Z");
    const actionId = randomUUID();
    expect(await recordDayHandover({ organizationId, eventId: w.eventId, paymentId, userId: camille, actionId, handedOverAt, timeZone: "Europe/Paris" })).toBe("applied");
    expect(await recordDayHandover({ organizationId, eventId: w.eventId, paymentId, userId: hugo, actionId: randomUUID(), handedOverAt, timeZone: "Europe/Paris" })).toBe("duplicate");
    const [handover] = await listDayHandovers(organizationId, w.eventId);
    expect(handover).toMatchObject({ handedOverAt: "2027-06-12T21:30:00.000Z", handedOverBy: camille });
    const payment = (await listBudgetLines(organizationId, w.eventId)).lines.flatMap((entry) => entry.payments).find((entry) => entry.id === paymentId)!;
    expect(payment).toMatchObject({ status: "paid", paidOn: "2027-06-12" });
    const client = await createEventLink({ organizationId, eventId: w.eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa", email: `budget-${randomUUID()}@example.test`, rights: { rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] } } });
    expect((await getLinkBudgetView(organizationId, client.link.id)).payments.find((entry) => entry.id === paymentId)).toMatchObject({ status: "paid", handedOverAt: "2027-06-12T21:30:00.000Z" });
    // Un payeur hors périmètre (catégories choisies sans le traiteur) ne la voit pas.
    const other = await addEventVendorSlot(organizationId, w.eventId, "Fleurs");
    const narrow = await createEventLink({ organizationId, eventId: w.eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Paul", email: `payeur-${randomUUID()}@example.test`, rights: { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [other.id] } } });
    expect((await getLinkBudgetView(organizationId, narrow.link.id)).payments.map((entry) => entry.id)).not.toContain(paymentId);
  });
});

describe("PAR-08 — le bilan du lendemain", () => {
  it("prêt le lendemain du dernier jour dans le fuseau de l'évènement : écarts, décalages, incidents, cases non cochées, remises", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "checkpoint", itemId: w.items.ceremony.id, checkpoint: "started", deviceAt: "2027-06-12T14:20:00Z" }), renderDocument, now: NOW });
    await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "shift", keyMomentId: w.moments.saturday.id, lateItemId: w.items.ceremony.id, minutes: 20, itemIds: [w.items.ceremony.id, w.items.dinner.id], vendorSlotIds: [] }), renderDocument, now: NOW });
    await applyDayAction({ organizationId, eventId: w.eventId, userId: hugo, action: action({ kind: "incident", body: "Pluie à 17 h, cocktail sous la halle", severity: "info", keyMomentId: null }), renderDocument, now: NOW });
    const [template] = await listDayChecklistTemplates(organizationId, "fr");
    await createDayChecklist({ organizationId, eventId: w.eventId, keyMomentId: w.moments.saturday.id, templateId: template!.id });

    // Le dimanche (dernier jour) à 23 h 59 à Paris : pas encore.
    const sundayNight = await getDayReport({ organizationId, eventId: w.eventId, handovers: [], now: new Date("2027-06-13T21:59:00Z") });
    expect(sundayNight).toMatchObject({ ready: false, readyOn: "2027-06-14", preparedAt: null });
    const monday = await getDayReport({ organizationId, eventId: w.eventId, handovers: [], now: new Date("2027-06-13T22:00:00Z") });
    expect(monday!.ready).toBe(true);
    expect(monday!.preparedAt).toBe("2027-06-13T22:00:00.000Z");
    const ceremony = monday!.sequences.find((sequence) => sequence.itemId === w.items.ceremony.id)!;
    // Prévue à 16 h (avant le décalage), commencée à 16 h 20.
    expect(ceremony).toMatchObject({ plannedStart: "16:00", actualStart: "2027-06-12T14:20:00.000Z", startGap: 20 });
    expect(monday!.shifts).toHaveLength(1);
    expect(monday!.incidents.map((incident) => incident.body)).toEqual(["Pluie à 17 h, cocktail sous la halle"]);
    expect(monday!.uncheckedItems.length).toBe(template!.items.length);
  });
});

describe("SEC-36 — Isolation et abus du jour J", () => {
  it("un membre d'une autre organisation ne pointe, ne note, ne coche ni ne lit rien de l'évènement ; il ne joint pas de photo", async () => {
    const [mine, other] = [await organization(), await organization()];
    const w = await weekend(mine);
    const [template] = await listDayChecklistTemplates(mine, "fr");
    const listId = await createDayChecklist({ organizationId: mine, eventId: w.eventId, keyMomentId: null, templateId: template!.id });
    const item = (await getDayState(mine, w.eventId))!.checklists.find((list) => list.id === listId)!.items[0]!;
    const intruder = randomUUID();
    expect(await applyDayAction({ organizationId: other, eventId: w.eventId, userId: intruder, action: action({ kind: "checkpoint", itemId: w.items.ceremony.id, checkpoint: "started" }), renderDocument, now: NOW })).toEqual({ status: "rejected", reason: "item" });
    expect(await applyDayAction({ organizationId: other, eventId: w.eventId, userId: intruder, action: action({ kind: "incident", body: "intrusion", severity: null, keyMomentId: null }), renderDocument, now: NOW })).toEqual({ status: "rejected", reason: "event" });
    expect(await applyDayAction({ organizationId: other, eventId: w.eventId, userId: intruder, action: action({ kind: "check", checklistItemId: item.id }), renderDocument, now: NOW })).toEqual({ status: "rejected", reason: "item" });
    expect(await applyDayAction({ organizationId: other, eventId: w.eventId, userId: intruder, action: action({ kind: "shift", keyMomentId: null, lateItemId: w.items.ceremony.id, minutes: 10, itemIds: [w.items.dinner.id], vendorSlotIds: [] }), renderDocument, now: NOW })).toEqual({ status: "rejected", reason: "event" });
    expect(await receiveDayPhoto({ organizationId: other, eventId: w.eventId, userId: intruder, meta: { actionId: randomUUID(), deviceAt: "2027-06-12T12:00:00Z", subject: "checklist_item", subjectId: item.id, subjectActionId: null }, bytes: JPEG, maxBytes: 5_000_000, now: NOW })).toMatchObject({ status: "rejected", reason: "subject" });
    expect(await getDayState(other, w.eventId)).toBeNull();
    expect(await getDayReport({ organizationId: other, eventId: w.eventId, handovers: [] })).toBeNull();
    // Rien n'a bougé chez la planner.
    const state = (await getDayState(mine, w.eventId))!;
    expect([state.checkpoints.length, state.incidents.length, state.shifts.length, state.checklists[0]!.items[0]!.checkedAt]).toEqual([0, 0, 0, null]);
    // Une même identité d'action dans une autre organisation n'écrase rien (unicité par organisation).
    const shared = randomUUID();
    const otherWeekend = await weekend(other);
    expect(await applyDayAction({ organizationId: mine, eventId: w.eventId, userId: camille, action: action({ kind: "checkpoint", actionId: shared, itemId: w.items.ceremony.id, checkpoint: "started" }), renderDocument, now: NOW })).toEqual({ status: "applied" });
    expect(await applyDayAction({ organizationId: other, eventId: otherWeekend.eventId, userId: intruder, action: action({ kind: "checkpoint", actionId: shared, itemId: otherWeekend.items.ceremony.id, checkpoint: "started" }), renderDocument, now: NOW })).toEqual({ status: "applied" });
  });

  it("une heure d'appareil folle (avant 2020, ou plus d'un jour dans le futur) est refusée", async () => {
    const organizationId = await organization();
    const w = await weekend(organizationId);
    const now = new Date("2027-06-12T14:00:00Z");
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "checkpoint", itemId: w.items.ceremony.id, checkpoint: "started", deviceAt: "2019-01-01T00:00:00Z" }), renderDocument, now })).toEqual({ status: "rejected", reason: "time" });
    expect(await applyDayAction({ organizationId, eventId: w.eventId, userId: camille, action: action({ kind: "checkpoint", itemId: w.items.ceremony.id, checkpoint: "started", deviceAt: "2027-06-14T14:00:00Z" }), renderDocument, now })).toEqual({ status: "rejected", reason: "time" });
  });
});
