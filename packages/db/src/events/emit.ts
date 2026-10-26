// Publication d'un événement interne (SOC-06, ADR 0014, CLAUDE.md §5) :
// insertion dans domain_events au sein de la MÊME transaction que
// l'écriture métier (motif outbox). L'appelant doit fournir la transaction
// en cours (via withOrganization) — jamais une connexion séparée, sinon
// l'atomicité outbox n'est plus garantie.
import type { AppDatabase } from "../client";
import { domainEvents } from "../schema/core";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export async function emitDomainEvent(
  tx: Transaction,
  event: { organizationId: string; name: string; version: number; payload: unknown },
): Promise<string> {
  const [row] = await tx
    .insert(domainEvents)
    .values({
      organizationId: event.organizationId,
      name: event.name,
      version: event.version,
      payload: event.payload as object,
    })
    .returning({ id: domainEvents.id });

  if (!row) throw new Error("publication de l'événement échouée");
  return row.id;
}
