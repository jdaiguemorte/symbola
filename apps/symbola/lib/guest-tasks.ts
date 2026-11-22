// Lot 49 (INV-04, RGP-08 ; D9, D10 ; ADR 0056, 0083) — tâche horaire du module Invités : pour
// chaque organisation où les modules Évènements et Invités sont ouverts, la purge des données
// d'invités échues (avec ses préavis) puis les relances du jour (le module ne fait rien hors des
// heures d'envoi). Lancée par instrumentation.ts, derrière le verrou des tâches périodiques
// (ADR 0076). Les journaux ne portent que des identifiants (SEC-20).
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { runGuestPurge, sendGuestReminders, type InvitationWords } from "@/modules/guests/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";
import { automationHooks, oncePer, sendTimeDue } from "./automation-gates";

// Lot 66a (D1 ; ADR 0112) : toutes les cinq minutes, pour partir à l'heure réglée ; la purge, toutes les
// heures.
const INTERVAL_MS = 5 * 60 * 1000;
const PURGE_EVERY_MS = 60 * 60 * 1000;

// « mariage » ou « évènement » dans les e-mails des invités, dans la langue de chaque foyer.
export function invitationWords(): InvitationWords {
  const fr = createTranslator({ locale: "fr", messages: frMessages, namespace: "Guests.emailWords" });
  const en = createTranslator({ locale: "en", messages: enMessages, namespace: "Guests.emailWords" });
  return { wedding: { fr: fr("wedding"), en: en("wedding") }, event: { fr: fr("event"), en: en("event") } };
}

export async function runGuestTasks(now: Date = new Date()): Promise<{ purged: number; reminders: number }> {
  const db = appDatabase();
  const words = invitationWords();
  let purged = 0;
  let reminders = 0;
  for (const organization of await listOrganizations(db)) {
    // Lot 66a (D1 ; ADR 0112) : la purge garde son rythme horaire ; les relances partent à l'heure
    // d'envoi de l'automatisme. Ni l'une ni l'autre maintenant : rien n'est lu.
    const purgeDue = oncePer(PURGE_EVERY_MS, `guests-purge:${organization.id}`, now);
    const remindersDue = await sendTimeDue(organization.id, "rsvp_reminder", now);
    if (!purgeDue && !remindersDue) continue;
    if (!(await isModuleEnabled(db, organization.id, "guests")) || !(await isModuleEnabled(db, organization.id, "events"))) continue;
    try {
      await withActor(SYSTEM_ACTOR, async () => {
        if (purgeDue) {
          const pass = await runGuestPurge(organization.id, now);
          purged += pass.dietsPurged + pass.purged;
        }
        // Lot 53 (HUB-28, D5) : la purge ne se coupe pas ; les relances, si.
        const hooks = remindersDue ? await automationHooks(organization.id, "rsvp_reminder", now) : null;
        if (hooks) reminders += await sendGuestReminders(organization.id, words, now, hooks);
      });
    } catch (error) {
      console.error("tâches des invités échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return { purged, reminders };
}

export function scheduleGuestTasks(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runGuestTasks()
      .catch((error: unknown) => {
        console.error("tâches des invités échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
