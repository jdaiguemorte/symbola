// Lot 27a (CHR-04, décision D7) — tâche horaire des rappels des tâches confiées
// au client : pour chaque organisation dont le module Événements est actif, le
// module events envoie les rappels du jour (il ne fait rien hors des heures
// d'envoi). Un seul processus applicatif par environnement (ADR 0011) : pas de
// verrou. Les journaux ne portent que des identifiants (SEC-20).
import { appDatabase } from "@symbola/db/client";
import { sendClientTaskReminders } from "@/modules/events/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function sendAllClientTaskReminders(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  let sent = 0;
  for (const organization of await listOrganizations(db)) {
    if (!(await isModuleEnabled(db, organization.id, "events"))) continue;
    try {
      sent += await sendClientTaskReminders(organization.id, now);
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
