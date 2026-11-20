// Lot 54 (HUB-27, DOC-06 ; ADR 0101) — passage périodique des abonnements, lancé par
// instrumentation.ts derrière le verrou des tâches périodiques : rappels de fin d'essai (J-7, J-1),
// passage en lecture seule, reconduction des périodes, échéance des résiliations (fermeture du lot
// 35c), puis mesure du stockage des organisations abonnées face au quota de leur offre (alertes à 80
// et 95 %, préavis à 100 %). Toutes les heures ; rejouable sans doublon (chaque e-mail a sa clé).
import { appDatabase } from "@symbola/db/client";
import { getSubscription, listOrganizations, recordStorageMeasure, runSubscriptionPass, storageMeasureIsStale, type SubscriptionPass } from "@/modules/hub/service";
import { measureOrganizationStorageByModule, type ModuleStorage } from "./storage-snapshots";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Une mesure garde sa valeur une heure : un dépôt n'attend jamais la mesure (rien n'est bloqué sans
// préavis), seul le palier suivant arrive au passage suivant.
const MEASURE_MAX_AGE_MS = 55 * 60 * 1000;

export type SubscriptionsRun = SubscriptionPass & { measured: string[] };

export async function runSubscriptionsOnce(options: { now?: Date; organizationIds?: string[]; measure?: (organizationId: string) => Promise<ModuleStorage> } = {}): Promise<SubscriptionsRun> {
  const db = appDatabase();
  const now = options.now ?? new Date();
  const organizationIds = options.organizationIds ?? (await listOrganizations(db)).map((organization) => organization.id);
  const pass = await runSubscriptionPass(db, { organizationIds, now });
  const measure = options.measure ?? measureOrganizationStorageByModule;
  const measured: string[] = [];
  for (const organizationId of organizationIds) {
    try {
      if (!(await getSubscription(db, organizationId))) continue;
      if (!(await storageMeasureIsStale(db, organizationId, now, MEASURE_MAX_AGE_MS))) continue;
      const usage = await measure(organizationId);
      await recordStorageMeasure(db, { organizationId, usedBytes: usage.usedBytes, usedByModule: usage.usedByModule, now });
      measured.push(organizationId);
    } catch (error) {
      pass.failed.push(organizationId);
      console.error("mesure du quota de stockage échouée", { organizationId, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  return { ...pass, measured };
}

export function scheduleSubscriptions(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runSubscriptionsOnce()
      .catch((error: unknown) => {
        console.error("passage des abonnements échoué", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}
