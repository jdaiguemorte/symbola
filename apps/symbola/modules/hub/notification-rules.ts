// Lot 53 (HUB-15, UX-16 ; D1, D2 ; ADR 0095) — règles pures des notifications, sans base : l'heure dans
// le fuseau de l'organisation, les plages de silence (la nuit, qui peut passer minuit ; le dimanche),
// le récapitulatif une fois par jour à l'heure réglée, et le plan d'envoi d'une notification :
// - application : gardée ou coupée ;
// - e-mail : coupé, dans le récapitulatif (sorte non immédiate, récapitulatif actif) ou à envoyer ;
// - push : coupé ou à envoyer.
// Ce qui tombe pendant le silence attend sa fin ; une sorte « jour J » passe outre le jour de son
// évènement, si la personne le garde (D2).
import type { NotificationChannel, NotificationSettingsView, NotificationType, NotificationTypeDefaults } from "@symbola/contracts";
import { starterNotifications } from "@symbola/starter-templates";

const starter = starterNotifications();

export function typeDefaults(type: NotificationType): NotificationTypeDefaults {
  const defaults = starter.types[type];
  if (!defaults) throw new RangeError(`sorte de notification inconnue : ${type}`);
  return defaults;
}

export function defaultNotificationSettings(): NotificationSettingsView {
  return { ...starter.settings };
}

export function notificationRetentionDays(): { notificationDays: number; pushSubscriptionIdleDays: number; automationRunDays: number } {
  return { ...starter.retention };
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = FORMATTERS.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    FORMATTERS.set(timeZone, found);
  }
  return found;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Jour (« AAAA-MM-JJ »), minute depuis minuit et jour de la semaine (0 = dimanche), dans le fuseau.
export function localClock(now: Date, timeZone: string): { date: string; minute: number; weekday: number } {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday ?? "Mon"] ?? 1,
  };
}

export function isQuiet(settings: NotificationSettingsView, now: Date): boolean {
  const clock = localClock(now, settings.timeZone);
  if (settings.quietSundays && clock.weekday === 0) return true;
  if (!settings.quietEnabled || settings.quietStartMinute === settings.quietEndMinute) return false;
  const { quietStartMinute: start, quietEndMinute: end } = settings;
  return start < end ? clock.minute >= start && clock.minute < end : clock.minute >= start || clock.minute < end;
}

const MINUTE_MS = 60_000;
const LOOKAHEAD_MINUTES = 3 * 24 * 60;

// Premier instant hors silence, à la minute près (le pas d'une minute suit les changements d'heure).
export function quietEndsAt(settings: NotificationSettingsView, now: Date): Date {
  let instant = new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
  for (let step = 0; step < LOOKAHEAD_MINUTES && isQuiet(settings, instant); step += 1) instant = new Date(instant.getTime() + MINUTE_MS);
  return instant;
}

// lastSentOn : jour (dans le fuseau) du dernier récapitulatif envoyé.
export function digestDue(settings: NotificationSettingsView, lastSentOn: string | null, now: Date): boolean {
  if (!settings.digestEnabled) return false;
  const clock = localClock(now, settings.timeZone);
  return clock.minute >= settings.digestHour * 60 && lastSentOn !== clock.date;
}

export type DeliveryState = { state: "none" | "pending" | "digest"; dueAt: Date | null };
export type DeliveryPlan = { inApp: boolean; email: DeliveryState; push: DeliveryState };

export function deliveryPlan(input: {
  defaults: NotificationTypeDefaults;
  preferences: { channel: NotificationChannel; enabled: boolean }[];
  settings: NotificationSettingsView;
  now: Date;
  // Le jour de l'évènement de la notification est aujourd'hui (dans le fuseau).
  eventIsToday: boolean;
}): DeliveryPlan {
  const enabled = (channel: NotificationChannel) => input.preferences.find((preference) => preference.channel === channel)?.enabled ?? input.defaults.channels[channel];
  const overrides = input.defaults.dayOf && input.eventIsToday && input.settings.dayOfOverride;
  const dueAt = !overrides && isQuiet(input.settings, input.now) ? quietEndsAt(input.settings, input.now) : input.now;
  const none: DeliveryState = { state: "none", dueAt: null };
  const email: DeliveryState = !enabled("email") ? none : !input.defaults.immediate && input.settings.digestEnabled ? { state: "digest", dueAt: null } : { state: "pending", dueAt };
  const push: DeliveryState = enabled("push") ? { state: "pending", dueAt } : none;
  return { inApp: enabled("app"), email, push };
}
