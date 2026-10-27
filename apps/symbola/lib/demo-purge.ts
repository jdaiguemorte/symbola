// AIDE-02, ADR 0008 — fin d'un essai guidé et purge des essais abandonnés
// (« supprimées après 24 h »), tous modules confondus : chaque module
// supprime ses propres données de l'événement fictif (budget et devis d'abord),
// puis le module events supprime l'événement. Les modules ne se
// connaissent que par leur service.ts (ADR 0011) ; l'orchestration vit ici.
import { createAppConnection } from "@symbola/db/client";
import { removeEventBudgetData } from "@/modules/budget/service";
import { removeEventQuotesData } from "@/modules/quotes/service";
import {
  endEventsTrial,
  getEvent,
  listExpiredDemoEvents,
  purgeExpiredDemoEventsForOrganizations,
} from "@/modules/events/service";
import { listOrganizations } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

// Bouton « Terminer l'essai » : ne fait rien pour un vrai événement.
export async function endTrial(organizationId: string, eventId: string): Promise<void> {
  const event = await getEvent(organizationId, eventId);
  if (!event?.isDemo) return;
  await removeEventBudgetData(organizationId, [eventId]);
  await removeEventQuotesData(organizationId, [eventId]);
  await endEventsTrial(organizationId, eventId);
}

export async function purgeOrganizationsDemoData(organizationIds: string[], now: Date = new Date()): Promise<number> {
  const expired = await listExpiredDemoEvents(organizationIds, now);
  const byOrganization = new Map<string, string[]>();
  for (const { organizationId, eventId } of expired) {
    byOrganization.set(organizationId, [...(byOrganization.get(organizationId) ?? []), eventId]);
  }
  for (const [organizationId, eventIds] of byOrganization) {
    await removeEventBudgetData(organizationId, eventIds);
    await removeEventQuotesData(organizationId, eventIds);
  }
  return purgeExpiredDemoEventsForOrganizations(organizationIds, now);
}

export async function purgeAllExpiredDemoData(now: Date = new Date()): Promise<number> {
  const { sql, db } = createAppConnection();
  let organizations;
  try {
    organizations = await listOrganizations(db);
  } finally {
    await sql.end();
  }
  return purgeOrganizationsDemoData(
    organizations.map((organization) => organization.id),
    now,
  );
}

// Lancé une fois au démarrage du serveur (instrumentation.ts) : un seul
// processus applicatif par environnement (ADR 0011), donc pas de verrou.
export function scheduleDemoPurge(): void {
  const run = () => {
    purgeAllExpiredDemoData().catch((error: unknown) => {
      console.error("purge des essais expirés échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
