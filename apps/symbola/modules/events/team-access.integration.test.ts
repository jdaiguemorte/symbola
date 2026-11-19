// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) — équipe d'un évènement et renfort du jour J contre un vrai
// PostgreSQL (RLS) et un vrai Mailpit, par la porte d'entrée du module events. Horloge simulée pour les
// dates du lien du renfort (veille, lendemain, passage de minuit à Paris).
// Tests d'abus (CLAUDE.md § 2.11, SEC-36) : un lien de renfort n'ouvre ni un autre évènement ni une autre
// organisation ; retiré ou expiré, il est refusé, y compris pour une action hors ligne rejouée ; il ne
// valide pas de décalage ; une Planner hors de l'équipe ne voit pas l'évènement quand le réglage est coupé.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { DayAction } from "@symbola/contracts";
import {
  addProgramItem,
  applyDayAction,
  canViewEvent,
  createDayHelper,
  createProspect,
  createProspectSource,
  dayHelperAccess,
  dayHelperValidFrom,
  EventTeamMemberInvalidError,
  getDayState,
  listDayHelpers,
  listEventLinks,
  listEventLeads,
  listEventTeam,
  openEventLink,
  removeMemberFromEvents,
  revokeDayHelper,
  setEventTeamMember,
  verifyLinkCode,
  visibleEventIds,
} from "./service";

const MAILPIT_API = "http://localhost:8025/api/v1";
// Mariage le samedi 12 juin 2027 : le lien du renfort vaut du vendredi 11 à 0 h au dimanche 13 à minuit (Paris, été).
const EVENT_DATE = "2027-06-12";
const EVE_START = new Date("2027-06-10T22:00:00Z");
const AFTER_END = new Date("2027-06-13T22:00:00Z");
const DAY = new Date("2027-06-12T15:00:00Z");

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function agency() {
  return withDb(async (db) => {
    const organization = await createOrganization(db, `Agence ${randomUUID().slice(0, 8)}`);
    const make = async (role: "owner" | "member" | "accountant") => (await createUser(db, { organizationId: organization.id, email: `${role}-${randomUUID()}@example.test`, role })).id;
    return { organizationId: organization.id, owner: await make("owner"), lea: await make("member"), sam: await make("member"), accountant: await make("accountant") };
  });
}

async function wedding(organizationId: string, createdByUserId: string, eventDate: string | null = EVENT_DATE) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate });
  return event.id;
}

async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    const code = messages.map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("aucun code reçu");
}

async function helperOf(organizationId: string, eventId: string, byUserId: string) {
  const email = `hugo-${randomUUID()}@example.test`;
  const { helper, url } = await createDayHelper({ organizationId, eventId, helper: { personName: "Hugo", email, phone: "06 12 34 56 78" }, locale: "fr", byUserId });
  return { helper, email, token: url.split("#")[1]! };
}

// Ouvre le lien du renfort avec son code, à l'instant donné ; la session de lien.
async function openHelper(token: string, email: string, now: Date): Promise<string> {
  const opened = await openEventLink(token, now);
  if (opened.outcome !== "code_required") throw new Error(`code attendu, reçu ${opened.outcome}`);
  const verified = await verifyLinkCode(token, await codeSentTo(email), now);
  if (verified.outcome !== "opened") throw new Error(`session attendue, reçu ${verified.outcome}`);
  expect(verified).toMatchObject({ audience: "day_helper" });
  return verified.sessionToken;
}

function point(itemId: string): Exclude<DayAction, { kind: "handover" }> {
  return { kind: "checkpoint", actionId: randomUUID(), deviceAt: "2027-06-12T14:20:00Z", itemId, checkpoint: "started" } as Exclude<DayAction, { kind: "handover" }>;
}

describe("EVT-06 — Équipe et droits par évènement", () => {
  it("un seul planner principal : en nommer un autre fait du premier un assistant ; il reçoit les alertes (lot 53)", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    await setEventTeamMember({ organizationId: a.organizationId, eventId, userId: a.lea, role: "lead", byUserId: a.owner });
    await setEventTeamMember({ organizationId: a.organizationId, eventId, userId: a.sam, role: "lead", byUserId: a.owner });
    const team = await listEventTeam(a.organizationId, eventId);
    expect(team.find((entry) => entry.userId === a.sam)?.role).toBe("lead");
    expect(team.find((entry) => entry.userId === a.lea)?.role).toBe("assistant");
    expect((await listEventLeads(a.organizationId, [eventId])).get(eventId)).toBe(a.sam);
  });

  it("ni le Comptable, ni un compte d'une autre organisation n'entrent dans une équipe", async () => {
    const a = await agency();
    const b = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    await expect(setEventTeamMember({ organizationId: a.organizationId, eventId, userId: a.accountant, role: "assistant", byUserId: a.owner })).rejects.toBeInstanceOf(EventTeamMemberInvalidError);
    await expect(setEventTeamMember({ organizationId: a.organizationId, eventId, userId: b.lea, role: "assistant", byUserId: a.owner })).rejects.toBeInstanceOf(EventTeamMemberInvalidError);
    // L'évènement d'une autre organisation répond comme inexistant (RLS).
    const other = await wedding(b.organizationId, b.owner);
    await expect(setEventTeamMember({ organizationId: a.organizationId, eventId: other, userId: a.lea, role: "assistant", byUserId: a.owner })).rejects.toThrow();
    expect(await listEventTeam(a.organizationId, other)).toEqual([]);
  });

  it("D2 — réglage coupé : une Planner hors de l'équipe ne voit pas l'évènement ; dans l'équipe, si ; la Propriétaire voit tout", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    await setEventTeamMember({ organizationId: a.organizationId, eventId, userId: a.lea, role: "assistant", byUserId: a.owner });
    const off = { allPlannersSeeAll: false };
    expect(await canViewEvent(a.organizationId, { userId: a.sam, role: "member", ...off }, eventId)).toBe(false);
    expect(await canViewEvent(a.organizationId, { userId: a.lea, role: "member", ...off }, eventId)).toBe(true);
    expect(await canViewEvent(a.organizationId, { userId: a.owner, role: "owner", ...off }, eventId)).toBe(true);
    expect([...(await visibleEventIds(a.organizationId, { userId: a.sam, role: "member", ...off }))!]).toEqual([]);
    // Activé (par défaut) : toutes les Planners voient tout.
    expect(await canViewEvent(a.organizationId, { userId: a.sam, role: "member", allPlannersSeeAll: true }, eventId)).toBe(true);
    expect(await visibleEventIds(a.organizationId, { userId: a.sam, role: "member", allPlannersSeeAll: true })).toBeNull();
  });

  it("HUB-04 — un membre retiré de l'organisation quitte toutes ses équipes d'évènement", async () => {
    const a = await agency();
    const first = await wedding(a.organizationId, a.owner);
    const second = await wedding(a.organizationId, a.owner);
    for (const eventId of [first, second]) await setEventTeamMember({ organizationId: a.organizationId, eventId, userId: a.lea, role: "assistant", byUserId: a.owner });
    expect(await removeMemberFromEvents(a.organizationId, a.lea)).toBe(2);
    expect(await listEventTeam(a.organizationId, first)).toEqual([]);
  });
});

describe("EVT-06 (D3) — Renfort du jour J par lien personnel", () => {
  it("le lien part par e-mail, sans compte ; il n'apparaît pas parmi les liens du portail", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const { helper } = await helperOf(a.organizationId, eventId, a.owner);
    expect(helper).toMatchObject({ personName: "Hugo", phone: "06 12 34 56 78", expiresOn: "2027-06-13", validFrom: EVE_START.toISOString() });
    expect(dayHelperValidFrom(EVENT_DATE).toISOString()).toBe(EVE_START.toISOString());
    expect(await listDayHelpers(a.organizationId, eventId)).toHaveLength(1);
    expect((await listEventLinks(a.organizationId, eventId)).map((link) => link.audience)).not.toContain("day_helper");
  });

  it("valable du matin de la veille au lendemain, avec un code à l'ouverture (horloge simulée, heure de Paris)", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const { token, email } = await helperOf(a.organizationId, eventId, a.owner);
    // L'avant-veille au soir : comme un lien inconnu.
    expect(await openEventLink(token, new Date(EVE_START.getTime() - 1000))).toEqual({ outcome: "invalid" });
    const session = await openHelper(token, email, new Date(EVE_START.getTime() + 1000));
    expect(await dayHelperAccess(session, eventId, DAY)).toMatchObject({ audience: "day_helper", eventId, personName: "Hugo" });
    // Le surlendemain à minuit : plus rien.
    expect(await dayHelperAccess(session, eventId, new Date(AFTER_END.getTime() - 1000))).not.toBeNull();
    expect(await dayHelperAccess(session, eventId, new Date(AFTER_END.getTime() + 1000))).toBeNull();
  });

  it("un évènement sans date n'a pas de renfort", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner, null);
    await expect(helperOf(a.organizationId, eventId, a.owner)).rejects.toMatchObject({ reason: "date" });
  });

  it("n'ouvre que le mode Jour J de son évènement : un autre évènement, une autre organisation répondent comme inexistants", async () => {
    const a = await agency();
    const b = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const sibling = await wedding(a.organizationId, a.owner);
    const elsewhere = await wedding(b.organizationId, b.owner);
    const { token, email } = await helperOf(a.organizationId, eventId, a.owner);
    const session = await openHelper(token, email, DAY);
    expect(await dayHelperAccess(session, sibling, DAY)).toBeNull();
    expect(await dayHelperAccess(session, elsewhere, DAY)).toBeNull();
    expect(await dayHelperAccess(session, randomUUID(), DAY)).toBeNull();
    expect(await dayHelperAccess(undefined, eventId, DAY)).toBeNull();
  });

  it("ses actions sont signées par son lien : « pointé par Hugo, renfort » ; l'adresse des comptes de l'équipe ne lui est pas montrée", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const item = await addProgramItem(a.organizationId, eventId, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    const { helper } = await helperOf(a.organizationId, eventId, a.owner);
    expect(await applyDayAction({ organizationId: a.organizationId, eventId, userId: null, linkId: helper.linkId, action: point(item.id), now: DAY, renderDocument: async () => ({ filename: "p.pdf", content: new Uint8Array() }) })).toEqual({ status: "applied" });
    await applyDayAction({ organizationId: a.organizationId, eventId, userId: a.owner, action: { ...point(item.id), checkpoint: "finished" } as never, now: DAY, renderDocument: async () => ({ filename: "p.pdf", content: new Uint8Array() }) });
    const state = await getDayState(a.organizationId, eventId);
    expect(state!.checkpoints.find((checkpoint) => checkpoint.kind === "started")?.userId).toBe(helper.linkId);
    expect(state!.people).toEqual(expect.arrayContaining([{ id: helper.linkId, name: "Hugo", helper: true }]));
    const forHelper = await getDayState(a.organizationId, eventId, { forHelper: true });
    expect(forHelper!.people.find((person) => person.id === a.owner)?.name).toBe("");
  });

  it("un renfort ne valide pas de décalage du programme", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const item = await addProgramItem(a.organizationId, eventId, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    const { helper } = await helperOf(a.organizationId, eventId, a.owner);
    const shift = { kind: "shift", actionId: randomUUID(), deviceAt: "2027-06-12T14:20:00Z", lateItemId: item.id, keyMomentId: null, minutes: 15, itemIds: [item.id], vendorSlotIds: [] } as unknown as Exclude<DayAction, { kind: "handover" }>;
    expect(await applyDayAction({ organizationId: a.organizationId, eventId, userId: null, linkId: helper.linkId, action: shift, now: DAY, renderDocument: async () => ({ filename: "p.pdf", content: new Uint8Array() }) })).toEqual({ status: "rejected", reason: "scope" });
  });

  it("retiré, son lien est refusé aussitôt, y compris pour une action hors ligne rejouée", async () => {
    const a = await agency();
    const eventId = await wedding(a.organizationId, a.owner);
    const { token, email, helper } = await helperOf(a.organizationId, eventId, a.owner);
    const session = await openHelper(token, email, DAY);
    expect(await dayHelperAccess(session, eventId, DAY)).not.toBeNull();
    expect(await revokeDayHelper(a.organizationId, eventId, helper.linkId)).toBe(true);
    // La file de l'appareil est rejouée avec la session du lien : l'accès est refusé avant toute action.
    expect(await dayHelperAccess(session, eventId, DAY)).toBeNull();
    expect(await openEventLink(token, DAY)).toEqual({ outcome: "invalid" });
    expect((await listDayHelpers(a.organizationId, eventId, DAY))[0]!.status).toBe("revoked");
    // Le retrait d'un autre évènement ou d'un lien inconnu ne fait rien.
    expect(await revokeDayHelper(a.organizationId, randomUUID(), helper.linkId)).toBe(false);
  });
});
