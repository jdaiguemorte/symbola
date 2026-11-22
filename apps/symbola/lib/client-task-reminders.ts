// Lot 27a (CHR-04, décision D7) — tâche horaire des rappels des tâches confiées
// au client : pour chaque organisation dont le module Événements est actif, le
// module events envoie les rappels du jour (il ne fait rien hors des heures
// d'envoi). Un seul processus applicatif par environnement (ADR 0011) : pas de
// verrou. Les journaux ne portent que des identifiants (SEC-20).
import { appDatabase } from "@symbola/db/client";
import { sendClientTaskReminders } from "@/modules/events/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";
import { automationHooks, sendTimeDue } from "./automation-gates";

// Lot 66a (D1 ; ADR 0112) : toutes les cinq minutes, pour partir à l'heure réglée.
const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

export async function sendAllClientTaskReminders(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  let sent = 0;
  for (const organization of await listOrganizations(db)) {
    // Lot 66a (D1 ; ADR 0112) : à l'heure d'envoi de l'automatisme ; sinon, rien n'est lu.
    if (!(await sendTimeDue(organization.id, "client_task_reminder", now))) continue;
    if (!(await isModuleEnabled(db, organization.id, "events"))) continue;
    try {
      // Lot 53 (HUB-28, D5) : coupé, l'automatisme n'envoie rien ; remis en route, il ne rattrape rien.
      const hooks = await automationHooks(organization.id, "client_task_reminder", now);
      if (!hooks) continue;
      sent += await sendClientTaskReminders(organization.id, now, hooks);
    } catch (error) {
      console.error(`rappels des tâches échoués (organisation ${organization.id})`, error instanceof Error ? error.message : error);
    }
  }
  return sent;
}

export function scheduleClientTaskReminders(): void {
  const run = () => {
    sendAllClientTaskReminders().catch((error: unknown) => {
      console.error("rappels des tâches échoués", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, REMINDER_INTERVAL_MS).unref();
}
