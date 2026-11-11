// Worker continu des événements internes (ADR 0014, SOC-06) : lit la table
// domain_events (outbox) et appelle les gestionnaires des modules par leur
// service.ts, de façon idempotente (packages/db/src/events/worker.ts). Lancé
// au démarrage du serveur (instrumentation.ts) ; jusqu'au lot 6 il n'était
// appelé que par les tests (limite connue des lots 2 à 4).
import { EVT_VENDOR_SLOT_BOOKED, vendorSlotBookedPayloadSchema } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { processPendingEvents, type DomainEventRecord, type EventHandler } from "@symbola/db/events/worker";
import { applyVendorSlotBookedToBudget } from "@/modules/budget/service";

const POLL_INTERVAL_MS = 15_000;

// Un consommateur par module abonné : chacun garde sa propre trace
// d'événements traités (domain_event_consumers).
export const CONSUMERS: Record<string, Record<string, EventHandler>> = {
  // PRD-BUD-02 : poste réservé (PRD-EVT-03) → montant réel de la ligne de budget.
  budget: {
    [EVT_VENDOR_SLOT_BOOKED]: async (event: DomainEventRecord) => {
      const payload = vendorSlotBookedPayloadSchema.parse(event.payload);
      await applyVendorSlotBookedToBudget(event.organizationId, payload, event.occurredAt);
    },
  },
};

export async function runEventWorkerOnce(consumers: Record<string, Record<string, EventHandler>> = CONSUMERS): Promise<{ processed: number; failed: number }> {
  const db = appDatabase();
  let processed = 0;
  let failed = 0;
  for (const [consumerName, handlers] of Object.entries(consumers)) {
    const result = await processPendingEvents(db, consumerName, handlers);
    processed += result.processed;
    failed += result.failed;
  }
  return { processed, failed };
}

export function scheduleEventWorker(): void {
  let running = false;
  const run = () => {
    // Jamais deux passages en même temps dans le même processus.
    if (running) return;
    running = true;
    runEventWorkerOnce()
      .catch((error: unknown) => {
        console.error("worker d'événements : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, POLL_INTERVAL_MS).unref();
}
