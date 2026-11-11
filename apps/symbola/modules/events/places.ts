// Lot 12 (L12-EVT-15) — lieux d'un événement (réception, cérémonie,
// préparatifs…), saisis une fois puis choisis dans le programme. Exposé aux
// autres modules seulement par service.ts (ADR 0011).
import { and, asc, eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventPlaces, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventPlace } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

const toPlace = (row: typeof eventPlaces.$inferSelect): EventPlace => ({ id: row.id, eventId: row.eventId, label: row.label, address: row.address, vendorId: row.vendorId });

export class EventPlaceEventNotFoundError extends Error {
  constructor() {
    super("événement introuvable");
    this.name = "EventPlaceEventNotFoundError";
  }
}

export async function listPlaces(organizationId: string, eventId: string): Promise<EventPlace[]> {
  return inOrganization(organizationId, async (tx) =>
    (await tx.select().from(eventPlaces).where(eq(eventPlaces.eventId, eventId)).orderBy(asc(eventPlaces.position), asc(eventPlaces.createdAt))).map(toPlace),
  );
}

export async function addPlace(organizationId: string, eventId: string, input: { label: string; address?: string | null; vendorId?: string | null }): Promise<EventPlace> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du lieu est obligatoire");
  if (input.vendorId && !UUID.test(input.vendorId)) throw new RangeError("fiche du carnet invalide");
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) throw new EventPlaceEventNotFoundError();
    const existing = (await tx.select().from(eventPlaces).where(eq(eventPlaces.eventId, eventId))).find(
      (place) => place.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"),
    );
    if (existing) return toPlace(existing);
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${eventPlaces.position}) + 1, 0)::int` })
      .from(eventPlaces)
      .where(eq(eventPlaces.eventId, eventId));
    const [row] = await tx
      .insert(eventPlaces)
      .values({ organizationId, eventId, label, address: input.address?.trim() || null, vendorId: input.vendorId ?? null, position: next })
      .returning();
    if (!row) throw new Error("ajout du lieu échoué");
    return toPlace(row);
  });
}

export async function removePlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.delete(eventPlaces).where(and(eq(eventPlaces.id, placeId), eq(eventPlaces.eventId, eventId))));
}
