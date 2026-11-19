// Lot 47 (PAR-05 ; D2, D8 ; ADR 0085) — tâche horaire des prestataires par lien : pour chaque
// organisation où le module Évènements est ouvert, la relance la veille de la date limite d'un
// brief, puis les feuilles de route de J-30 et J-7 (le module ne fait rien hors des heures
// d'envoi). Chaque envoi passe par la file des tâches de fond (lot 40b) avec sa clé d'unicité :
// une fois chacun, rattrapé au passage suivant après une panne. Lancée par instrumentation.ts,
// derrière le verrou des tâches périodiques (ADR 0076). Les journaux ne portent que des
// identifiants (SEC-20).
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { sendVendorBriefReminders, sendVendorRoadmaps } from "@/modules/events/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";
import { automationHooks } from "./automation-gates";

const INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function runVendorCoordinationTasks(now: Date = new Date()): Promise<{ reminders: number; roadmaps: number }> {
  const db = appDatabase();
  let reminders = 0;
  let roadmaps = 0;
  for (const organization of await listOrganizations(db)) {
    if (!(await isModuleEnabled(db, organization.id, "events"))) continue;
    try {
      await withActor(SYSTEM_ACTOR, async () => {
        reminders += await sendVendorBriefReminders(organization.id, now);
        // Lot 53 (HUB-28, D5) : les feuilles de route ont leur interrupteur.
        const hooks = await automationHooks(organization.id, "vendor_roadmap", now);
        if (hooks) roadmaps += await sendVendorRoadmaps(organization.id, now, hooks);
      });
    } catch (error) {
      console.error("tâches des prestataires échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return { reminders, roadmaps };
}

export function scheduleVendorCoordinationTasks(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runVendorCoordinationTasks()
      .catch((error: unknown) => {
        console.error("tâches des prestataires échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
