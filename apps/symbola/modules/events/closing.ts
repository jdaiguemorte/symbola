// Lot 58 (PAR-09 ; D4 ; ADR 0097) — clôture d'un évènement, côté module events : la liste de clôture
// (étapes cochées, temps passé facultatif, trois leçons, frais propres de la planner), le budget final
// figé à la clôture, la demande d'avis (remerciement et lien d'avis réglé par la planner, relus avant
// l'envoi), l'archivage (lecture seule, hors des listes courantes, consultable) et les réglages.
// Les montants des autres modules (budget, devis) sont lus par lib/closing, jamais ici (ADR 0011).
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { withOrganization } from "@symbola/db/with-organization";
import { closingSettings, eventClosings, events, type ClosingBudgetSnapshot, type ClosingOwnExpense } from "@symbola/db/schema/events";
import { starterClosingLimits, starterClosingThanks } from "@symbola/starter-templates";
import { cleanCheckedSteps, cleanLessons, cleanOwnExpenses, cleanTimeSpent, ClosingInputError, type ClosingStep } from "./closing-rules";
import { EventNotFoundError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class EventArchivedError extends Error {
  constructor() {
    super("évènement archivé : lecture seule");
    this.name = "EventArchivedError";
  }
}

export class EventNotClosableError extends Error {
  constructor(readonly reason: "status" | "not_finished" | "demo") {
    super(`clôture impossible : ${reason}`);
    this.name = "EventNotClosableError";
  }
}

export class ReviewRequestError extends Error {
  constructor(readonly reason: "no_recipient" | "empty" | "too_long" | "demo" | "placeholder") {
    super(`demande d'avis : ${reason}`);
    this.name = "ReviewRequestError";
  }
}

export type ClosingView = {
  eventId: string;
  checkedSteps: ClosingStep[];
  timeSpentMinutes: number | null;
  lessons: string[];
  ownExpenses: ClosingOwnExpense[];
  ownExpensesCents: number;
  budgetSnapshot: ClosingBudgetSnapshot | null;
  closedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestKind: "thanks" | "thanks_with_review" | null;
};

type EventState = { id: string; status: string; eventDate: string | null; timeZone: string; isDemo: boolean; archivedAt: Date | null };

async function eventState(tx: Tx, eventId: string): Promise<EventState | null> {
  if (!UUID.test(eventId)) return null;
  const [row] = await tx.select({ id: events.id, status: events.status, eventDate: events.eventDate, timeZone: events.timeZone, isDemo: events.isDemo, archivedAt: events.archivedAt }).from(events).where(eq(events.id, eventId));
  return row ?? null;
}

function toView(eventId: string, row: typeof eventClosings.$inferSelect | undefined): ClosingView {
  const ownExpenses = (row?.ownExpenses ?? []) as ClosingOwnExpense[];
  return {
    eventId,
    checkedSteps: (row?.checkedSteps ?? []) as ClosingStep[],
    timeSpentMinutes: row?.timeSpentMinutes ?? null,
    lessons: row?.lessons ?? [],
    ownExpenses,
    ownExpensesCents: ownExpenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    budgetSnapshot: row?.budgetSnapshot ?? null,
    closedAt: row?.closedAt?.toISOString() ?? null,
    reviewRequestedAt: row?.reviewRequestedAt?.toISOString() ?? null,
    reviewRequestKind: row?.reviewRequestKind ?? null,
  };
}

export async function getEventClosing(organizationId: string, eventId: string): Promise<ClosingView | null> {
  return inOrganization(organizationId, async (tx) => {
    if (!(await eventState(tx, eventId))) return null;
    const [row] = await tx.select().from(eventClosings).where(eq(eventClosings.eventId, eventId));
    return toView(eventId, row);
  });
}

export async function isEventArchived(organizationId: string, eventId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await eventState(tx, eventId))?.archivedAt != null);
}

// Lecture seule d'un évènement archivé (D : réponse de Julien du 18/11) : les gestes de la planner sur
// l'évènement passent par ce contrôle ; les purges (RGPD, invités, corbeille) suivent leur calendrier.
export async function assertEventWritable(organizationId: string, eventId: string): Promise<void> {
  if (await isEventArchived(organizationId, eventId)) throw new EventArchivedError();
}

export type ClosingNotesInput = {
  checkedSteps?: readonly string[];
  timeSpentMinutes?: number | null;
  lessons?: readonly string[];
  ownExpenses?: readonly ClosingOwnExpense[];
};

export async function saveClosingNotes(organizationId: string, eventId: string, input: ClosingNotesInput): Promise<ClosingView> {
  const limits = starterClosingLimits();
  const values: Partial<typeof eventClosings.$inferInsert> = {};
  if (input.checkedSteps !== undefined) values.checkedSteps = cleanCheckedSteps(input.checkedSteps);
  if (input.timeSpentMinutes !== undefined) values.timeSpentMinutes = cleanTimeSpent(input.timeSpentMinutes);
  if (input.lessons !== undefined) values.lessons = cleanLessons(input.lessons, limits.lessonCount);
  if (input.ownExpenses !== undefined) values.ownExpenses = cleanOwnExpenses(input.ownExpenses, limits.maxOwnExpenses);
  return inOrganization(organizationId, async (tx) => {
    const event = await eventState(tx, eventId);
    if (!event) throw new EventNotFoundError();
    if (event.archivedAt) throw new EventArchivedError();
    const [row] = await tx
      .insert(eventClosings)
      .values({ organizationId, eventId, ...values })
      .onConflictDoUpdate({ target: eventClosings.eventId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return toView(eventId, row);
  });
}

// Clôturer : le budget final se fige (les cinq montants lus au module Budget par l'appelant). Le
// statut « Clôturé » (historisé) est posé avant par le service (changeEventStatus) ; seul un évènement
// confirmé, en préparation ou déjà clôturé à la main se clôture.
export async function closeEvent(input: { organizationId: string; eventId: string; userId: string; budget: ClosingBudgetSnapshot; now?: Date }): Promise<ClosingView> {
  const now = input.now ?? new Date();
  return inOrganization(input.organizationId, async (tx) => {
    const event = await eventState(tx, input.eventId);
    if (!event) throw new EventNotFoundError();
    if (event.archivedAt) throw new EventArchivedError();
    if (event.isDemo) throw new EventNotClosableError("demo");
    if (event.status !== "closed" && event.status !== "confirmed") throw new EventNotClosableError("status");
    const [row] = await tx
      .insert(eventClosings)
      .values({ organizationId: input.organizationId, eventId: input.eventId, closedAt: now, closedBy: input.userId, budgetSnapshot: input.budget })
      .onConflictDoUpdate({ target: eventClosings.eventId, set: { closedAt: now, closedBy: input.userId, budgetSnapshot: input.budget, updatedAt: now } })
      .returning();
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.event.closed", objectId: input.eventId, details: { statusChanged: event.status !== "closed" } });
    return toView(input.eventId, row);
  });
}

// Archiver (PAR-09, étape 5) : seulement un évènement terminé (clôturé ou annulé).
export async function archiveEvent(input: { organizationId: string; eventId: string; userId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await inOrganization(input.organizationId, async (tx) => {
    const event = await eventState(tx, input.eventId);
    if (!event) throw new EventNotFoundError();
    if (event.isDemo) throw new EventNotClosableError("demo");
    if (event.status !== "closed" && event.status !== "cancelled") throw new EventNotClosableError("not_finished");
    if (event.archivedAt) return;
    await tx.update(events).set({ archivedAt: now, archivedBy: input.userId, updatedAt: now }).where(eq(events.id, input.eventId));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.event.archived", objectId: input.eventId, details: {} });
  });
}

export async function unarchiveEvent(input: { organizationId: string; eventId: string; userId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await inOrganization(input.organizationId, async (tx) => {
    const event = await eventState(tx, input.eventId);
    if (!event) throw new EventNotFoundError();
    if (!event.archivedAt) return;
    await tx.update(events).set({ archivedAt: null, archivedBy: null, updatedAt: now }).where(eq(events.id, input.eventId));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.event.unarchived", objectId: input.eventId, details: {} });
  });
}

export async function archivedEventIds(organizationId: string, eventIds?: readonly string[]): Promise<Set<string>> {
  if (eventIds && eventIds.length === 0) return new Set();
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ id: events.id })
      .from(events)
      .where(and(isNotNull(events.archivedAt), eventIds ? inArray(events.id, eventIds.filter((id) => UUID.test(id))) : undefined)),
  );
  return new Set(rows.map((row) => row.id));
}

// Les clôtures de l'organisation (tableau de bord discret du temps passé, liste « À clôturer »).
export type ClosingDigest = { eventId: string; closedAt: string | null; timeSpentMinutes: number | null; ownExpensesCents: number; reviewRequested: boolean };

export async function listEventClosings(organizationId: string): Promise<ClosingDigest[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventClosings));
  return rows.map((row) => {
    const view = toView(row.eventId, row);
    return { eventId: row.eventId, closedAt: view.closedAt, timeSpentMinutes: view.timeSpentMinutes, ownExpensesCents: view.ownExpensesCents, reviewRequested: view.reviewRequestedAt !== null };
  });
}

// Les évènements non fictifs, non archivés, encore ouverts (confirmés ou en préparation) et sans
// clôture validée : candidats à « À clôturer » (le jour s'apprécie dans le fuseau, lifecycle.closingDue).
export async function listClosingCandidates(organizationId: string): Promise<{ id: string; status: "confirmed"; eventDate: string; timeZone: string }[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ id: events.id, status: events.status, eventDate: events.eventDate, timeZone: events.timeZone, closedAt: eventClosings.closedAt })
      .from(events)
      .leftJoin(eventClosings, eq(eventClosings.eventId, events.id))
      .where(and(isNull(events.archivedAt), eq(events.isDemo, false), eq(events.status, "confirmed"), isNotNull(events.eventDate)));
    return rows.filter((row) => row.closedAt === null).map((row) => ({ id: row.id, status: row.status as "confirmed", eventDate: row.eventDate!, timeZone: row.timeZone }));
  });
}

// —— Réglages et demande d'avis ——————————————————————————————————————————————————————————————

export type ClosingSettingsView = { reviewUrl: string | null; reviewLabel: string | null };

export class ClosingSettingsError extends Error {
  constructor(readonly field: "url" | "label") {
    super(`réglages de clôture : ${field} invalide`);
    this.name = "ClosingSettingsError";
  }
}

export async function getClosingSettings(organizationId: string): Promise<ClosingSettingsView> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(closingSettings));
  return { reviewUrl: row?.reviewUrl ?? null, reviewLabel: row?.reviewLabel ?? null };
}

export async function saveClosingSettings(organizationId: string, input: { reviewUrl: string | null; reviewLabel: string | null }): Promise<ClosingSettingsView> {
  const reviewUrl = input.reviewUrl?.trim() || null;
  const reviewLabel = input.reviewLabel?.replace(/\s+/g, " ").trim() || null;
  if (reviewUrl !== null) {
    let parsed: URL;
    try {
      parsed = new URL(reviewUrl);
    } catch {
      throw new ClosingSettingsError("url");
    }
    if (parsed.protocol !== "https:" || reviewUrl.length > 500 || parsed.username || parsed.password) throw new ClosingSettingsError("url");
  }
  if (reviewLabel !== null && reviewLabel.length > 60) throw new ClosingSettingsError("label");
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(closingSettings)
      .values({ organizationId, reviewUrl, reviewLabel })
      .onConflictDoUpdate({ target: closingSettings.organizationId, set: { reviewUrl, reviewLabel, updatedAt: new Date() } }),
  );
  return { reviewUrl, reviewLabel };
}

export type ReviewRecipient = { contactId: string; firstName: string; email: string };

// Texte de départ, déjà rempli : les prénoms, l'organisation et le lien d'avis de la planner. Sans
// lien réglé, seulement le remerciement (réponse de Julien du 18/11, option a).
export function draftReviewRequest(input: { locale: "fr" | "en"; firstNames: string[]; organization: string; reviewUrl: string | null }): { subject: string; body: string; withReview: boolean } {
  const withReview = input.reviewUrl !== null;
  const text = starterClosingThanks(input.locale, withReview);
  const firstName = input.firstNames.filter((name) => name.trim()).join(" & ");
  const fill = (value: string) => value.replaceAll("{{first_name}}", firstName).replaceAll("{{organization}}", input.organization).replaceAll("{{link}}", input.reviewUrl ?? "");
  return { subject: fill(text.subject), body: fill(text.body), withReview };
}

export const REVIEW_SUBJECT_MAX = 200;
export const REVIEW_BODY_MAX = 5000;

// Le texte relu (et modifié) par la planner part tel quel ; une variable restée entre accolades arrête
// l'envoi. L'envoi lui-même passe par la messagerie de l'organisation (sendMail, fourni par l'appelant).
export async function sendReviewRequest(input: {
  organizationId: string;
  eventId: string;
  recipients: ReviewRecipient[];
  subject: string;
  body: string;
  withReview: boolean;
  sendMail: (recipient: ReviewRecipient, text: { subject: string; body: string }) => Promise<void>;
  now?: Date;
}): Promise<ClosingView> {
  const now = input.now ?? new Date();
  const subject = input.subject.replace(/\s+/g, " ").trim();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!subject || !body) throw new ReviewRequestError("empty");
  if (subject.length > REVIEW_SUBJECT_MAX || body.length > REVIEW_BODY_MAX) throw new ReviewRequestError("too_long");
  if (/\{\{[^}]*\}\}/.test(`${subject} ${body}`)) throw new ReviewRequestError("placeholder");
  if (input.recipients.length === 0) throw new ReviewRequestError("no_recipient");
  const event = await inOrganization(input.organizationId, (tx) => eventState(tx, input.eventId));
  if (!event) throw new EventNotFoundError();
  if (event.archivedAt) throw new EventArchivedError();
  if (event.isDemo) throw new ReviewRequestError("demo");
  for (const recipient of input.recipients) await input.sendMail(recipient, { subject, body });
  const kind = input.withReview ? ("thanks_with_review" as const) : ("thanks" as const);
  return inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(eventClosings)
      .values({ organizationId: input.organizationId, eventId: input.eventId, reviewRequestedAt: now, reviewRequestKind: kind })
      .onConflictDoUpdate({ target: eventClosings.eventId, set: { reviewRequestedAt: now, reviewRequestKind: kind, updatedAt: now } })
      .returning();
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.review_request.sent", objectId: input.eventId, details: { recipients: input.recipients.length, withReview: input.withReview } });
    return toView(input.eventId, row);
  });
}

export { ClosingInputError };
