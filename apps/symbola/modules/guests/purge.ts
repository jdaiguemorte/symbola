// Lot 49 (RGP-08 ; D9 ; ADR 0056, 0082 ; réponses 2 et 3 de la DPO) — purge automatique des
// données d'invités, avec préavis : régimes et allergies à J+7, le reste à J+30, comptés depuis le
// dernier jour de l'évènement (ou son annulation), en heure de Paris. Le préavis (sept jours avant
// chaque purge) s'affiche dans « Aujourd'hui » et part par e-mail à la titulaire ; un seul report,
// motivé, de 90 jours au plus, tracé au journal sans donnée personnelle. La purge efface aussi les
// exports stockés qui peuvent contenir les invités (archives de l'organisation, exports RGPD) ; la
// titulaire en est prévenue. Les copies hors ligne du jour J ne contiennent aucune donnée d'invité.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { eq, gte, inArray, isNotNull, min } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { withAuditBulk } from "@symbola/db/actor";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { dietConsents, diets, eventSettings, guests, householdGroups, households, purgePostponements } from "@symbola/db/schema/guests";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { starterGuestRules } from "@symbola/starter-templates";
import type { GuestEventContext, GuestPurgeNotice, GuestPurgeSchedule, GuestPurgeStage } from "@symbola/contracts";
import { guestEventContexts } from "@/modules/events/service";
import { getPrivacySettings, jobKeyExists, listOrganizations, purgeOrganizationExportsWithGuests, purgePrivacyExportsSince, sendSymbolaEmail } from "@/modules/hub/service";
import { eventContext } from "./households";
import { findPostponement, inOrganization, type EventSettingsRow, type Tx } from "./repository";
import { isDue, noticeActive, purgeBaseDate, purgeSchedule, validatePostponement, type GuestRetention, type PostponementProblem } from "./purge-rules";

export class PostponementInvalidError extends Error {
  constructor(readonly problem: PostponementProblem | "no_date") {
    super(`report refusé : ${problem}`);
    this.name = "PostponementInvalidError";
  }
}

async function retentionOf(organizationId: string): Promise<GuestRetention> {
  const settings = await getPrivacySettings(appDatabase(), organizationId);
  return { dietDays: settings.guestDietRetentionDays, allDays: settings.guestRetentionDays, maxPostponeDays: settings.guestPurgeMaxPostponeDays };
}

function scheduleOf(context: GuestEventContext, retention: GuestRetention, settings: EventSettingsRow | null, postponement: { postponedUntil: string; reason: string; createdAt: Date } | null): GuestPurgeSchedule {
  const baseDate = purgeBaseDate({ status: context.status, cancelledOn: context.cancelledOn, eventDate: context.eventDate, keyMomentDates: context.keyMoments.map((moment) => moment.date) });
  const computed = baseDate ? purgeSchedule(baseDate, retention, postponement?.postponedUntil ?? null) : null;
  return {
    eventId: context.eventId,
    baseDate,
    dietsDueOn: computed?.dietsDueOn ?? null,
    allDueOn: computed?.allDueOn ?? null,
    dietsPurgedAt: settings?.dietsPurgedAt?.toISOString() ?? null,
    purgedAt: settings?.purgedAt?.toISOString() ?? null,
    postponement: postponement ? { until: postponement.postponedUntil, reason: postponement.reason, createdAt: postponement.createdAt.toISOString() } : null,
    canPostpone: computed !== null && !postponement && !settings?.purgedAt,
    latestPostponeOn: computed?.latestPostponeOn ?? null,
  };
}

export async function getGuestPurgeSchedule(organizationId: string, eventId: string): Promise<GuestPurgeSchedule> {
  const context = await eventContext(organizationId, eventId);
  const retention = await retentionOf(organizationId);
  const { settings, postponement } = await inOrganization(organizationId, async (tx) => ({ settings: (await tx.select().from(eventSettings).where(eq(eventSettings.eventId, eventId)))[0] ?? null, postponement: await findPostponement(tx, eventId) }));
  return scheduleOf(context, retention, settings, postponement);
}

// Un seul report, motivé, au-delà de l'échéance en cours et jamais plus loin que la valeur de départ
// plus un report ; tracé au journal (date et identifiants, sans le motif).
export async function postponeGuestPurge(organizationId: string, eventId: string, input: { until: string; reason: string }, now: Date = new Date()): Promise<GuestPurgeSchedule> {
  const context = await eventContext(organizationId, eventId);
  const retention = await retentionOf(organizationId);
  const today = parisToday(now);
  const reason = input.reason.replace(/\s+/g, " ").trim().slice(0, 500);
  await inOrganization(organizationId, async (tx) => {
    const [settings] = await tx.select().from(eventSettings).where(eq(eventSettings.eventId, eventId));
    const existing = await findPostponement(tx, eventId);
    const baseDate = purgeBaseDate({ status: context.status, cancelledOn: context.cancelledOn, eventDate: context.eventDate, keyMomentDates: context.keyMoments.map((moment) => moment.date) });
    if (!baseDate) throw new PostponementInvalidError("no_date");
    const problem = validatePostponement({
      until: input.until,
      reason,
      today,
      schedule: purgeSchedule(baseDate, retention, null),
      dietsPurged: Boolean(settings?.dietsPurgedAt),
      alreadyPostponed: existing !== null,
      purged: Boolean(settings?.purgedAt),
    });
    if (problem) throw new PostponementInvalidError(problem);
    await tx.insert(purgePostponements).values({ organizationId, eventId, reason, postponedUntil: input.until });
    // Le préavis repartira avant la nouvelle date.
    if (settings) await tx.update(eventSettings).set({ dietPurgeNoticeAt: settings.dietsPurgedAt ? settings.dietPurgeNoticeAt : null, purgeNoticeAt: null, updatedAt: now }).where(eq(eventSettings.eventId, eventId));
  });
  await recordAudit(appDatabase(), { organizationId, action: "guests.purge.postponed", objectId: eventId, details: { until: input.until } });
  return getGuestPurgeSchedule(organizationId, eventId);
}

type EventWithData = { context: GuestEventContext; settings: EventSettingsRow | null; firstHouseholdAt: Date | null; postponement: Awaited<ReturnType<typeof findPostponement>> };

// Évènements où le module garde des données d'invités (foyers, régimes, preuves d'accord).
async function eventsWithData(organizationId: string): Promise<EventWithData[]> {
  const found = await inOrganization(organizationId, async (tx) => {
    const firsts = await tx.select({ eventId: households.eventId, first: min(households.createdAt) }).from(households).groupBy(households.eventId);
    const consentEvents = await tx.selectDistinct({ eventId: dietConsents.eventId }).from(dietConsents).where(isNotNull(dietConsents.guestId));
    const ids = [...new Set([...firsts.map((row) => row.eventId), ...consentEvents.map((row) => row.eventId)])];
    const settings = ids.length > 0 ? await tx.select().from(eventSettings).where(inArray(eventSettings.eventId, ids)) : [];
    const postponements = ids.length > 0 ? await tx.select().from(purgePostponements).where(inArray(purgePostponements.eventId, ids)) : [];
    return { ids, firsts, settings, postponements };
  });
  if (found.ids.length === 0) return [];
  const contexts = await guestEventContexts(organizationId, found.ids);
  return contexts
    .filter((context) => !context.isDemo)
    .map((context) => ({
      context,
      settings: found.settings.find((row) => row.eventId === context.eventId) ?? null,
      firstHouseholdAt: found.firsts.find((row) => row.eventId === context.eventId)?.first ?? null,
      postponement: found.postponements.find((row) => row.eventId === context.eventId) ?? null,
    }));
}

// Préavis en cours (sept jours avant chaque purge), pour « Aujourd'hui ».
export async function listGuestPurgeNotices(organizationId: string, now: Date = new Date()): Promise<GuestPurgeNotice[]> {
  const today = parisToday(now);
  const retention = await retentionOf(organizationId);
  const noticeDays = starterGuestRules().purgeNoticeDays;
  const notices: GuestPurgeNotice[] = [];
  for (const item of await eventsWithData(organizationId)) {
    const schedule = scheduleOf(item.context, retention, item.settings, item.postponement);
    if (schedule.dietsDueOn && !schedule.dietsPurgedAt && noticeActive(schedule.dietsDueOn, today, noticeDays)) notices.push({ eventId: item.context.eventId, stage: "diets", dueOn: schedule.dietsDueOn });
    if (schedule.allDueOn && !schedule.purgedAt && noticeActive(schedule.allDueOn, today, noticeDays)) notices.push({ eventId: item.context.eventId, stage: "all", dueOn: schedule.allDueOn });
  }
  return notices;
}

// Régimes et allergies effacés ; les preuves d'accord restent jusqu'à la purge du reste.
async function purgeDiets(tx: Tx, eventId: string): Promise<number> {
  const people = await tx.select({ id: guests.id }).from(guests).where(eq(guests.eventId, eventId));
  if (people.length === 0) return 0;
  return (await tx.delete(diets).where(inArray(diets.guestId, people.map((person) => person.id))).returning({ id: diets.id })).length;
}

// Tout le reste : foyers (et en cascade personnes, réponses, régimes, liens), groupes, report ;
// les preuves d'accord perdent la personne (horodatage anonymisé, la clé passe à null).
async function purgeAll(tx: Tx, eventId: string): Promise<number> {
  const removed = await tx.delete(households).where(eq(households.eventId, eventId)).returning({ id: households.id });
  await tx.delete(householdGroups).where(eq(householdGroups.eventId, eventId));
  await tx.delete(purgePostponements).where(eq(purgePostponements.eventId, eventId));
  await tx.update(dietConsents).set({ guestId: null, givenByGuestId: null }).where(eq(dietConsents.eventId, eventId));
  return removed.length;
}

function translator(locale: Locale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Guests.purgeEmail" });
}

async function ownerOf(organizationId: string): Promise<{ email: string; locale: Locale } | null> {
  const team = await listTeam(appDatabase(), organizationId);
  const owner = team.find((member) => member.role === "owner" && !member.disabledAt);
  if (!owner) return null;
  const organization = (await listOrganizations(appDatabase())).find((row) => row.id === organizationId);
  return { email: owner.email, locale: organization?.language === "en" ? "en" : "fr" };
}

async function notifyOwner(organizationId: string, eventId: string, kind: "notice" | "exports", values: { stage?: GuestPurgeStage; dueOn?: string; count?: number }, key: string): Promise<void> {
  if (await jobKeyExists(organizationId, key)) return;
  const owner = await ownerOf(organizationId);
  if (!owner) return;
  const t = translator(owner.locale);
  const due = values.dueOn ? formatCalendarDate(values.dueOn, owner.locale) : "";
  const subject = kind === "notice" ? t(values.stage === "diets" ? "noticeDietsSubject" : "noticeAllSubject") : t("exportsSubject");
  const body = kind === "notice" ? t(values.stage === "diets" ? "noticeDietsBody" : "noticeAllBody", { date: due }) : t("exportsBody", { count: values.count ?? 0 });
  await sendSymbolaEmail({ to: owner.email, locale: owner.locale, subject, body, organizationId, idempotencyKey: key }).catch((error: unknown) => {
    console.error("purge des invités : préavis non envoyé", eventId, error instanceof Error ? error.name : "inconnue");
  });
}

export type GuestPurgePass = { notices: number; dietsPurged: number; purged: number; exportsRemoved: number };

// Passage quotidien (tâche horaire) : préavis à envoyer, puis purges échues. Idempotent : une purge
// faite est notée (dietsPurgedAt, purgedAt) ; un préavis envoyé l'est aussi.
export async function runGuestPurge(organizationId: string, now: Date = new Date()): Promise<GuestPurgePass> {
  const today = parisToday(now);
  const retention = await retentionOf(organizationId);
  const noticeDays = starterGuestRules().purgeNoticeDays;
  const pass: GuestPurgePass = { notices: 0, dietsPurged: 0, purged: 0, exportsRemoved: 0 };
  for (const item of await eventsWithData(organizationId)) {
    const eventId = item.context.eventId;
    const schedule = scheduleOf(item.context, retention, item.settings, item.postponement);
    if (!schedule.dietsDueOn || !schedule.allDueOn) continue;
    const ensure = (tx: Tx) => tx.insert(eventSettings).values({ organizationId, eventId, reminderDays: [] }).onConflictDoNothing({ target: eventSettings.eventId });
    // Préavis (une fois par échéance).
    for (const [stage, dueOn, sentAt, column] of [
      ["diets", schedule.dietsDueOn, item.settings?.dietPurgeNoticeAt ?? null, "dietPurgeNoticeAt"],
      ["all", schedule.allDueOn, item.settings?.purgeNoticeAt ?? null, "purgeNoticeAt"],
    ] as const) {
      const purged = stage === "diets" ? schedule.dietsPurgedAt : schedule.purgedAt;
      if (purged || sentAt || !noticeActive(dueOn, today, noticeDays)) continue;
      await notifyOwner(organizationId, eventId, "notice", { stage, dueOn }, `guests:purge-notice:${eventId}:${stage}:${dueOn}`);
      await inOrganization(organizationId, async (tx) => {
        await ensure(tx);
        await tx.update(eventSettings).set({ [column]: now, updatedAt: now }).where(eq(eventSettings.eventId, eventId));
      });
      pass.notices += 1;
    }
    // Régimes à J+7.
    if (!schedule.dietsPurgedAt && isDue(schedule.dietsDueOn, today)) {
      await withAuditBulk(() =>
        inOrganization(organizationId, async (tx) => {
          await purgeDiets(tx, eventId);
          await ensure(tx);
          await tx.update(eventSettings).set({ dietsPurgedAt: now, updatedAt: now }).where(eq(eventSettings.eventId, eventId));
        }),
      );
      await recordAudit(appDatabase(), { organizationId, action: "guests.purge.executed", objectId: eventId, details: { stage: "diets" } });
      pass.dietsPurged += 1;
    }
    // Le reste à J+30, avec les exports stockés qui peuvent contenir ces invités.
    if (!schedule.purgedAt && isDue(schedule.allDueOn, today)) {
      const households = await withAuditBulk(() =>
        inOrganization(organizationId, async (tx) => {
          await purgeDiets(tx, eventId);
          const removed = await purgeAll(tx, eventId);
          await ensure(tx);
          await tx.update(eventSettings).set({ dietsPurgedAt: item.settings?.dietsPurgedAt ?? now, purgedAt: now, updatedAt: now }).where(eq(eventSettings.eventId, eventId));
          return removed;
        }),
      );
      let exportsRemoved = 0;
      if (item.firstHouseholdAt) {
        exportsRemoved += await purgeOrganizationExportsWithGuests(appDatabase(), organizationId, item.firstHouseholdAt, now);
        exportsRemoved += await purgePrivacyExportsSince(appDatabase(), organizationId, item.firstHouseholdAt, now);
      }
      if (exportsRemoved > 0) await notifyOwner(organizationId, eventId, "exports", { count: exportsRemoved }, `guests:purge-exports:${eventId}`);
      await recordAudit(appDatabase(), { organizationId, action: "guests.purge.executed", objectId: eventId, details: { stage: "all", households, exports: exportsRemoved } });
      pass.purged += 1;
      pass.exportsRemoved += exportsRemoved;
    }
  }
  return pass;
}

// Oppositions récentes (quatorze jours), pour prévenir la planner dans « Aujourd'hui ».
export async function listRecentOppositions(organizationId: string, now: Date = new Date()): Promise<{ eventId: string; count: number; latest: string }[]> {
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const rows = await inOrganization(organizationId, (tx) => tx.select({ eventId: guests.eventId, opposedAt: guests.opposedAt }).from(guests).where(gte(guests.opposedAt, since)));
  const byEvent = new Map<string, { count: number; latest: string }>();
  for (const row of rows) {
    const current = byEvent.get(row.eventId) ?? { count: 0, latest: "" };
    const at = row.opposedAt!.toISOString();
    byEvent.set(row.eventId, { count: current.count + 1, latest: at > current.latest ? at : current.latest });
  }
  return [...byEvent.entries()].map(([eventId, value]) => ({ eventId, ...value }));
}
