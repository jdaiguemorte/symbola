// Worker interne (SOC-06, ADR 0014) : consomme domain_events de façon
// idempotente. « Réclame » chaque événement en insérant d'abord dans
// domain_event_consumers (ON CONFLICT DO NOTHING) avant d'appeler le
// gestionnaire — un rejeu (même séquentiel, même concurrent) ne déclenche
// donc jamais deux fois le même gestionnaire pour le même événement.
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { domainEventConsumers, domainEvents } from "../schema/core";

export type DomainEventRecord = {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  payload: unknown;
  occurredAt: Date;
};

export type EventHandler = (event: DomainEventRecord) => Promise<void>;

export async function processPendingEvents(
  db: AppDatabase,
  consumerName: string,
  handlers: Record<string, EventHandler>,
): Promise<{ processed: number }> {
  const eventNames = Object.keys(handlers);
  if (eventNames.length === 0) return { processed: 0 };

  // Filtré aux noms d'événements que ce worker sait traiter : un worker ne
  // doit pas « réclamer » (et donc empêcher un autre worker de recevoir)
  // des événements auxquels il n'est pas abonné.
  const candidates = await db
    .select({
      id: domainEvents.id,
      organizationId: domainEvents.organizationId,
      name: domainEvents.name,
      version: domainEvents.version,
      payload: domainEvents.payload,
      occurredAt: domainEvents.occurredAt,
    })
    .from(domainEvents)
    .leftJoin(
      domainEventConsumers,
      and(
        eq(domainEventConsumers.eventId, domainEvents.id),
        eq(domainEventConsumers.consumerName, consumerName),
      ),
    )
    .where(and(isNull(domainEventConsumers.eventId), inArray(domainEvents.name, eventNames)));

  let processed = 0;

  for (const event of candidates) {
    const claimed = await db
      .insert(domainEventConsumers)
      .values({ consumerName, eventId: event.id })
      .onConflictDoNothing()
      .returning();

    if (claimed.length === 0) continue; // déjà réclamé par une exécution concurrente

    const handler = handlers[event.name];
    if (handler) {
      await handler(event);
    }
    processed += 1;
  }

  return { processed };
}
