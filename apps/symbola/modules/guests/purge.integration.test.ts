// Lot 49 — RGP-08 : purge programmée des données d'invités après l'évènement, annoncée sept jours
// avant, report unique et motivé ; elle efface aussi les exports stockés. Contre un vrai PostgreSQL,
// horloge simulée en heure de Paris (veille, jour même, passage à l'heure d'été). Opposition d'un
// invité (traitée aussitôt) et contrat privacy/v1 (effacement sans attendre la purge).
import { randomUUID } from "node:crypto";
import { eq, isNotNull, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditEntries } from "@symbola/db/schema/core";
import { dietConsents, diets, eventSettings, guests, households } from "@symbola/db/schema/guests";
import { jobs, organizationExports, privacyExports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { changeEventStatus } from "@/modules/events/service";
import {
  answerRsvp,
  getGuestPurgeSchedule,
  guestsPrivacy,
  listDietaryOptions,
  listGuestPurgeNotices,
  listHouseholds,
  listRecentOppositions,
  openRsvp,
  opposeAsGuest,
  postponeGuestPurge,
  PostponementInvalidError,
  runGuestPurge,
} from "./service";
import { household, linkFor, openResponses, readyOrganization, weddingEvent, withDb } from "./test-fixtures";

// Un foyer de deux personnes ; Jeanne a répondu (présente partout) et donné un régime, avec accord.
async function eventWithDiet(eventDate = "2027-06-12", withBrunch = true) {
  const org = await readyOrganization();
  const event = await weddingEvent(org.organizationId, org.ownerId, eventDate);
  if (!withBrunch) {
    const { removeKeyMoment } = await import("@/modules/events/service");
    await removeKeyMoment(org.organizationId, event.eventId, event.moments.brunch);
  }
  const closeOn = new Date(Date.parse(`${eventDate}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  await openResponses(org.organizationId, event.eventId, closeOn);
  const created = await household(org.organizationId, event.eventId, { people: [{ kind: "adult", firstName: "Jeanne", lastName: "Durand", email: `jeanne-${randomUUID()}@example.test` }, { kind: "adult", firstName: "Paul", lastName: "Durand" }] });
  const token = await linkFor(org.organizationId, event.eventId, created.people[0]!.id);
  const vegetarian = (await listDietaryOptions(org.organizationId, "fr")).find((option) => option.starterKey === "vegetarian")!.id;
  const opened = await openRsvp(token, "fr");
  if (opened.outcome === "invalid") throw new Error("lien refusé");
  const presence = opened.view.members.flatMap((person) => person.keyMomentIds.map((keyMomentId) => ({ guestId: person.id, keyMomentId, attending: true })));
  await answerRsvp(token, { presence, consent: true, dietOptionIds: [vegetarian], children: [] }, "fr");
  return { ...org, ...event, created, token };
}

async function rows<T>(organizationId: string, query: (tx: Parameters<Parameters<typeof withOrganization>[2]>[0]) => Promise<T>): Promise<T> {
  return withDb((db) => withOrganization(db, organizationId, query));
}

describe("RGP-08 — Purge programmée, annoncée sept jours avant, report possible et motivé", () => {
  it("régimes à J+7, le reste à J+30 du dernier jour (le brunch du lendemain compte) ; préavis à J et à J+23", async () => {
    const { organizationId, eventId, created } = await eventWithDiet();
    const schedule = await getGuestPurgeSchedule(organizationId, eventId);
    expect(schedule).toMatchObject({ baseDate: "2027-06-13", dietsDueOn: "2027-06-20", allDueOn: "2027-07-13", canPostpone: true, latestPostponeOn: "2027-10-11" });

    // La veille du préavis des régimes : rien.
    expect(await listGuestPurgeNotices(organizationId, new Date("2027-06-12T12:00:00Z"))).toEqual([]);
    expect(await runGuestPurge(organizationId, new Date("2027-06-12T12:00:00Z"))).toEqual({ notices: 0, dietsPurged: 0, purged: 0, exportsRemoved: 0 });
    // J : préavis des régimes (Aujourd'hui, et un e-mail à la titulaire).
    expect(await listGuestPurgeNotices(organizationId, new Date("2027-06-13T08:00:00Z"))).toEqual([{ eventId, stage: "diets", dueOn: "2027-06-20" }]);
    expect((await runGuestPurge(organizationId, new Date("2027-06-13T08:00:00Z"))).notices).toBe(1);
    expect((await runGuestPurge(organizationId, new Date("2027-06-14T08:00:00Z"))).notices).toBe(0);
    const notices = await rows(organizationId, (tx) => tx.select({ key: jobs.idempotencyKey }).from(jobs).where(like(jobs.idempotencyKey, `guests:purge-notice:${eventId}:%`)));
    expect(notices.map((row) => row.key)).toEqual([`guests:purge-notice:${eventId}:diets:2027-06-20`]);

    // J+7 à 23 h 59 la veille (Paris) : pas encore ; à 0 h 01 : les régimes partent, le reste reste.
    expect((await runGuestPurge(organizationId, new Date("2027-06-19T21:59:00Z"))).dietsPurged).toBe(0);
    expect((await runGuestPurge(organizationId, new Date("2027-06-19T22:01:00Z"))).dietsPurged).toBe(1);
    expect(await rows(organizationId, (tx) => tx.select().from(diets))).toEqual([]);
    expect((await listHouseholds(organizationId, eventId, { kind: "owner" }))[0]!.people[0]!.answers.length).toBe(3);

    // J+23 : préavis du reste ; J+30 : tout part, la preuve d'accord perd la personne.
    expect(await listGuestPurgeNotices(organizationId, new Date("2027-07-06T08:00:00Z"))).toEqual([{ eventId, stage: "all", dueOn: "2027-07-13" }]);
    expect((await runGuestPurge(organizationId, new Date("2027-07-12T21:59:00Z"))).purged).toBe(0);
    expect((await runGuestPurge(organizationId, new Date("2027-07-12T22:01:00Z"))).purged).toBe(1);
    expect(await rows(organizationId, (tx) => tx.select().from(households))).toEqual([]);
    expect(await rows(organizationId, (tx) => tx.select().from(guests).where(eq(guests.id, created.people[0]!.id)))).toEqual([]);
    const proofs = await rows(organizationId, (tx) => tx.select().from(dietConsents).where(eq(dietConsents.eventId, eventId)));
    expect(proofs).toHaveLength(1);
    expect(proofs[0]).toMatchObject({ guestId: null, givenByGuestId: null });
    expect(proofs[0]!.grantedAt).toBeInstanceOf(Date);
    const [settings] = await rows(organizationId, (tx) => tx.select().from(eventSettings).where(eq(eventSettings.eventId, eventId)));
    expect(settings!.purgedAt).toBeInstanceOf(Date);
    const audit = await rows(organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "guests.purge.executed")));
    expect(audit.map((entry) => entry.details.stage).sort()).toEqual(["all", "diets"]);
    expect(JSON.stringify(audit)).not.toMatch(/Jeanne|Durand/);
    // Rejouée : plus rien à faire.
    expect(await runGuestPurge(organizationId, new Date("2027-07-20T08:00:00Z"))).toEqual({ notices: 0, dietsPurged: 0, purged: 0, exportsRemoved: 0 });
  });

  it("passage à l'heure d'été : l'échéance du 28 mars 2027 tombe à minuit, heure de Paris", async () => {
    const { organizationId, eventId } = await eventWithDiet("2027-03-21", false);
    expect((await getGuestPurgeSchedule(organizationId, eventId)).dietsDueOn).toBe("2027-03-28");
    expect((await runGuestPurge(organizationId, new Date("2027-03-27T22:59:00Z"))).dietsPurged).toBe(0);
    expect((await runGuestPurge(organizationId, new Date("2027-03-27T23:01:00Z"))).dietsPurged).toBe(1);
  });

  it("un seul report, motivé, de 90 jours au plus ; tracé au journal sans le motif", async () => {
    const { organizationId, eventId } = await eventWithDiet();
    const now = new Date("2027-07-08T08:00:00Z");
    await expect(postponeGuestPurge(organizationId, eventId, { until: "2027-09-01", reason: "  " }, now)).rejects.toMatchObject({ problem: "reason_missing" });
    await expect(postponeGuestPurge(organizationId, eventId, { until: "2027-10-12", reason: "Facture du traiteur contestée" }, now)).rejects.toMatchObject({ problem: "too_late" });
    const schedule = await postponeGuestPurge(organizationId, eventId, { until: "2027-09-01", reason: "Facture du traiteur contestée" }, now);
    expect(schedule).toMatchObject({ allDueOn: "2027-09-01", canPostpone: false, postponement: { until: "2027-09-01", reason: "Facture du traiteur contestée" } });
    await expect(postponeGuestPurge(organizationId, eventId, { until: "2027-09-10", reason: "Encore" }, now)).rejects.toBeInstanceOf(PostponementInvalidError);
    expect((await runGuestPurge(organizationId, new Date("2027-07-13T08:00:00Z"))).purged).toBe(0);
    expect((await runGuestPurge(organizationId, new Date("2027-09-01T08:00:00Z"))).purged).toBe(1);
    const audit = await rows(organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "guests.purge.postponed")));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain("traiteur");
  });

  it("la purge efface aussi les exports stockés qui peuvent contenir les invités (DPO-6)", async () => {
    const { organizationId, ownerId, eventId } = await eventWithDiet();
    const [withGuests] = await rows(organizationId, (tx) =>
      tx.insert(organizationExports).values({ organizationId, status: "ready", requestedByUserId: ownerId, readyAt: new Date(), expiresAt: new Date("2027-12-31T00:00:00Z"), entityCounts: { "guests/households": 1 }, archiveKey: null }).returning({ id: organizationExports.id }),
    );
    const [withoutGuests] = await rows(organizationId, (tx) =>
      tx.insert(organizationExports).values({ organizationId, status: "ready", requestedByUserId: ownerId, readyAt: new Date(), expiresAt: new Date("2027-12-31T00:00:00Z"), entityCounts: { "events/events": 1 }, archiveKey: null }).returning({ id: organizationExports.id }),
    );
    await rows(organizationId, (tx) => tx.insert(privacyExports).values({ organizationId, recordCount: 1, pdfKey: `privacy/${randomUUID()}.pdf`, archiveKey: `privacy/${randomUUID()}.zip`, createdByUserId: ownerId, expiresAt: new Date("2027-12-31T00:00:00Z") }));
    const pass = await runGuestPurge(organizationId, new Date("2027-07-13T08:00:00Z"));
    expect(pass.exportsRemoved).toBe(2);
    const exports = await rows(organizationId, (tx) => tx.select().from(organizationExports).where(isNotNull(organizationExports.purgedAt)));
    expect(exports.map((row) => row.id)).toEqual([withGuests!.id]);
    expect(withoutGuests).toBeDefined();
    expect(await rows(organizationId, (tx) => tx.select().from(privacyExports).where(isNotNull(privacyExports.purgedAt)))).toHaveLength(1);
  });

  it("évènement annulé : les délais comptent depuis l'annulation", async () => {
    const { organizationId, ownerId, eventId } = await eventWithDiet();
    await changeEventStatus({ organizationId, eventId, changedByUserId: ownerId, toStatus: "cancelled" });
    const schedule = await getGuestPurgeSchedule(organizationId, eventId);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    expect(schedule.baseDate).toBe(today);
    expect(schedule.dietsDueOn! < "2027-06-20").toBe(true);
  });
});

describe("RGP-08 (partie F) — Opposition d'un invité, traitée aussitôt", () => {
  it("coordonnées et régimes effacés, liens retirés ; sa présence reste sous son seul nom ; la planner est prévenue", async () => {
    const { organizationId, eventId, created, token } = await eventWithDiet();
    expect(await opposeAsGuest(token)).toEqual({ outcome: "done" });
    const [after] = await listHouseholds(organizationId, eventId, { kind: "owner" });
    const jeanne = after!.people.find((person) => person.id === created.people[0]!.id)!;
    expect(jeanne).toMatchObject({ opposed: true, email: null, phone: null, firstName: "Jeanne", lastName: "Durand", diet: null });
    expect(jeanne.answers).toHaveLength(3);
    expect(jeanne.link.status).toBe("revoked");
    expect(await rows(organizationId, (tx) => tx.select().from(diets))).toEqual([]);
    expect((await openRsvp(token, "fr")).outcome).toBe("invalid");
    expect((await listRecentOppositions(organizationId)).map((row) => row.eventId)).toEqual([eventId]);
  });
});

describe("RGP-05 — privacy/v1 du module Invités", () => {
  it("trouve un invité par son e-mail ; l'efface sans attendre la purge (le foyer garde ses autres membres)", async () => {
    const { organizationId, eventId, created } = await eventWithDiet();
    const email = created.people[0]!.email!;
    const found = await guestsPrivacy.find({ organizationId, terms: { email } });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "guest", recordId: created.people[0]!.id, eventId, fields: { email, diet: "Végétarien" } });
    const other = await readyOrganization();
    expect(await guestsPrivacy.find({ organizationId: other.organizationId, terms: { email } })).toEqual([]);
    const plan = await guestsPrivacy.planErasure({ organizationId, records: [{ kind: "guest", recordId: created.people[0]!.id }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 }, today: "2027-01-01" });
    expect(plan).toEqual([{ kind: "guest", recordId: created.people[0]!.id, fate: "deleted", legalBasis: null, keptUntil: null }]);
    await guestsPrivacy.erase({ organizationId, records: [{ kind: "guest", recordId: created.people[0]!.id }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 }, today: "2027-01-01" });
    const [after] = await listHouseholds(organizationId, eventId, { kind: "owner" });
    expect(after!.people.map((person) => person.firstName)).toEqual(["Paul"]);
    expect(after!.respondentGuestId).toBe(after!.people[0]!.id);
    expect(await rows(organizationId, (tx) => tx.select().from(diets))).toEqual([]);
  });

  it("les données liées à un évènement sont une seule fiche « liste des invités », sans nom ; l'effacer emporte tout", async () => {
    const { organizationId, eventId } = await eventWithDiet();
    const related = await guestsPrivacy.related({ organizationId, eventIds: [eventId] });
    expect(related).toEqual([{ module: "guests", kind: "guest_list", recordId: eventId, label: "Liste des invités", fields: { people: "2" }, eventId }]);
    await guestsPrivacy.erase({ organizationId, records: [{ kind: "guest_list", recordId: eventId }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 }, today: "2027-01-01" });
    expect(await rows(organizationId, (tx) => tx.select().from(households))).toEqual([]);
    expect(await rows(organizationId, (tx) => tx.select().from(dietConsents))).toEqual([]);
  });
});
