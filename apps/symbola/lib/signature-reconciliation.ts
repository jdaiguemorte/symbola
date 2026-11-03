// ADR 0026 — vérification régulière des demandes de signature en attente :
// filet de sécurité si un webhook de Documenso se perd. Chaque organisation
// est vérifiée dans son propre contexte (RLS).
import { createAppConnection } from "@symbola/db/client";
import { listOrganizations } from "@/modules/hub/service";
import { reconcilePendingSignatures } from "@/modules/quotes/service";

const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000; // toutes les 10 minutes

export async function reconcileAllPendingSignatures(): Promise<number> {
  const { sql, db } = createAppConnection();
  let organizationIds: string[];
  try {
    organizationIds = (await listOrganizations(db)).map((organization) => organization.id);
  } finally {
    await sql.end();
  }
  let completed = 0;
  for (const organizationId of organizationIds) completed += (await reconcilePendingSignatures(organizationId)).completed;
  return completed;
}

// Lancé une fois au démarrage du serveur (instrumentation.ts).
export function scheduleSignatureReconciliation(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    reconcileAllPendingSignatures()
      .catch((error: unknown) => {
        console.error("vérification des signatures en attente échouée", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  setInterval(run, RECONCILIATION_INTERVAL_MS).unref();
}
