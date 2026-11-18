// Lot 49 (INV-03, INV-04, SEC-14 à SEC-17 ; D3, D4, D10, D13 ; ADR 0053, 0072, 0076) — liens
// personnels des invités, invitations et relances. Un lien par adulte qui a un moyen de contact,
// jamais pour un enfant (la base le refuse aussi) ; seule l'empreinte du jeton est gardée ; il
// expire à la fin du jour de clôture. Chaque lien remis (e-mail, copie, QR code) est un jeton neuf :
// un faire-part déjà imprimé reste valable. Les invitations partent après l'écran de contrôle des
// destinataires (MSG-02) ; les relances, par la file hub.jobs avec une clé par foyer et par relance,
// revérifiées au moment de l'envoi.
import QRCode from "qrcode";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { formatLinkToken, hashLinkSecret, newLinkSecret } from "@symbola/auth";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { eventSettings, guestLinks, guests, households } from "@symbola/db/schema/guests";
import { parseEnv } from "@symbola/env";
import { formatCalendarDate, parisToday } from "@symbola/i18n";
import { MailQuotaExceededError } from "@symbola/mail";
import { starterGuestRules } from "@symbola/starter-templates";
import type { EmailRecipient, GuestEventContext, GuestLocale } from "@symbola/contracts";
import { assertRecipientsConfirmed, EmailVariableMissingError, getOrganizationContact, jobKeyExists, sendOrganizationEmail } from "@/modules/hub/service";
import { assertGuestsReady, eventContext } from "./households";
import { findEventSettings, inOrganization, UUID, type GuestRow, type HouseholdRow, type Tx } from "./repository";
import { currentReminder, invitationKey, reminderKey, withinSendingHours } from "./reminders";
import { invitedMoments, rsvpOpen } from "./rsvp";

export class GuestNotFoundError extends Error {
  constructor() {
    super("invité introuvable");
    this.name = "GuestNotFoundError";
  }
}

// D3, D13 : un enfant, un adulte sans moyen de contact ou opposé, ou des réponses sans clôture
// (ou déjà closes) n'ont pas de lien.
export class GuestLinkUnavailableError extends Error {
  constructor(readonly reason: "child" | "no_contact" | "opposed" | "no_close_date" | "closed") {
    super(`lien indisponible : ${reason}`);
    this.name = "GuestLinkUnavailableError";
  }
}

export function rsvpUrl(token: string): string {
  return `${parseEnv(process.env).APP_PUBLIC_URL}/rsvp#${token}`;
}

async function insertLink(tx: Tx, organizationId: string, person: GuestRow, sentAt: Date | null): Promise<string> {
  const secret = newLinkSecret();
  await tx.insert(guestLinks).values({ organizationId, eventId: person.eventId, guestId: person.id, guestKind: "adult", tokenHash: hashLinkSecret(secret), sentAt });
  return formatLinkToken(organizationId, secret);
}

function linkProblem(person: GuestRow, closesOn: string | null, today: string): GuestLinkUnavailableError["reason"] | null {
  if (person.kind !== "adult") return "child";
  if (person.opposedAt) return "opposed";
  if (!person.email && !person.phone) return "no_contact";
  if (!closesOn) return "no_close_date";
  if (!rsvpOpen(closesOn, today)) return "closed";
  return null;
}

// D4 : un lien à copier et son QR code (PNG), pour un envoi par le client (SMS, messagerie,
// faire-part). Montré une fois : seule l'empreinte reste.
export async function issueGuestLink(organizationId: string, eventId: string, guestId: string, now: Date = new Date()): Promise<{ url: string; qrCodeDataUrl: string }> {
  await assertGuestsReady(organizationId);
  await eventContext(organizationId, eventId);
  if (!UUID.test(guestId)) throw new GuestNotFoundError();
  const token = await inOrganization(organizationId, async (tx) => {
    const [person] = await tx.select().from(guests).where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)));
    if (!person) throw new GuestNotFoundError();
    const settings = await findEventSettings(tx, eventId);
    const problem = linkProblem(person, settings?.responsesCloseOn ?? null, parisToday(now));
    if (problem) throw new GuestLinkUnavailableError(problem);
    return insertLink(tx, organizationId, person, null);
  });
  await recordAudit(appDatabase(), { organizationId, action: "guests.link.created", objectId: eventId });
  const url = rsvpUrl(token);
  return { url, qrCodeDataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 480 }) };
}

// Retrait par la planner : tous les liens de la personne cessent aussitôt.
export async function revokeGuestLinks(organizationId: string, eventId: string, guestId: string, now: Date = new Date()): Promise<number> {
  if (!UUID.test(guestId) || !UUID.test(eventId)) throw new GuestNotFoundError();
  const revoked = await inOrganization(organizationId, (tx) =>
    tx.update(guestLinks).set({ revokedAt: now, updatedAt: now }).where(and(eq(guestLinks.guestId, guestId), eq(guestLinks.eventId, eventId), isNull(guestLinks.revokedAt))).returning({ id: guestLinks.id }),
  );
  if (revoked.length > 0) await recordAudit(appDatabase(), { organizationId, action: "guests.link.revoked", objectId: eventId, details: { links: revoked.length } });
  return revoked.length;
}

type Recipient = EmailRecipient & { guestId: string; householdId: string; language: GuestLocale };

function fullName(person: Pick<GuestRow, "firstName" | "lastName">): string {
  return person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName;
}

// MSG-02 : qui recevrait l'invitation, tant qu'elle n'est pas partie : chaque adulte avec une
// adresse e-mail, non opposé, d'un foyer invité à au moins un temps fort.
async function invitationRecipients(tx: Tx, context: GuestEventContext): Promise<Recipient[]> {
  const householdRows = await tx.select().from(households).where(eq(households.eventId, context.eventId));
  const people = await tx.select().from(guests).where(and(eq(guests.eventId, context.eventId), eq(guests.kind, "adult"), isNull(guests.opposedAt)));
  const sentAt = new Set((await tx.select({ guestId: guestLinks.guestId, sentAt: guestLinks.sentAt }).from(guestLinks).where(eq(guestLinks.eventId, context.eventId))).filter((row) => row.sentAt !== null).map((row) => row.guestId));
  const allMoments = context.keyMoments.map((moment) => moment.id);
  const householdOf = new Map(householdRows.map((row) => [row.id, row]));
  return people
    .filter((person) => person.email && !sentAt.has(person.id))
    .filter((person) => invitedMoments(householdOf.get(person.householdId)?.keyMomentIds ?? null, allMoments).length > 0)
    .map((person) => ({ name: fullName(person), email: person.email!, guestId: person.id, householdId: person.householdId, language: householdOf.get(person.householdId)?.language === "en" ? "en" : "fr" }));
}

export async function listInvitationRecipients(organizationId: string, eventId: string): Promise<EmailRecipient[]> {
  const context = await eventContext(organizationId, eventId);
  const recipients = await inOrganization(organizationId, (tx) => invitationRecipients(tx, context));
  return recipients.map(({ name, email }) => ({ name, email })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export class InvitationsNotReadyError extends Error {
  constructor(readonly reason: "no_close_date" | "closed" | "no_key_moment") {
    super(`invitations impossibles : ${reason}`);
    this.name = "InvitationsNotReadyError";
  }
}

function clientNames(context: GuestEventContext): string {
  return context.clients.map((client) => client.firstName).filter(Boolean).join(" & ");
}

function eventWord(context: GuestEventContext, locale: GuestLocale, words: { wedding: Record<GuestLocale, string>; event: Record<GuestLocale, string> }): string {
  return context.vocabulary === "couple" ? words.wedding[locale] : words.event[locale];
}

// Mots de l'e-mail que le module fournit lui-même (« mariage » ou « évènement »), venus des
// traductions de l'appelant (CLAUDE.md § 2.10).
export type InvitationWords = { wedding: Record<GuestLocale, string>; event: Record<GuestLocale, string> };

function emailValues(context: GuestEventContext, locale: GuestLocale, words: InvitationWords, firstName: string, url: string, closesOn: string) {
  const firstDate = [...context.keyMoments.map((moment) => moment.date), ...(context.eventDate ? [context.eventDate] : [])].sort()[0] ?? null;
  return {
    first_name: firstName,
    clients: clientNames(context),
    event: eventWord(context, locale, words),
    ...(firstDate ? { event_date: formatCalendarDate(firstDate, locale) } : {}),
    link: url,
    valid_until: formatCalendarDate(closesOn, locale),
  };
}

// D4 + MSG-02 : les invitations partent vers la liste confirmée sur l'écran du garde-fou (même
// empreinte), au nom de l'organisation. Un e-mail au-delà du plafond d'envois attend un nouvel
// essai (notSent) ; les relances programmées ont été annoncées sur le même écran.
export async function sendGuestInvitations(input: { organizationId: string; eventId: string; confirmedRecipients: string | null; words: InvitationWords; now?: Date }): Promise<{ sent: number; notSent: number }> {
  const now = input.now ?? new Date();
  await assertGuestsReady(input.organizationId);
  const context = await eventContext(input.organizationId, input.eventId);
  if (context.keyMoments.length === 0) throw new InvitationsNotReadyError("no_key_moment");
  const { recipients, closesOn } = await inOrganization(input.organizationId, async (tx) => {
    const settings = await findEventSettings(tx, input.eventId);
    return { recipients: await invitationRecipients(tx, context), closesOn: settings?.responsesCloseOn ?? null };
  });
  if (!closesOn) throw new InvitationsNotReadyError("no_close_date");
  if (!rsvpOpen(closesOn, parisToday(now))) throw new InvitationsNotReadyError("closed");
  assertRecipientsConfirmed(recipients.map(({ name, email }) => ({ name, email })), input.confirmedRecipients);
  let sent = 0;
  let notSent = 0;
  for (const recipient of recipients) {
    const token = await inOrganization(input.organizationId, async (tx) => {
      const [person] = await tx.select().from(guests).where(eq(guests.id, recipient.guestId));
      if (!person || person.opposedAt || !person.email) return null;
      return insertLink(tx, input.organizationId, person, null);
    });
    if (!token) continue;
    const firstName = recipient.name.split(" ")[0] ?? recipient.name;
    try {
      await sendOrganizationEmail({
        organizationId: input.organizationId,
        to: recipient.email,
        kind: "guest_invitation",
        locale: recipient.language,
        values: emailValues(context, recipient.language, input.words, firstName, rsvpUrl(token), closesOn),
        idempotencyKey: invitationKey(recipient.guestId),
      });
      await inOrganization(input.organizationId, async (tx) => {
        await tx.update(guestLinks).set({ sentAt: now }).where(and(eq(guestLinks.guestId, recipient.guestId), eq(guestLinks.tokenHash, hashOf(token))));
        await tx.update(households).set({ invitedAt: now }).where(and(eq(households.id, recipient.householdId), isNull(households.invitedAt)));
      });
      sent += 1;
    } catch (error) {
      if (!(error instanceof MailQuotaExceededError) && !(error instanceof EmailVariableMissingError)) throw error;
      // Le lien créé pour cet e-mail ne servira pas : retiré aussitôt.
      await inOrganization(input.organizationId, (tx) => tx.delete(guestLinks).where(eq(guestLinks.tokenHash, hashOf(token))));
      notSent += 1;
    }
  }
  await inOrganization(input.organizationId, (tx) => tx.update(eventSettings).set({ invitationsSentAt: now, updatedAt: now }).where(and(eq(eventSettings.eventId, input.eventId), isNull(eventSettings.invitationsSentAt))));
  if (sent > 0) await recordAudit(appDatabase(), { organizationId: input.organizationId, action: "guests.invitations.sent", objectId: input.eventId, details: { sent, notSent } });
  return { sent, notSent };
}

function hashOf(token: string): string {
  return hashLinkSecret(token.split(".")[1] ?? "");
}

// D10 : foyers à relancer à la main (sans adresse e-mail), avec leur répondant à appeler.
export async function listManualFollowUps(organizationId: string, eventId: string): Promise<{ householdId: string; displayName: string; guestId: string; phone: string | null }[]> {
  await eventContext(organizationId, eventId);
  return inOrganization(organizationId, async (tx) => {
    const unanswered = await tx.select().from(households).where(and(eq(households.eventId, eventId), isNull(households.answeredAt)));
    if (unanswered.length === 0) return [];
    const people = await tx.select().from(guests).where(and(inArray(guests.householdId, unanswered.map((row) => row.id)), eq(guests.kind, "adult"), isNull(guests.opposedAt)));
    return unanswered.flatMap((household) => {
      const adults = people.filter((person) => person.householdId === household.id);
      if (adults.length === 0 || adults.some((person) => person.email)) return [];
      const contact = adults.find((person) => person.id === household.respondentGuestId && person.phone) ?? adults.find((person) => person.phone);
      return contact ? [{ householdId: household.id, displayName: household.displayName, guestId: contact.id, phone: contact.phone }] : [];
    });
  });
}

// À qui part la relance d'un foyer : son répondant s'il a une adresse, sinon le premier adulte qui
// en a une ; personne si le foyer a répondu ou s'est opposé.
function reminderTarget(household: HouseholdRow, people: GuestRow[]): GuestRow | null {
  if (household.answeredAt) return null;
  const adults = people.filter((person) => person.householdId === household.id && person.kind === "adult" && !person.opposedAt && person.email);
  return adults.find((person) => person.id === household.respondentGuestId) ?? adults[0] ?? null;
}

// INV-04, D10 : passage des relances d'une organisation (tâche horaire). Pour chaque évènement aux
// invitations envoyées et aux réponses ouvertes, la relance la plus récente échue part vers les
// foyers invités sans réponse qui ont une adresse e-mail ; la réponse est relue juste avant chaque
// envoi (une réponse arrivée entre-temps annule la relance), la clé de la file empêche un double.
export async function sendGuestReminders(organizationId: string, words: InvitationWords, now: Date = new Date()): Promise<number> {
  const rules = starterGuestRules();
  if (!withinSendingHours(now, rules.reminderHours)) return 0;
  const today = parisToday(now);
  const settingsRows = await inOrganization(organizationId, (tx) => tx.select().from(eventSettings));
  let sent = 0;
  for (const settings of settingsRows) {
    if (!settings.invitationsSentAt || settings.purgedAt) continue;
    const reminder = currentReminder(settings.responsesCloseOn, settings.reminderDays, today);
    if (!reminder || !settings.responsesCloseOn) continue;
    let context: GuestEventContext;
    try {
      context = await eventContext(organizationId, settings.eventId);
    } catch {
      continue;
    }
    if (context.status === "cancelled") continue;
    const candidates = await inOrganization(organizationId, async (tx) => (await tx.select().from(households).where(and(eq(households.eventId, settings.eventId), isNull(households.answeredAt)))).filter((row) => row.invitedAt !== null && row.invitedAt <= now));
    for (const candidate of candidates) {
      const key = reminderKey(candidate.id, reminder.day);
      if (await jobKeyExists(organizationId, key)) continue;
      // Revérifié au moment de l'envoi : le foyer, sa réponse, ses adresses.
      const fresh = await inOrganization(organizationId, async (tx) => {
        const [household] = await tx.select().from(households).where(eq(households.id, candidate.id));
        if (!household) return null;
        const people = await tx.select().from(guests).where(eq(guests.householdId, household.id));
        const target = reminderTarget(household, people);
        if (!target) return null;
        return { target, token: await insertLink(tx, organizationId, target, now), language: household.language === "en" ? ("en" as const) : ("fr" as const) };
      });
      if (!fresh) continue;
      try {
        await sendOrganizationEmail({
          organizationId,
          to: fresh.target.email!,
          kind: "guest_reminder",
          locale: fresh.language,
          values: emailValues(context, fresh.language, words, fresh.target.firstName, rsvpUrl(fresh.token), settings.responsesCloseOn),
          idempotencyKey: key,
        });
        sent += 1;
      } catch (error) {
        await inOrganization(organizationId, (tx) => tx.delete(guestLinks).where(eq(guestLinks.tokenHash, hashOf(fresh.token))));
        if (error instanceof MailQuotaExceededError) return sent;
        if (!(error instanceof EmailVariableMissingError)) throw error;
      }
    }
  }
  return sent;
}

// Coordonnées de la planner, montrées sur la page de réponse (clôture, questions).
export async function plannerContact(organizationId: string) {
  return getOrganizationContact(appDatabase(), organizationId);
}
