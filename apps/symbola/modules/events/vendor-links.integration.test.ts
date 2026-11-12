// Lot 26b (UX-11, POR-01, SEC-14 ; ADR 0053, décisions D6 et D9) — lien du
// prestataire et code à usage unique, contre un vrai PostgreSQL (RLS) et
// Mailpit, par la porte d'entrée du module. Tests d'abus (CLAUDE.md § 2.11,
// SC-S3) : le lien d'un prestataire n'ouvre ni le portail du client, ni le
// budget, ni les devis des autres ; un code ne sert qu'une fois.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventLinkCodes, eventLinkSessions } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventLinkRights } from "@symbola/contracts";
import { getLinkBudgetView, LinkBudgetAccessDeniedError } from "@/modules/budget/service";
import {
  addEventPlace,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  EventLinkInvalidError,
  getLinkEventView,
  getLinkSharedRibVendorId,
  getLinkVendorOptions,
  getLinkVendorQuoteFile,
  getVendorLinkView,
  LinkAccessDeniedError,
  listEventLinks,
  openEventLink,
  removeVendorCandidate,
  resolveLinkSession,
  revokeEventLink,
  setLinkTaskDone,
  addEventTask,
  updateEventLink,
  verifyLinkCode,
} from "./service";

const plannerId = randomUUID();
const MAILPIT_API = "http://localhost:8025/api/v1";
const EVERYTHING: EventLinkRights = { rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"], budgetScope: "all", sharedSlotIds: [] };
const MINUTE = 60_000;

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization() {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

// Mariage de Léa et Maxime : un traiteur et un photographe consultés, un lieu,
// une ligne du programme pour chacun (celle du traiteur avec une note interne).
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
  const caterer = await addEventVendorSlot(organizationId, created.id, "Traiteur");
  const photographer = await addEventVendorSlot(organizationId, created.id, "Photographe");
  const karim = await addVendorCandidate({ organizationId, eventId: created.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
  const studio = await addVendorCandidate({ organizationId, eventId: created.id, vendorSlotId: photographer.id, vendorName: "Studio Lumière" });
  const place = await addEventPlace(organizationId, created.id, { label: "Domaine des Tilleuls", address: "1 allée des Tilleuls, Lyon" });
  const cocktail = await addProgramItem(organizationId, created.id, {
    startTime: "18:00",
    endTime: "19:30",
    label: "Cocktail",
    location: "Terrasse",
    internalNote: "Prévoir vingt bouteilles de plus",
    vendorSlotIds: [caterer.id],
    freeParticipants: [],
  });
  await addProgramItem(organizationId, created.id, { startTime: "16:00", label: "Photos de groupe", vendorSlotIds: [photographer.id], freeParticipants: ["Témoins"] });
  return { eventId: created.id, karimId: karim.id, studioId: studio.id, placeId: place.id, cocktailId: cocktail.id };
}

async function vendorLink(organizationId: string, eventId: string, vendorCandidateId: string, options: { otpRequired?: boolean } = {}) {
  const email = `karim-${randomUUID()}@example.test`;
  const delivery = await createEventLink({
    organizationId,
    eventId,
    createdByUserId: plannerId,
    audience: "vendor",
    vendorCandidateId,
    locale: "fr",
    // Les droits demandés sont écartés : un lien de prestataire n'ouvre aucune rubrique.
    link: { personName: "Karim", email, rights: EVERYTHING, otpRequired: options.otpRequired ?? false },
  });
  return { ...delivery, email, token: delivery.url.split("#")[1]! };
}

async function opened(token: string) {
  const result = await openEventLink(token);
  if (result.outcome !== "opened") throw new Error("ouverture attendue");
  return result.sessionToken;
}

// Le code est dans l'objet de l'e-mail ; attend le count-ième e-mail reçu.
async function codeSentTo(email: string, count: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    const codes = messages.map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).filter((code): code is string => Boolean(code));
    if (codes.length >= count) return codes[0]!;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("aucun code reçu");
}

function rows<T>(organizationId: string, fn: Parameters<typeof withOrganization<T>>[2]) {
  return withDb((db) => withOrganization(db, organizationId, fn));
}

describe("UX-11, lot 26b — Lien du prestataire (décision D9)", () => {
  it("le lien désigne un prestataire de l'événement, n'ouvre aucune rubrique et vaut 7 jours après l'événement", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link, url } = await vendorLink(organizationId, eventId, karimId);
    expect(url).toMatch(new RegExp(`/lien#${organizationId}\\.[A-Za-z0-9_-]{43}$`));
    expect(link).toMatchObject({
      audience: "vendor",
      vendorCandidateId: karimId,
      eventClientId: null,
      rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] },
      expiresOn: "2027-06-19",
      otpRequired: false,
    });
    const access = await resolveLinkSession(await opened(url.split("#")[1]!));
    expect(access).toMatchObject({ audience: "vendor", vendorCandidateId: karimId, eventId });
  });

  it("sans prestataire, avec celui d'un autre événement, ou pour un invité : refusé", async () => {
    const organizationId = await organization();
    const { eventId } = await wedding(organizationId);
    const other = await wedding(organizationId);
    const base = { organizationId, eventId, createdByUserId: plannerId, locale: "fr" as const, link: { personName: "Karim", email: "karim@example.test", rights: EVERYTHING } };
    await expect(createEventLink({ ...base, audience: "vendor" })).rejects.toMatchObject({ reason: "vendor" });
    await expect(createEventLink({ ...base, audience: "vendor", vendorCandidateId: other.karimId })).rejects.toBeInstanceOf(EventLinkInvalidError);
    await expect(createEventLink({ ...base, audience: "guest" })).rejects.toMatchObject({ reason: "audience" });
  });

  it("l'espace montre prénoms, date, lieux et ses seules lignes du programme, sans note interne", async () => {
    const organizationId = await organization();
    const { eventId, karimId, placeId, cocktailId } = await wedding(organizationId);
    const { link } = await vendorLink(organizationId, eventId, karimId);
    const view = await getVendorLinkView(organizationId, link.id);
    expect(view).toEqual({
      vendorName: "Traiteur Karim",
      slotLabel: "Traiteur",
      clientFirstNames: ["Léa", "Maxime"],
      eventDate: "2027-06-12",
      places: [{ id: placeId, label: "Domaine des Tilleuls", address: "1 allée des Tilleuls, Lyon" }],
      programItems: [{ id: cocktailId, startTime: "18:00", endTime: "19:30", label: "Cocktail", location: "Terrasse" }],
    });
    const text = JSON.stringify(view);
    for (const hidden of ["Prévoir", "Studio Lumière", "Photos de groupe", "Témoins", "Martin", "Durand"]) expect(text).not.toContain(hidden);
  });

  it("modifier le lien ne lui ouvre aucune rubrique ; la case du code se règle", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link } = await vendorLink(organizationId, eventId, karimId);
    const updated = await updateEventLink(organizationId, link.id, { personName: "Karim B.", email: link.email, rights: EVERYTHING, otpRequired: true });
    expect(updated).toMatchObject({ personName: "Karim B.", rights: { rubrics: [] }, otpRequired: true, vendorCandidateId: karimId });
  });

  it("retirer le prestataire de l'événement retire son lien et coupe sa session", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link, token } = await vendorLink(organizationId, eventId, karimId);
    const sessionToken = await opened(token);
    await removeVendorCandidate(organizationId, karimId);
    expect((await listEventLinks(organizationId, eventId)).map((item) => item.id)).not.toContain(link.id);
    expect(await resolveLinkSession(sessionToken)).toBeNull();
  });
});

describe("SC-S3 — Le lien d'un prestataire n'ouvre ni le portail, ni le budget, ni les devis des autres", () => {
  it("chaque service du portail refuse le lien d'un prestataire comme un lien inexistant", async () => {
    const organizationId = await organization();
    const { eventId, karimId, studioId } = await wedding(organizationId);
    const { link } = await vendorLink(organizationId, eventId, karimId);
    const task = await addEventTask(organizationId, eventId, { label: "Choisir le menu", dueDate: "2027-03-01", responsible: "clients" });
    await expect(getLinkEventView(organizationId, link.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkVendorOptions(organizationId, link.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkVendorQuoteFile(organizationId, link.id, studioId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkSharedRibVendorId(organizationId, link.id, studioId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(setLinkTaskDone(organizationId, link.id, task.id, true)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkBudgetView(organizationId, link.id)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
  });

  it("à l'inverse, le lien d'un client n'ouvre pas l'espace d'un prestataire", async () => {
    const organizationId = await organization();
    const { eventId } = await wedding(organizationId);
    const client = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: "lea@example.test", rights: EVERYTHING } });
    await expect(getVendorLinkView(organizationId, client.link.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("le lien d'une autre organisation n'ouvre rien ici (RLS)", async () => {
    const organizationId = await organization();
    const intruder = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link } = await vendorLink(organizationId, eventId, karimId);
    await expect(getVendorLinkView(intruder, link.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });
});

describe("POR-01, lot 26b — Code à usage unique à l'ouverture (décision D6)", () => {
  it("sans le code, pas de session ; le bon code l'ouvre une seule fois, rejoué il est refusé", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link, token, email } = await vendorLink(organizationId, eventId, karimId, { otpRequired: true });
    const sentAt = new Date();
    expect(await openEventLink(token, sentAt)).toEqual({ outcome: "code_required", emailHint: `k•••@example.test`, codeSent: true });
    expect(await rows(organizationId, (tx) => tx.select().from(eventLinkSessions).where(eq(eventLinkSessions.linkId, link.id)))).toEqual([]);
    const code = await codeSentTo(email, 1);
    const [stored] = await rows(organizationId, (tx) => tx.select().from(eventLinkCodes).where(eq(eventLinkCodes.linkId, link.id)));
    expect(stored!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.codeHash).not.toContain(code);

    const result = await verifyLinkCode(token, code, new Date(sentAt.getTime() + MINUTE));
    expect(result).toMatchObject({ outcome: "opened", audience: "vendor" });
    if (result.outcome !== "opened") throw new Error("ouverture attendue");
    expect(await resolveLinkSession(result.sessionToken)).toMatchObject({ linkId: link.id });
    expect(await verifyLinkCode(token, code, new Date(sentAt.getTime() + 2 * MINUTE))).toEqual({ outcome: "code_expired" });
  });

  it("expiré à dix minutes (horloge simulée)", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { token, email } = await vendorLink(organizationId, eventId, karimId, { otpRequired: true });
    const sentAt = new Date();
    await openEventLink(token, sentAt);
    const code = await codeSentTo(email, 1);
    expect(await verifyLinkCode(token, code, new Date(sentAt.getTime() + 10 * MINUTE))).toEqual({ outcome: "code_expired" });

    const again = new Date(sentAt.getTime() + 11 * MINUTE);
    await openEventLink(token, again);
    const fresh = await codeSentTo(email, 2);
    expect(await verifyLinkCode(token, fresh, new Date(again.getTime() + 10 * MINUTE - 1000))).toMatchObject({ outcome: "opened" });
  });

  it("cinq essais : le cinquième échec bloque le code, même le bon ne l'ouvre plus", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { token, email } = await vendorLink(organizationId, eventId, karimId, { otpRequired: true });
    await openEventLink(token);
    const code = await codeSentTo(email, 1);
    const wrong = code === "000000" ? "111111" : "000000";
    for (const attemptsLeft of [4, 3, 2, 1]) expect(await verifyLinkCode(token, wrong)).toEqual({ outcome: "wrong_code", attemptsLeft });
    expect(await verifyLinkCode(token, "pas un code")).toEqual({ outcome: "code_expired" });
    expect(await verifyLinkCode(token, code)).toEqual({ outcome: "code_expired" });
    const journal = await rows(organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)));
    const locked = journal.filter((entry) => entry.action === "events.link.code_locked");
    expect(locked).toHaveLength(1);
    // SEC-20 : le journal ne garde ni code ni e-mail.
    expect(JSON.stringify(journal)).not.toContain(code);
    expect(JSON.stringify(journal)).not.toContain(email);
  });

  it("un nouveau code remplace l'ancien ; au-delà de cinq codes dans l'heure, aucun e-mail ne part", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { token, email } = await vendorLink(organizationId, eventId, karimId, { otpRequired: true });
    const start = new Date();
    await openEventLink(token, start);
    const first = await codeSentTo(email, 1);
    await openEventLink(token, new Date(start.getTime() + MINUTE));
    const second = await codeSentTo(email, 2);
    if (first !== second) expect(await verifyLinkCode(token, first, new Date(start.getTime() + 2 * MINUTE))).toMatchObject({ outcome: "wrong_code" });
    for (const minute of [3, 4, 5]) expect(await openEventLink(token, new Date(start.getTime() + minute * MINUTE))).toMatchObject({ codeSent: true });
    expect(await openEventLink(token, new Date(start.getTime() + 6 * MINUTE))).toMatchObject({ outcome: "code_required", codeSent: false });
    expect(await openEventLink(token, new Date(start.getTime() + 61 * MINUTE))).toMatchObject({ codeSent: true });
  });

  it("un lien retiré n'ouvre plus rien, et ses codes disparaissent", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { link, token, email } = await vendorLink(organizationId, eventId, karimId, { otpRequired: true });
    await openEventLink(token);
    const code = await codeSentTo(email, 1);
    await revokeEventLink(organizationId, link.id);
    expect(await verifyLinkCode(token, code)).toEqual({ outcome: "invalid" });
    expect(await rows(organizationId, (tx) => tx.select().from(eventLinkCodes).where(eq(eventLinkCodes.linkId, link.id)))).toEqual([]);
  });

  it("un lien sans demande de code s'ouvre directement et refuse la saisie d'un code", async () => {
    const organizationId = await organization();
    const { eventId, karimId } = await wedding(organizationId);
    const { token } = await vendorLink(organizationId, eventId, karimId);
    expect(await verifyLinkCode(token, "123456")).toEqual({ outcome: "invalid" });
    expect(await openEventLink(token)).toMatchObject({ outcome: "opened" });
  });
});
