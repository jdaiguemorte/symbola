// Lot 66b (JRJ-01, HUB-28 ; D2 à D4 ; ADR 0112) — tâche périodique du rappel du jour J, toutes les cinq
// minutes, derrière le verrou des tâches périodiques. Pour chaque organisation, ses réglages (par cible,
// remplacés par ceux d'un évènement) et ses évènements des jours proches sont gardés une demi-heure : la
// base n'est lue pour envoyer que lorsqu'un rappel est dû (la veille ou le matin même, à l'heure, dans le
// fuseau de l'évènement ; rattrapage le jour même). Envoyé par Symbola (D4), une fois par personne et par
// évènement (clé de la file des e-mails). Journaux : des identifiants seulement.
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import type { DayReminderSetting, DayReminderTarget } from "@symbola/contracts";
import { starterSending } from "@symbola/starter-templates";
import { listDayReminderEvents, listDayReminderOverrides, listDayReminderVendorsWithoutLink, sendDayReminder, type DayReminderEvent } from "@/modules/events/service";
import { dayReminderDue, effectiveDayReminder, isModuleEnabled, listDayReminderTargets, listOrganizations } from "@/modules/hub/service";
import { getVendorContacts } from "@/modules/vendors/service";
import { automationHooks } from "./automation-gates";

const INTERVAL_MS = 5 * 60 * 1000;
const CACHE_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Plan = { until: number; events: (DayReminderEvent & { settings: DayReminderSetting[] })[] };
const plans = new Map<string, Plan>();
const done = new Set<string>();

// Après un réglage (organisation ou évènement), ou pour les tests : relire au prochain passage.
export function forgetDayReminders(organizationId?: string): void {
  if (organizationId) plans.delete(organizationId);
  else {
    plans.clear();
    done.clear();
  }
}

function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

async function planOf(organizationId: string, now: Date): Promise<Plan> {
  const known = plans.get(organizationId);
  if (known && now.getTime() < known.until) return known;
  const today = parisToday(now);
  // Un fuseau lointain décale le jour : un jour de marge de chaque côté.
  const [organization, events] = await Promise.all([listDayReminderTargets(organizationId), listDayReminderEvents(organizationId, shiftDate(today, -1), shiftDate(today, 2))]);
  const withSettings = await Promise.all(events.map(async (event) => ({ ...event, settings: effectiveDayReminder(organization, await listDayReminderOverrides(organizationId, event.id)) })));
  // Durée tirée entre la moitié et une fois et demie (NFR-02 : pas de rafale de relectures).
  const plan = { until: now.getTime() + CACHE_MS * (0.5 + Math.random()), events: withSettings };
  plans.set(organizationId, plan);
  return plan;
}

// organizationIds : pour les tests, les seules organisations à passer.
export async function runDayReminders(now: Date = new Date(), organizationIds?: string[]): Promise<{ sent: number }> {
  const { catchUpHours } = starterSending();
  let sent = 0;
  const organizations = organizationIds ? organizationIds.map((id) => ({ id })) : await listOrganizations(appDatabase());
  for (const organization of organizations) {
    try {
      const plan = await planOf(organization.id, now);
      const due: { event: DayReminderEvent; target: DayReminderTarget }[] = [];
      for (const event of plan.events) {
        for (const setting of event.settings) {
          const key = `${event.id}:${setting.target}:${event.eventDate}`;
          if (done.has(key)) continue;
          if (dayReminderDue({ setting, eventDate: event.eventDate, timeZone: event.timeZone, now, catchUpHours })) due.push({ event, target: setting.target });
        }
      }
      if (due.length === 0) continue;
      if (!(await isModuleEnabled(appDatabase(), organization.id, "events"))) continue;
      const hooks = await automationHooks(organization.id, "day_reminder", now);
      if (!hooks) continue;
      const vendorsOpen = await isModuleEnabled(appDatabase(), organization.id, "vendors");
      await withActor(SYSTEM_ACTOR, async () => {
        for (const { event, target } of due) {
          let extraVendors: { candidateId: string; vendorSlotId: string; email: string; name: string }[] = [];
          if (target === "vendors" && vendorsOpen) {
            const missing = await listDayReminderVendorsWithoutLink(organization.id, event.id, now);
            const contacts = await getVendorContacts(organization.id, missing.map((vendor) => vendor.vendorId));
            extraVendors = missing.flatMap((vendor) => {
              const contact = contacts.find((candidate) => candidate.id === vendor.vendorId);
              return contact?.email ? [{ candidateId: vendor.candidateId, vendorSlotId: vendor.vendorSlotId, email: contact.email, name: contact.contactName ?? contact.name }] : [];
            });
          }
          const count = await sendDayReminder({ organizationId: organization.id, eventId: event.id, target, now, extraVendors });
          done.add(`${event.id}:${target}:${event.eventDate}`);
          sent += count;
          if (count > 0) await hooks.onRun?.({ objectKey: `${event.id}:${target}`, objectLabel: String(count), href: `/events/${event.id}?onglet=programme`, result: "sent" });
        }
      });
    } catch (error) {
      console.error("rappel du jour J échoué", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return { sent };
}

export function scheduleDayReminders(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runDayReminders()
      .catch((error: unknown) => {
        console.error("rappel du jour J échoué", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}

