// Lot 44 (CRM-01, D4 ; ADR 0084) — purge des demandes « à vérifier » du formulaire de contact jamais
// traitées (30 jours, contact-form.json), pour chaque organisation où le module Évènements est ouvert.
// Lancée par instrumentation.ts, derrière le verrou des tâches périodiques (ADR 0076). Les journaux ne
// portent que des identifiants (SEC-20).
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { purgeStaleProspectRequests } from "@/modules/events/service";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // toutes les six heures

export async function runProspectRequestPurge(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  let purged = 0;
  for (const organization of await listOrganizations(db)) {
    if (!(await isModuleEnabled(db, organization.id, "events"))) continue;
    try {
      purged += await withActor(SYSTEM_ACTOR, () => purgeStaleProspectRequests(organization.id, now));
    } catch (error) {
      console.error("purge des demandes à vérifier échouée", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return purged;
}

export function scheduleProspectRequestPurge(): void {
  const run = () => {
    runProspectRequestPurge().catch((error: unknown) => {
      console.error("purge des demandes à vérifier échouée", error instanceof Error ? error.name : "inconnue");
    });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
