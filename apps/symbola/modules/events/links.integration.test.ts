// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17 ; ADR 0053) — liens
// personnels des tiers, contre un vrai PostgreSQL (RLS, ADR 0012) et Mailpit,
// par la porte d'entrée du module. Tests d'abus obligatoires (CLAUDE.md § 2.11) :
// un lien n'ouvre que son événement et ses droits ; une autre organisation,
// un lien retiré ou expiré n'ouvrent rien.
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventLinks, eventLinkSessions } from "@symbola/db/schema/events";
import { memberships } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventLinkRights } from "@symbola/contracts";
import {
  addEventTask,
  addProgramItem,
  changeEventDate,
  changeEventStatus,
  createEventLink,
  createLossReason,
  createProspect,
  createProspectSource,
  DemoEventRestrictionError,
  EventLinkInvalidError,
  getLinkEventView,
  getLinkVendorOptions,
  LinkAccessDeniedError,
  listEventActivity,
  listEventLinks,
  listPendingLinkRenewals,
  openEventLink,
  renewEventLink,
  requestLinkRenewal,
  resolveLinkSession,
  revokeEventLink,
  setLinkTaskDone,
  startEventsTrial,
  updateEventLink,
} from "./service";

const plannerId = randomUUID();
const EVERYTHING: EventLinkRights = { rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"], budgetScope: "all", sharedSlotIds: [] };
const NOTHING: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };

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

async function event(organizationId: string, eventDate: string | null = "2027-06-12") {
  const source = await createProspectSource(organizationId, "Salon");
  const created = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate });
  return created.id;
}

async function link(organizationId: string, eventId: string, rights: EventLinkRights = EVERYTHING, personName = "Léa Martin") {
  const delivery = await createEventLink({
    organizationId,
    eventId,
    createdByUserId: plannerId,
    audience: "client",
    locale: "fr",
    link: { personName, email: `lien-${randomUUID()}@example.test`, rights },
  });
  return { ...delivery, token: delivery.url.split("#")[1]! };
}

async function opened(token: string, now?: Date) {
  const result = await openEventLink(token, now);
  if (result.outcome !== "opened") throw new Error("ouverture attendue");
  return result.sessionToken;
}

function journal(organizationId: string) {
  return withDb((db) =>
    withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)).orderBy(auditEntries.occurredAt)),
  );
}

describe("UX-11 — Tiers sans compte ni mot de passe", () => {
  it("un lien personnel s'envoie et s'ouvre sans créer de compte", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { url, token, link: created } = await link(organizationId, eventId);
    expect(url).toMatch(new RegExp(`/lien#${organizationId}\\.[A-Za-z0-9_-]{43}$`));
    expect(created).toMatchObject({ audience: "client", personName: "Léa Martin", status: "active", expiresOn: "2027-07-12" });
    const sessionToken = await opened(token);
    expect(await resolveLinkSession(sessionToken)).toMatchObject({ organizationId, eventId, linkId: created.id, personName: "Léa Martin" });
    // Aucun compte n'entre dans l'organisation pour un lien (lot 33 : par adhésion).
    expect(await withDb((db) => db.select().from(memberships).where(eq(memberships.organizationId, organizationId)))).toEqual([]);
  });

  // Lot 26b : le lien d'un prestataire se crée (vendor-links.integration.test.ts).
  it("le lien d'un invité ne se crée pas encore (lot 49)", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    await expect(
      createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "guest", locale: "fr", link: { personName: "Karim", email: "karim@example.test", rights: NOTHING } }),
    ).rejects.toBeInstanceOf(EventLinkInvalidError);
  });

  it("aucun lien sur un événement d'essai (jamais d'e-mail à un tiers)", async () => {
    const organizationId = await organization();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr" });
    await expect(link(organizationId, trial.eventId)).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });
});

describe("SEC-14 — Jeton de lien personnel haché, limité, révocable", () => {
  it("le jeton (256 bits) n'est stocké que haché, ni dans le lien ni dans sa session", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { token, link: created } = await link(organizationId, eventId);
    const secret = token.split(".")[1]!;
    expect(Buffer.from(secret, "base64url")).toHaveLength(32);
    const sessionToken = await opened(token);
    const [row] = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(eventLinks).where(eq(eventLinks.id, created.id))));
    expect(row!.tokenHash).toBe(createHash("sha256").update(secret).digest("hex"));
    const sessions = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(eventLinkSessions).where(eq(eventLinkSessions.linkId, created.id))));
    const stored = JSON.stringify({ row, sessions });
    expect(stored).not.toContain(secret);
    expect(stored).not.toContain(sessionToken.split(".")[1]!);
  });

  it("le jeton d'un événement est refusé sur un autre : la vue et les coches restent dans l'événement du lien", async () => {
    const organizationId = await organization();
    const eventA = await event(organizationId);
    const eventB = await event(organizationId);
    const otherTask = await addEventTask(organizationId, eventB, { label: "Tâche d'un autre couple", dueDate: "2027-03-01", responsible: "clients" });
    const { link: created } = await link(organizationId, eventA);
    expect((await getLinkEventView(organizationId, created.id)).event.id).toBe(eventA);
    await expect(setLinkTaskDone(organizationId, created.id, otherTask.id, true)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("le jeton d'une organisation présenté sous une autre n'ouvre rien (RLS)", async () => {
    const organizationA = await organization();
    const organizationB = await organization();
    const { token } = await link(organizationA, await event(organizationA));
    const forged = `${organizationB}.${token.split(".")[1]}`;
    expect(await openEventLink(forged)).toEqual({ outcome: "invalid" });
    expect(await openEventLink(`${organizationA}.${"x".repeat(43)}`)).toEqual({ outcome: "invalid" });
    expect(await openEventLink("pas-un-jeton")).toEqual({ outcome: "invalid" });
  });

  it("retirer un lien coupe aussitôt la session ouverte et le jeton", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { token, link: created } = await link(organizationId, eventId);
    const sessionToken = await opened(token);
    await revokeEventLink(organizationId, created.id);
    expect(await resolveLinkSession(sessionToken)).toBeNull();
    expect(await openEventLink(token)).toEqual({ outcome: "invalid" });
    expect((await listEventLinks(organizationId, eventId))[0]).toMatchObject({ status: "revoked" });
  });

  it("renouveler : l'ancien jeton et ses sessions cessent, le nouveau ouvre", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { token, link: created } = await link(organizationId, eventId);
    const oldSession = await opened(token);
    const renewed = await renewEventLink({ organizationId, linkId: created.id, renewedByUserId: plannerId, locale: "fr" });
    expect(await resolveLinkSession(oldSession)).toBeNull();
    expect(await openEventLink(token)).toEqual({ outcome: "invalid" });
    expect(await resolveLinkSession(await opened(renewed.url.split("#")[1]!))).toMatchObject({ linkId: created.id });
  });

  it("un événement perdu n'ouvre plus ses liens", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { token } = await link(organizationId, eventId);
    const sessionToken = await opened(token);
    const reason = await createLossReason(organizationId, "Budget", false);
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "lost", lossReasonId: reason.id });
    expect(await resolveLinkSession(sessionToken)).toBeNull();
    expect(await openEventLink(token)).toEqual({ outcome: "invalid" });
  });
});

describe("SEC-15 — Expiration des liens personnels", () => {
  it("par défaut 30 jours après l'événement pour un client, jusqu'à minuit à Paris (heure d'été)", async () => {
    const organizationId = await organization();
    const { token, link: created } = await link(organizationId, await event(organizationId, "2027-06-12"));
    expect(created.expiresOn).toBe("2027-07-12");
    // 12/07/2027 à 23 h 59 à Paris (UTC+2), puis minuit passé.
    expect((await openEventLink(token, new Date("2027-07-12T21:59:00Z"))).outcome).toBe("opened");
    expect(await openEventLink(token, new Date("2027-07-12T22:00:01Z"))).toEqual({ outcome: "invalid" });
  });

  it("la session s'arrête avec le lien, même ouverte la veille (heure d'hiver)", async () => {
    const organizationId = await organization();
    const { token } = await link(organizationId, await event(organizationId, "2027-12-01"));
    const sessionToken = await opened(token, new Date("2027-12-31T12:00:00Z"));
    expect(await resolveLinkSession(sessionToken, new Date("2027-12-31T22:59:00Z"))).not.toBeNull();
    // Minuit à Paris en hiver (UTC+1) : 23 h UTC.
    expect(await resolveLinkSession(sessionToken, new Date("2027-12-31T23:00:01Z"))).toBeNull();
  });

  it("une date choisie l'emporte ; un report recalcule l'expiration ; sans date, 180 jours après la création", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId, null);
    const { link: created } = await link(organizationId, eventId);
    expect(created.customExpiresOn).toBeNull();
    expect(created.status).toBe("active");
    await changeEventDate(organizationId, eventId, "2027-09-04");
    expect((await listEventLinks(organizationId, eventId))[0]!.expiresOn).toBe("2027-10-04");
    const updated = await updateEventLink(organizationId, created.id, { personName: "Léa Martin", email: created.email, rights: EVERYTHING, customExpiresOn: "2027-08-31" });
    expect(updated).toMatchObject({ customExpiresOn: "2027-08-31", expiresOn: "2027-08-31" });
  });

  it("un lien expiré : la demande est notée et la planner prévenue ; rien pour un jeton inconnu", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId, "2025-01-10");
    const { token, link: created } = await link(organizationId, eventId);
    expect(created.status).toBe("expired");
    expect(await openEventLink(token)).toEqual({ outcome: "invalid" });
    await requestLinkRenewal(token);
    await requestLinkRenewal(token);
    await requestLinkRenewal(`${organizationId}.${"y".repeat(43)}`);
    expect((await listEventLinks(organizationId, eventId))[0]!.renewalRequestedAt).not.toBeNull();
    expect((await listPendingLinkRenewals(organizationId)).map((renewal) => renewal.linkId)).toEqual([created.id]);
    expect((await journal(organizationId)).filter((entry) => entry.action === "events.link.renewal_requested")).toHaveLength(1);
  });

  it("renouveler un lien expiré le prolonge du délai de son public et efface la demande", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId, "2025-01-10");
    const { token, link: created } = await link(organizationId, eventId);
    await requestLinkRenewal(token);
    const renewed = await renewEventLink({ organizationId, linkId: created.id, renewedByUserId: plannerId, locale: "fr" });
    expect(renewed.link).toMatchObject({ status: "active", renewalRequestedAt: null });
    expect((await openEventLink(renewed.url.split("#")[1]!)).outcome).toBe("opened");
    expect(await listPendingLinkRenewals(organizationId)).toEqual([]);
  });
});

describe("POR-10 — Rien n'est partagé par défaut", () => {
  it("un lien sans rubrique ne voit ni rétroplanning ni programme ; le service refuse les rubriques fermées", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const task = await addEventTask(organizationId, eventId, { label: "Choisir les alliances", dueDate: "2027-03-10", responsible: "clients" });
    const { link: created } = await link(organizationId, eventId, NOTHING, "Bernard Martin");
    expect(await getLinkEventView(organizationId, created.id)).toMatchObject({ tasks: null, program: null });
    await expect(setLinkTaskDone(organizationId, created.id, task.id, true)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkVendorOptions(organizationId, created.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("les rubriques inconnues sont écartées, les catégories d'un autre événement refusées", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { link: created } = await link(organizationId, eventId, { rubrics: ["budget", "tout" as never], budgetScope: "all", sharedSlotIds: [] });
    expect(created.rights.rubrics).toEqual(["budget"]);
    await expect(
      updateEventLink(organizationId, created.id, { personName: "Léa", email: created.email, rights: { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [randomUUID()] } }),
    ).rejects.toBeInstanceOf(EventLinkInvalidError);
  });
});

describe("PRD-EVT-06, lot 26a — Ce que voit le tiers", () => {
  it("rétroplanning et programme sans note interne ; il ne coche que ses tâches, et la coche porte son nom", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const coupleTask = await addEventTask(organizationId, eventId, { label: "Choisir les alliances", dueDate: "2027-03-10", responsible: "clients" });
    const plannerTask = await addEventTask(organizationId, eventId, { label: "Confirmer le traiteur", dueDate: "2027-05-01", responsible: "planner" });
    await addProgramItem(organizationId, eventId, { startTime: "15:00", label: "Cérémonie", internalNote: "Le témoin oublie toujours les alliances", vendorSlotIds: [], freeParticipants: ["Officiant"] });
    const { link: created } = await link(organizationId, eventId);

    const view = await getLinkEventView(organizationId, created.id);
    expect(view.tasks!.map((task) => task.label)).toEqual(["Choisir les alliances", "Confirmer le traiteur"]);
    expect(view.program!.items).toMatchObject([{ label: "Cérémonie", internalNote: null }]);
    expect(JSON.stringify(view)).not.toContain("oublie toujours");

    await setLinkTaskDone(organizationId, created.id, coupleTask.id, true);
    await expect(setLinkTaskDone(organizationId, created.id, plannerTask.id, true)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect((await listEventActivity(organizationId, eventId))[0]).toMatchObject({ kind: "task_done", taskLabel: "Choisir les alliances", actorName: "Léa Martin" });
  });
});

describe("SEC-17, SEC-19 — Journal des liens, sans jeton ni donnée personnelle", () => {
  it("création, ouverture et retrait au journal de l'organisation, le lien pour auteur de l'ouverture", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const { token, link: created } = await link(organizationId, eventId);
    await opened(token);
    await revokeEventLink(organizationId, created.id);
    const entries = (await journal(organizationId)).filter((entry) => entry.action.startsWith("events.link."));
    expect(entries.map((entry) => entry.action)).toEqual(["events.link.created", "events.link.opened", "events.link.revoked"]);
    expect(entries[1]).toMatchObject({ actorKind: "link", actorId: created.id, category: "connexion", objectId: eventId });
    const stored = JSON.stringify(entries);
    expect(stored).not.toContain(token.split(".")[1]!);
    expect(stored).not.toContain(created.email);
    expect(stored).not.toContain("Léa");
  });

  it("une session ne se lit pas sous une autre organisation", async () => {
    const organizationA = await organization();
    const organizationB = await organization();
    const { token } = await link(organizationA, await event(organizationA));
    const sessionToken = await opened(token);
    expect(await resolveLinkSession(`${organizationB}.${sessionToken.split(".")[1]}`)).toBeNull();
    const visibleInB = await withDb((db) => withOrganization(db, organizationB, (tx) => tx.select().from(eventLinkSessions).where(and(eq(eventLinkSessions.organizationId, organizationA)))));
    expect(visibleInB).toEqual([]);
  });
});
