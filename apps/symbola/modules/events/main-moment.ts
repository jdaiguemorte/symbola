// Lot 51 (EVT-04 ; D1, ADR 0091) — chaque séquence du programme appartient à un temps fort, donc à
// un jour. Une séquence ajoutée sans temps fort rejoint le premier temps fort du jour de
// l'évènement ; s'il n'y en a pas, un temps fort unique est créé de lui-même (nom des données de
// départ day-of.json, dans la langue de l'organisation), comme la migration 0165 l'a fait pour les
// évènements existants. Un évènement sans date n'a pas de jour : la séquence reste sans temps fort.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { events, keyMoments } from "@symbola/db/schema/events";
import type { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export async function ensureMainKeyMoment(tx: Tx, organizationId: string, eventId: string, name: string): Promise<string | null> {
  const [event] = await tx.select({ eventDate: events.eventDate }).from(events).where(eq(events.id, eventId));
  if (!event?.eventDate) return null;
  const [existing] = await tx
    .select({ id: keyMoments.id })
    .from(keyMoments)
    .where(and(eq(keyMoments.eventId, eventId), eq(keyMoments.date, event.eventDate), isNull(keyMoments.deletedAt)))
    .orderBy(sql`${keyMoments.startTime} asc nulls first`, asc(keyMoments.position), asc(keyMoments.createdAt))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(keyMoments)
    .values({ organizationId, eventId, name, date: event.eventDate, position: 0, autoCreated: true })
    .returning({ id: keyMoments.id });
  return created?.id ?? null;
}

// Un temps fort désigné doit être de cet évènement (et donc de l'organisation : RLS).
export async function keyMomentOfEvent(tx: Tx, eventId: string, keyMomentId: string): Promise<boolean> {
  const [row] = await tx.select({ id: keyMoments.id }).from(keyMoments).where(and(eq(keyMoments.id, keyMomentId), eq(keyMoments.eventId, eventId)));
  return Boolean(row);
}
