// Lot 53 (HUB-28 ; D5 ; ADR 0095) — l'interrupteur et le journal d'un automatisme, pour les tâches
// périodiques qui le lancent : null s'il est coupé (rien ne part) ; sinon, ce que reçoit le module
// (AutomationHooks) : le jour de la remise en route (un envoi prévu avant ne part pas, rien n'est
// rattrapé) et la trace de chaque exécution dans le journal de l'automatisme.
// Lot 66a (HUB-28, CHR-05 ; D1 ; ADR 0112) : l'heure d'envoi. Les tâches passent toutes les cinq
// minutes ; sendTimeDue dit si un automatisme d'une organisation doit passer maintenant (son heure est
// venue dans le fuseau de Paris ou d'un de ses évènements à venir ; à la première occasion, puis au plus
// une fois par heure pendant le rattrapage), sans lire la base hors de ces moments : les heures et les
// fuseaux de chaque organisation sont gardés une demi-heure (relus aussitôt après un réglage, par
// forgetSendTimes). isSendTime, remis au module, vérifie l'heure dans le fuseau de chaque évènement.
import { parisToday } from "@symbola/i18n";
import { SEND_TIME_AUTOMATIONS, type AutomationHooks, type AutomationKey } from "@symbola/contracts";
import { starterSending } from "@symbola/starter-templates";
import { listUpcomingEventTimeZones } from "@/modules/events/service";
import { getAutomationGate, getDefaultSendTime, listAutomationGates, recordAutomationRun, sendWindowOpen } from "@/modules/hub/service";

const PARIS = "Europe/Paris";
const SEND_TIMES_TTL_MS = 30 * 60_000;
const PASS_EVERY_MS = 60 * 60_000;

type SendTimes = { until: number; defaultTime: string; byKey: Map<AutomationKey, string>; timeZones: string[] };
const sendTimesCache = new Map<string, SendTimes>();
const lastPassAt = new Map<string, number>();
const lastRunAt = new Map<string, number>();

function sendsAtFixedTime(key: AutomationKey): boolean {
  return (SEND_TIME_AUTOMATIONS as readonly string[]).includes(key);
}

// Après un réglage de l'heure (ou pour les tests) : relire au prochain passage.
export function forgetSendTimes(organizationId?: string): void {
  if (organizationId) sendTimesCache.delete(organizationId);
  else {
    sendTimesCache.clear();
    lastRunAt.clear();
  }
  for (const key of [...lastPassAt.keys()]) if (!organizationId || key.startsWith(`${organizationId}:`)) lastPassAt.delete(key);
}

async function sendTimesOf(organizationId: string, now: Date): Promise<SendTimes> {
  const cached = sendTimesCache.get(organizationId);
  if (cached && now.getTime() < cached.until) return cached;
  const [defaultTime, gates, eventZones] = await Promise.all([getDefaultSendTime(organizationId), listAutomationGates(organizationId), listUpcomingEventTimeZones(organizationId, parisToday(now)).catch(() => [])]);
  const byKey = new Map<AutomationKey, string>(gates.map((gate) => [gate.key, gate.sendTime ?? defaultTime]));
  // Une durée tirée entre la moitié et une fois et demie : les relectures des organisations ne
  // tombent pas toutes au même passage (une rafale de requêtes pendant les pages, NFR-02).
  const fresh = { until: now.getTime() + SEND_TIMES_TTL_MS * (0.5 + Math.random()), defaultTime, byKey, timeZones: [...new Set([PARIS, ...eventZones])] };
  sendTimesCache.set(organizationId, fresh);
  return fresh;
}

// L'heure qui s'applique à un automatisme (la sienne, ou l'heure par défaut).
export async function effectiveSendTime(organizationId: string, key: AutomationKey, now: Date = new Date()): Promise<string> {
  return (await sendTimesOf(organizationId, now)).byKey.get(key) ?? starterSending().defaultSendTime;
}

async function windowPass(organizationId: string, passKey: string, sendTimeOf: (times: SendTimes) => string, now: Date): Promise<boolean> {
  const last = lastPassAt.get(passKey);
  // Déjà passé dans l'heure (un réglage de l'heure efface la trace, forgetSendTimes).
  if (last !== undefined && now.getTime() - last < PASS_EVERY_MS) return false;
  const times = await sendTimesOf(organizationId, now);
  const sendTime = sendTimeOf(times);
  const { catchUpHours } = starterSending();
  const open = times.timeZones.some((timeZone) => sendWindowOpen({ now, sendTime, catchUpHours, timeZone }));
  if (open) lastPassAt.set(passKey, now.getTime());
  return open;
}

export async function sendTimeDue(organizationId: string, key: AutomationKey, now: Date = new Date()): Promise<boolean> {
  if (!sendsAtFixedTime(key)) return true;
  return windowPass(organizationId, `${organizationId}:${key}`, (times) => times.byKey.get(key) ?? times.defaultTime, now);
}

// Les envois sans interrupteur (RIB du 8e jour, relance du brief) : à l'heure par défaut de
// l'organisation. null : pas maintenant ; sinon, la vérification de l'heure pour chaque évènement.
export async function defaultSendTimeCheck(organizationId: string, now: Date = new Date()): Promise<AutomationHooks["isSendTime"] | null> {
  if (!(await windowPass(organizationId, `${organizationId}:default`, (times) => times.defaultTime, now))) return null;
  const sendTime = (await sendTimesOf(organizationId, now)).defaultTime;
  const { catchUpHours } = starterSending();
  return (at: Date, timeZone?: string) => sendWindowOpen({ now: at, sendTime, catchUpHours, timeZone: timeZone ?? PARIS });
}

// Une partie d'une tâche qui garde son propre rythme (purge horaire, passage de la nuit) alors que la
// tâche passe toutes les cinq minutes : vrai au plus une fois par période, par organisation.
export function oncePer(periodMs: number, key: string, now: Date = new Date()): boolean {
  const last = lastRunAt.get(key);
  if (last !== undefined && now.getTime() - last < periodMs) return false;
  lastRunAt.set(key, now.getTime());
  return true;
}

export async function automationHooks(organizationId: string, key: AutomationKey, now: Date = new Date()): Promise<AutomationHooks | null> {
  const gate = await getAutomationGate(organizationId, key);
  if (!gate.enabled) return null;
  const sendTime = sendsAtFixedTime(key) ? await effectiveSendTime(organizationId, key, now) : null;
  const { catchUpHours } = starterSending();
  return {
    notBefore: gate.resumedAt ? parisToday(gate.resumedAt) : null,
    onRun: async (run) => {
      try {
        await recordAutomationRun(organizationId, key, { ...run, ranAt: now });
      } catch (error) {
        // La trace ne doit jamais arrêter un envoi déjà parti.
        console.error(`journal de l'automatisme ${key} non écrit`, error instanceof Error ? error.name : "inconnue");
      }
    },
    ...(sendTime ? { isSendTime: (at: Date, timeZone?: string) => sendWindowOpen({ now: at, sendTime, catchUpHours, timeZone: timeZone ?? PARIS }) } : {}),
  };
}
