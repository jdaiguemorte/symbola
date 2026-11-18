// Lot 49 — invitations après l'écran de contrôle des destinataires (D4, MSG-02) et relances
// automatiques (INV-04, D10), contre un vrai PostgreSQL et la file hub.jobs, avec une horloge
// simulée : la veille, le jour même, une réponse arrivée la veille, un rejeu, après la clôture.
import { like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { jobs } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { RecipientsNotConfirmedError, recipientsDigest } from "@/modules/hub/service";
import { answerRsvp, listInvitationRecipients, listManualFollowUps, openRsvp, sendGuestInvitations, sendGuestReminders, type InvitationWords } from "./service";
import { household, linkFor, openResponses, readyOrganization, weddingEvent, withDb } from "./test-fixtures";

const words: InvitationWords = { wedding: { fr: "mariage", en: "wedding" }, event: { fr: "évènement", en: "event" } };

async function reminderKeys(organizationId: string): Promise<string[]> {
  const rows = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select({ key: jobs.idempotencyKey }).from(jobs).where(like(jobs.idempotencyKey, "guests:reminder:%"))));
  return rows.map((row) => row.key).sort();
}

async function answerAll(token: string, now: Date) {
  const opened = await openRsvp(token, "fr", now);
  if (opened.outcome === "invalid") throw new Error("lien refusé");
  const presence = opened.view.members.filter((person) => person.canAnswerPresence).flatMap((person) => person.keyMomentIds.map((keyMomentId) => ({ guestId: person.id, keyMomentId, attending: true })));
  await answerRsvp(token, { presence, consent: false, dietOptionIds: [], children: [] }, "fr", now);
}

describe("D4 + MSG-02 — Les invitations partent après l'écran de contrôle des destinataires", () => {
  it("refusées sans la liste confirmée ; ensuite, un e-mail par adulte avec une adresse, un seul envoi", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    await openResponses(organizationId, eventId);
    await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Léa", email: "lea-invite@example.test" }, { kind: "adult", firstName: "Marc", email: "marc-invite@example.test" }] });
    await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }] });
    const recipients = await listInvitationRecipients(organizationId, eventId);
    expect(recipients.map((recipient) => recipient.email)).toEqual(["lea-invite@example.test", "marc-invite@example.test"]);
    await expect(sendGuestInvitations({ organizationId, eventId, confirmedRecipients: null, words })).rejects.toBeInstanceOf(RecipientsNotConfirmedError);
    const sent = await sendGuestInvitations({ organizationId, eventId, confirmedRecipients: recipientsDigest(recipients), words });
    expect(sent).toEqual({ sent: 2, notSent: 0 });
    expect(await listInvitationRecipients(organizationId, eventId)).toEqual([]);
    // Jeanne, sans adresse e-mail, est à relancer à la main (lien à copier).
    expect((await listManualFollowUps(organizationId, eventId)).map((row) => row.displayName)).toEqual(["Jeanne"]);
  });
});

describe("INV-04 — Relances automatiques : aucune relance vers un invité qui a répondu", () => {
  it("J-21 et J-7 avant la clôture, aux seuls foyers sans réponse qui ont une adresse ; rejouée, une seule fois ; rien après la clôture", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    // Clôture le 13 mai 2027 : relances le 22 avril (J-21) et le 6 mai (J-7).
    await openResponses(organizationId, eventId, "2027-05-13");
    const a = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Alice", email: "alice-relance@example.test" }] });
    const b = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Bruno", email: "bruno-relance@example.test" }] });
    await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Chloé", phone: "0699999999" }] });
    const invitedAt = new Date("2027-04-01T09:00:00Z");
    const recipients = await listInvitationRecipients(organizationId, eventId);
    await sendGuestInvitations({ organizationId, eventId, confirmedRecipients: recipientsDigest(recipients), words, now: invitedAt });

    // La veille de J-21 : rien.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-04-21T08:00:00Z"))).toBe(0);
    // Alice répond la veille : sa relance du lendemain n'a pas lieu.
    await answerAll(await linkFor(organizationId, eventId, a.people[0]!.id, new Date("2027-04-21T12:00:00Z")), new Date("2027-04-21T12:00:00Z"));
    // Le jour même (10 h à Paris) : Bruno seul ; Chloé n'a pas d'adresse.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-04-22T08:00:00Z"))).toBe(1);
    expect(await reminderKeys(organizationId)).toEqual([`guests:reminder:${b.id}:21`]);
    // Rejouée : la clé de la file empêche le double envoi.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-04-22T09:00:00Z"))).toBe(0);
    // Hors des heures d'envoi : rien.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-05-06T03:00:00Z"))).toBe(0);
    // Bruno répond la veille de J-7 : plus de relance.
    await answerAll(await linkFor(organizationId, eventId, b.people[0]!.id, new Date("2027-05-05T12:00:00Z")), new Date("2027-05-05T12:00:00Z"));
    expect(await sendGuestReminders(organizationId, words, new Date("2027-05-06T08:00:00Z"))).toBe(0);
    // Après la clôture : jamais.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-05-14T08:00:00Z"))).toBe(0);
    expect(await reminderKeys(organizationId)).toEqual([`guests:reminder:${b.id}:21`]);
  });

  it("un foyer sans réponse à J-7 reçoit la seconde relance (clé distincte)", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    await openResponses(organizationId, eventId, "2027-05-13");
    const silent = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Denis", email: "denis-relance@example.test" }] });
    const recipients = await listInvitationRecipients(organizationId, eventId);
    await sendGuestInvitations({ organizationId, eventId, confirmedRecipients: recipientsDigest(recipients), words, now: new Date("2027-04-01T09:00:00Z") });
    expect(await sendGuestReminders(organizationId, words, new Date("2027-04-22T08:00:00Z"))).toBe(1);
    expect(await sendGuestReminders(organizationId, words, new Date("2027-05-06T08:00:00Z"))).toBe(1);
    expect(await reminderKeys(organizationId)).toEqual([`guests:reminder:${silent.id}:21`, `guests:reminder:${silent.id}:7`].sort());
  });
});
