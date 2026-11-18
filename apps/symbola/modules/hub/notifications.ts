// Lot 53 (HUB-15, UX-16, ARC-09 ; D1 à D4 ; ADR 0095, ADR 0096) — notifications de l'équipe, dans le hub.
// Exposé seulement par service.ts (ADR 0011).
//
// - Un module signale un fait (notify) : une notification par destinataire, une seule fois par objet
//   (object_key), avec l'écran où agir (UX-16 : chaque notification mène à une action).
// - Destinataire (D3) : le planner principal de l'évènement (lot 52) ; d'ici sa fusion, et pour une
//   notification sans évènement, la Propriétaire (chaque adhésion « owner » active).
// - Chaque personne règle chaque sorte par canal (HUB-15), son récapitulatif et ses plages de silence
//   (notification-rules.ts). L'envoi part de la tâche périodique (lib/notification-jobs.ts).
// - Rien de personnel dans un push ni dans l'objet d'un e-mail : la sorte seulement (SEC-20).
import { and, asc, count, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { notificationPreferences, notifications, notificationSettings, pushSubscriptions, users } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { formatAmount } from "@symbola/i18n";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  notificationParamsSchema,
  notificationSettingsSchema,
  pushSubscriptionSchema,
  type NotificationChannel,
  type NotificationParams,
  type NotificationPreferenceView,
  type NotificationSettingsView,
  type NotificationType,
  type NotificationView,
  type PushDeviceView,
  type PushMessage,
} from "@symbola/contracts";
import { sendOrganizationEmail } from "./emails";
import { defaultNotificationSettings, deliveryPlan, digestDue, localClock, notificationRetentionDays, typeDefaults } from "./notification-rules";
import { getPushSender } from "./push";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Locale = "fr" | "en";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class NotificationInputError extends Error {
  constructor(readonly reason: "type" | "channel" | "href" | "params" | "settings" | "subscription") {
    super("réglage de notification refusé");
    this.name = "NotificationInputError";
  }
}

function assertType(type: string): asserts type is NotificationType {
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) throw new NotificationInputError("type");
}

// Un chemin interne de l'app, jamais une adresse extérieure.
function assertHref(href: string): void {
  if (!/^\/[^/\\]/.test(href) || href.length > 500) throw new NotificationInputError("href");
}

// --- Destinataires (D3) ---

// Lot 52 : le planner principal de l'évènement, quand il existera (service events), passera avant la
// Propriétaire. D'ici là, la Propriétaire reçoit tout.
export async function notificationRecipients(organizationId: string): Promise<string[]> {
  const team = await listTeam(appDatabase(), organizationId);
  return team.filter((member) => member.role === "owner" && !member.disabledAt).map((member) => member.id);
}

// --- Réglages d'une personne ---

async function settingsOf(tx: Tx, organizationId: string, userId: string): Promise<NotificationSettingsView & { digestSentOn: string | null }> {
  const [row] = await tx.select().from(notificationSettings).where(and(eq(notificationSettings.organizationId, organizationId), eq(notificationSettings.userId, userId)));
  if (!row) return { ...defaultNotificationSettings(), digestSentOn: null };
  return {
    digestEnabled: row.digestEnabled,
    digestHour: row.digestHour,
    quietEnabled: row.quietEnabled,
    quietStartMinute: row.quietStartMinute,
    quietEndMinute: row.quietEndMinute,
    quietSundays: row.quietSundays,
    dayOfOverride: row.dayOfOverride,
    timeZone: row.timeZone,
    digestSentOn: row.digestSentOn,
  };
}

export async function getNotificationSettings(organizationId: string, userId: string): Promise<NotificationSettingsView> {
  const settings = await inOrganization(organizationId, (tx) => settingsOf(tx, organizationId, userId));
  return { digestEnabled: settings.digestEnabled, digestHour: settings.digestHour, quietEnabled: settings.quietEnabled, quietStartMinute: settings.quietStartMinute, quietEndMinute: settings.quietEndMinute, quietSundays: settings.quietSundays, dayOfOverride: settings.dayOfOverride, timeZone: settings.timeZone };
}

export async function saveNotificationSettings(organizationId: string, userId: string, input: unknown): Promise<NotificationSettingsView> {
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) throw new NotificationInputError("settings");
  const values = parsed.data;
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(notificationSettings)
      .values({ organizationId, userId, ...values, timeZone: defaultNotificationSettings().timeZone })
      .onConflictDoUpdate({ target: [notificationSettings.organizationId, notificationSettings.userId], set: { ...values, updatedAt: new Date() } });
  });
  return getNotificationSettings(organizationId, userId);
}

// Le tableau complet : chaque sorte, chaque canal, le réglage de la personne ou celui de départ.
export async function getNotificationPreferences(organizationId: string, userId: string): Promise<NotificationPreferenceView[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select({ type: notificationPreferences.type, channel: notificationPreferences.channel, enabled: notificationPreferences.enabled }).from(notificationPreferences).where(and(eq(notificationPreferences.organizationId, organizationId), eq(notificationPreferences.userId, userId))),
  );
  return NOTIFICATION_TYPES.flatMap((type) =>
    NOTIFICATION_CHANNELS.map((channel) => ({ type, channel, enabled: rows.find((row) => row.type === type && row.channel === channel)?.enabled ?? typeDefaults(type).channels[channel] })),
  );
}

export async function setNotificationPreference(organizationId: string, userId: string, input: { type: string; channel: string; enabled: boolean }): Promise<void> {
  assertType(input.type);
  if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(input.channel)) throw new NotificationInputError("channel");
  const type = input.type;
  const channel = input.channel as NotificationChannel;
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(notificationPreferences)
      .values({ organizationId, userId, type, channel, enabled: input.enabled })
      .onConflictDoUpdate({ target: [notificationPreferences.organizationId, notificationPreferences.userId, notificationPreferences.type, notificationPreferences.channel], set: { enabled: input.enabled, updatedAt: new Date() } });
  });
}

// --- Signaler un fait ---

export type NotifyInput = {
  organizationId: string;
  type: NotificationType;
  eventId: string | null;
  // L'objet : une seule notification par personne, sorte et objet.
  objectKey: string;
  params?: NotificationParams;
  href: string;
  // Le jour de l'évènement (« AAAA-MM-JJ »), pour les alertes du jour J (D2).
  eventDate?: string | null;
  isDemo?: boolean;
  // Destinataires choisis par l'appelant ; sinon ceux de D3.
  userIds?: string[];
  now?: Date;
};

// Nombre de notifications créées (0 : déjà signalé, sorte coupée partout, ou évènement d'essai).
export async function notify(input: NotifyInput): Promise<number> {
  assertType(input.type);
  assertHref(input.href);
  if (input.isDemo) return 0;
  const params = notificationParamsSchema.safeParse(input.params ?? {});
  if (!params.success || input.objectKey.length < 1 || input.objectKey.length > 200) throw new NotificationInputError("params");
  if (input.eventId !== null && !UUID.test(input.eventId)) throw new NotificationInputError("params");
  const now = input.now ?? new Date();
  const recipients = input.userIds ?? (await notificationRecipients(input.organizationId));
  if (recipients.length === 0) return 0;
  return inOrganization(input.organizationId, async (tx) => {
    let created = 0;
    for (const userId of recipients) {
      const settings = await settingsOf(tx, input.organizationId, userId);
      const preferences = await tx
        .select({ channel: notificationPreferences.channel, enabled: notificationPreferences.enabled })
        .from(notificationPreferences)
        .where(and(eq(notificationPreferences.organizationId, input.organizationId), eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, input.type)));
      const plan = deliveryPlan({ defaults: typeDefaults(input.type), preferences, settings, now, eventIsToday: Boolean(input.eventDate) && input.eventDate === localClock(now, settings.timeZone).date });
      if (!plan.inApp && plan.email.state === "none" && plan.push.state === "none") continue;
      const inserted = await tx
        .insert(notifications)
        .values({
          organizationId: input.organizationId,
          userId,
          type: input.type,
          eventId: input.eventId,
          objectKey: input.objectKey,
          params: params.data,
          href: input.href,
          inApp: plan.inApp,
          emailState: plan.email.state,
          emailDueAt: plan.email.dueAt,
          pushState: plan.push.state,
          pushDueAt: plan.push.dueAt,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      created += inserted.length;
    }
    return created;
  });
}

// --- Centre de notifications ---

function toView(row: typeof notifications.$inferSelect): NotificationView {
  return { id: row.id, type: row.type, eventId: row.eventId, params: row.params, href: row.href, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null };
}

export async function listNotifications(organizationId: string, userId: string, options: { unreadOnly?: boolean } = {}): Promise<NotificationView[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), eq(notifications.inApp, true), options.unreadOnly ? isNull(notifications.readAt) : undefined))
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE),
  );
  return rows.map(toView);
}

export async function countUnreadNotifications(organizationId: string, userId: string): Promise<number> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), eq(notifications.inApp, true), isNull(notifications.readAt))),
  );
  return row?.total ?? 0;
}

// Lue : elle ne part plus par push ni par e-mail immédiat (la personne l'a vue). Rien pour une
// notification d'un autre compte : elle n'existe pas pour celui-ci.
export async function markNotificationRead(organizationId: string, userId: string, notificationId: string, now: Date = new Date()): Promise<NotificationView | null> {
  if (!UUID.test(notificationId)) return null;
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .update(notifications)
      .set({
        readAt: sql`coalesce(${notifications.readAt}, ${now.toISOString()}::timestamptz)`,
        pushState: sql`case when ${notifications.pushState} = 'pending' then 'skipped' else ${notifications.pushState} end`,
        emailState: sql`case when ${notifications.emailState} = 'pending' then 'skipped' else ${notifications.emailState} end`,
        updatedAt: now,
      })
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), eq(notifications.id, notificationId)))
      .returning(),
  );
  return row ? toView(row) : null;
}

export async function markAllNotificationsRead(organizationId: string, userId: string, now: Date = new Date()): Promise<number> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .update(notifications)
      .set({
        readAt: now,
        pushState: sql`case when ${notifications.pushState} = 'pending' then 'skipped' else ${notifications.pushState} end`,
        emailState: sql`case when ${notifications.emailState} = 'pending' then 'skipped' else ${notifications.emailState} end`,
        updatedAt: now,
      })
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id }),
  );
  return rows.length;
}

// --- Abonnements push (ARC-09, D4) ---

export async function savePushSubscription(organizationId: string, userId: string, input: unknown, deviceLabel: string, now: Date = new Date()): Promise<PushDeviceView> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) throw new NotificationInputError("subscription");
  const label = deviceLabel.trim().slice(0, 80) || "?";
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .insert(pushSubscriptions)
      .values({ organizationId, userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, deviceLabel: label, lastUsedAt: now })
      // Un même navigateur réabonné (autre compte compris) : l'abonnement passe au compte connecté.
      .onConflictDoUpdate({ target: [pushSubscriptions.organizationId, pushSubscriptions.endpoint], set: { userId, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, deviceLabel: label, lastUsedAt: now, updatedAt: now } })
      .returning(),
  );
  return { id: row!.id, label: row!.deviceLabel, createdAt: row!.createdAt.toISOString(), lastUsedAt: row!.lastUsedAt?.toISOString() ?? null };
}

export async function listPushDevices(organizationId: string, userId: string): Promise<PushDeviceView[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId, organizationId), eq(pushSubscriptions.userId, userId))).orderBy(asc(pushSubscriptions.createdAt)),
  );
  return rows.map((row) => ({ id: row.id, label: row.deviceLabel, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null }));
}

// Désactiver un appareil : l'abonnement est supprimé (DPO-10).
export async function removePushDevice(organizationId: string, userId: string, input: { id?: string; endpoint?: string }): Promise<number> {
  if (input.id && !UUID.test(input.id)) return 0;
  const target = input.id ? eq(pushSubscriptions.id, input.id) : input.endpoint ? eq(pushSubscriptions.endpoint, input.endpoint) : null;
  if (!target) return 0;
  const rows = await inOrganization(organizationId, (tx) =>
    tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId, organizationId), eq(pushSubscriptions.userId, userId), target)).returning({ id: pushSubscriptions.id }),
  );
  return rows.length;
}

export function pushPublicKey(): string {
  return parseEnv(process.env).VAPID_PUBLIC_KEY;
}

// --- Mots des notifications ---

// Un paramètre manquant (notification d'avant un changement de texte) ne casse ni l'écran ni l'envoi :
// le texte retombe sur la sorte.
const MISSING = "\u0000";
function translatorFor(locale: Locale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Notifications", onError: () => undefined, getMessageFallback: () => MISSING });
}

function riskTranslatorFor(locale: Locale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "RiskRadar", onError: () => undefined, getMessageFallback: () => MISSING });
}

// La sorte seule (objet d'un e-mail, titre d'un push) : jamais de donnée personnelle.
export function notificationTypeLabel(type: NotificationType, locale: Locale): string {
  return translatorFor(locale)(`types.${type}.label`);
}

// La phrase complète (centre, corps d'un e-mail), avec ses libellés courts.
export function notificationText(view: Pick<NotificationView, "type" | "params">, locale: Locale): string {
  // Un montant est gardé en centimes et écrit dans la langue de la personne.
  // Les nombres restent des nombres (accord « jour » ou « jours »).
  const params: Record<string, string | number> = Object.fromEntries(Object.entries(view.params).map(([key, value]) => (key === "amountCents" && typeof value === "number" ? ["amount", formatAmount(value, locale)] : [key, value])));
  if (view.type === "risk_alert" && typeof view.params.rule === "string") {
    const risk = riskTranslatorFor(locale);
    const summary = risk(`rules.${view.params.rule}.alert` as "rules.vendor_without_contract.alert", params);
    return summary === MISSING ? notificationTypeLabel(view.type, locale) : translatorFor(locale)("types.risk_alert.text", { summary });
  }
  const text = translatorFor(locale)(`types.${view.type}.text`, params);
  return text === MISSING ? notificationTypeLabel(view.type, locale) : text;
}

export function notificationActionLabel(type: NotificationType, locale: Locale): string {
  return translatorFor(locale)(`types.${type}.action`);
}

async function userLocales(userIds: string[]): Promise<Map<string, { email: string; locale: Locale }>> {
  if (userIds.length === 0) return new Map();
  const rows = await appDatabase().select({ id: users.id, email: users.email, language: users.language }).from(users).where(inArray(users.id, userIds));
  return new Map(rows.map((row) => [row.id, { email: row.email, locale: row.language === "en" ? "en" : "fr" }]));
}

function absolute(href: string): string {
  return `${parseEnv(process.env).APP_PUBLIC_URL}${href}`;
}

// --- Envoi (tâche périodique) ---

// Les e-mails immédiats et les push dus à cet instant ; une panne d'envoi est reprise par la file des
// e-mails (lot 40b) ou abandonnée pour un push (il n'aurait plus de sens des heures plus tard).
export async function deliverDueNotifications(organizationId: string, now: Date = new Date()): Promise<{ emails: number; pushes: number }> {
  const due = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          isNull(notifications.readAt),
          or(and(eq(notifications.emailState, "pending"), lte(notifications.emailDueAt, now)), and(eq(notifications.pushState, "pending"), lte(notifications.pushDueAt, now))),
        ),
      )
      .orderBy(asc(notifications.createdAt))
      .limit(200),
  );
  if (due.length === 0) return { emails: 0, pushes: 0 };
  const people = await userLocales([...new Set(due.map((row) => row.userId))]);
  let emails = 0;
  let pushes = 0;
  for (const row of due) {
    const person = people.get(row.userId);
    const view = toView(row);
    if (row.emailState === "pending" && row.emailDueAt && row.emailDueAt <= now) {
      let state: "sent" | "skipped" = "skipped";
      if (person) {
        try {
          await sendOrganizationEmail({
            organizationId,
            to: person.email,
            kind: "notification_alert",
            locale: person.locale,
            values: { alert: notificationText(view, person.locale), link: absolute(row.href) },
            idempotencyKey: `notification:${row.id}`,
          });
          state = "sent";
          emails += 1;
        } catch (error) {
          console.error(`alerte non envoyée (notification ${row.id})`, error instanceof Error ? error.name : "inconnue");
        }
      }
      await inOrganization(organizationId, (tx) => tx.update(notifications).set({ emailState: state, updatedAt: now }).where(eq(notifications.id, row.id)));
    }
    if (row.pushState === "pending" && row.pushDueAt && row.pushDueAt <= now) {
      const sent = person ? await pushToUser(organizationId, row.userId, { title: notificationTypeLabel(row.type, person.locale), body: notificationActionLabel(row.type, person.locale), url: row.href, tag: `${row.type}:${row.id}` }, now) : 0;
      pushes += sent;
      await inOrganization(organizationId, (tx) => tx.update(notifications).set({ pushState: sent > 0 ? "sent" : "skipped", updatedAt: now }).where(eq(notifications.id, row.id)));
    }
  }
  return { emails, pushes };
}

// Chaque appareil de la personne ; un abonnement disparu chez le service de push est supprimé.
export async function pushToUser(organizationId: string, userId: string, message: PushMessage, now: Date = new Date()): Promise<number> {
  const devices = await inOrganization(organizationId, (tx) => tx.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId, organizationId), eq(pushSubscriptions.userId, userId))));
  let sent = 0;
  for (const device of devices) {
    const outcome = await getPushSender().send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, message);
    if (outcome === "sent") {
      sent += 1;
      await inOrganization(organizationId, (tx) => tx.update(pushSubscriptions).set({ lastUsedAt: now, updatedAt: now }).where(eq(pushSubscriptions.id, device.id)));
    } else if (outcome === "gone") {
      await inOrganization(organizationId, (tx) => tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id)));
    }
  }
  return sent;
}

// --- Récapitulatif du matin (D1) ---

// extraLines : ce qui attend aujourd'hui (tâches, risques), tiré des autres modules par l'appelant,
// dans la langue de la personne. Un récapitulatif vide ne part pas ; le jour compte quand même.
export async function sendDueDigests(organizationId: string, extraLines: (userId: string, locale: Locale) => Promise<string[]>, now: Date = new Date()): Promise<number> {
  const recipients = new Set(await notificationRecipients(organizationId));
  const known = await inOrganization(organizationId, (tx) => tx.select({ userId: notificationSettings.userId }).from(notificationSettings).where(eq(notificationSettings.organizationId, organizationId)));
  for (const row of known) recipients.add(row.userId);
  const people = await userLocales([...recipients]);
  let sent = 0;
  for (const userId of recipients) {
    const person = people.get(userId);
    if (!person) continue;
    const settings = await inOrganization(organizationId, (tx) => settingsOf(tx, organizationId, userId));
    if (!digestDue(settings, settings.digestSentOn, now)) continue;
    const today = localClock(now, settings.timeZone).date;
    const pending = await inOrganization(organizationId, (tx) =>
      tx
        .select()
        .from(notifications)
        .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), eq(notifications.emailState, "digest")))
        .orderBy(asc(notifications.createdAt))
        .limit(100),
    );
    const lines = [...pending.filter((row) => !row.readAt).map((row) => `- ${notificationText(toView(row), person.locale)}`), ...(await extraLines(userId, person.locale)).map((line) => `- ${line}`)];
    if (lines.length > 0) {
      try {
        await sendOrganizationEmail({
          organizationId,
          to: person.email,
          kind: "daily_digest",
          locale: person.locale,
          values: { digest: lines.join("\n"), link: absolute("/") },
          idempotencyKey: `digest:${userId}:${today}`,
        });
        sent += 1;
      } catch (error) {
        console.error(`récapitulatif non envoyé (compte ${userId})`, error instanceof Error ? error.name : "inconnue");
        continue;
      }
    }
    await inOrganization(organizationId, async (tx) => {
      if (pending.length > 0) await tx.update(notifications).set({ emailState: "sent", updatedAt: now }).where(inArray(notifications.id, pending.map((row) => row.id)));
      await tx
        .insert(notificationSettings)
        .values({ organizationId, userId, ...defaultNotificationSettings(), digestSentOn: today })
        .onConflictDoUpdate({ target: [notificationSettings.organizationId, notificationSettings.userId], set: { digestSentOn: today, updatedAt: now } });
    });
  }
  return sent;
}

// --- Purge (DPO-10) ---

export async function purgeNotifications(organizationId: string, now: Date = new Date()): Promise<{ notifications: number; devices: number }> {
  const retention = notificationRetentionDays();
  const day = 24 * 60 * 60 * 1000;
  return inOrganization(organizationId, async (tx) => {
    const removed = await tx
      .delete(notifications)
      .where(and(eq(notifications.organizationId, organizationId), lt(notifications.createdAt, new Date(now.getTime() - retention.notificationDays * day))))
      .returning({ id: notifications.id });
    const idleSince = new Date(now.getTime() - retention.pushSubscriptionIdleDays * day);
    const devices = await tx
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.organizationId, organizationId), sql`coalesce(${pushSubscriptions.lastUsedAt}, ${pushSubscriptions.createdAt}) < ${idleSince.toISOString()}::timestamptz`))
      .returning({ id: pushSubscriptions.id });
    return { notifications: removed.length, devices: devices.length };
  });
}
