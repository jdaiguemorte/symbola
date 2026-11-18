// Lot 46 (RDV-02, RDV-03 ; D2, D10 ; ADR 0082) — tâches périodiques du module Rendez-vous, pour chaque
// organisation qui l'a ouvert : relire les agendas extérieurs dont la lecture a quinze minutes, puis
// envoyer les rappels dus (clé d'unicité par rendez-vous et par rappel : un passage rejoué n'envoie
// rien de plus). Lancé par instrumentation.ts, derrière le verrou des tâches périodiques. Les
// journaux ne portent que des identifiants (SEC-20).
import { appDatabase } from "@symbola/db/client";
import { refreshDueCalendarSources, sendDueAppointmentReminders } from "@/modules/appointments/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";

const INTERVAL_MS = 5 * 60 * 1000;

export async function runAppointmentJobsOnce(now: Date = new Date()): Promise<{ sources: number; reminders: number }> {
  const db = appDatabase();
  const total = { sources: 0, reminders: 0 };
  for (const organization of await listOrganizations(db)) {
    if (!(await isModuleEnabled(db, organization.id, "appointments"))) continue;
    try {
      total.sources += await refreshDueCalendarSources(organization.id, now);
      total.reminders += await sendDueAppointmentReminders(organization.id, now);
    } catch (error) {
      console.error("rendez-vous : tâches périodiques échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return total;
}

export function scheduleAppointmentJobs(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runAppointmentJobsOnce()
      .catch((error: unknown) => {
        console.error("rendez-vous : tâches périodiques échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
