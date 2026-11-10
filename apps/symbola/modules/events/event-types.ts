// Lot 16 (ADR 0045) — types d'événement de l'organisation (mariage,
// séminaire…) : accès aux données et règles, exposés par service.ts. Un type
// dit qui sont les clients de l'événement, « les mariés » (couple) ou « le
// client » (clients), et donc le vocabulaire de ses écrans. Toujours au moins
// un type ; un type utilisé ne se supprime qu'en confiant ses événements à un
// autre.
import { asc, count, eq, isNotNull, sql } from "drizzle-orm";
import type { EventType, EventTypeAudience, EventTypeInput, StarterEventTypeInput } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { events, eventTypes } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";

export class EventTypeNotFoundError extends Error {
  constructor() {
    super("type d'événement introuvable");
    this.name = "EventTypeNotFoundError";
  }
}

// Le type a des événements : il faut choisir le type qui les reprend.
export class EventTypeInUseError extends Error {
  constructor(readonly eventCount: number) {
    super("type d'événement utilisé : choisir un type de remplacement");
    this.name = "EventTypeInUseError";
  }
}

export class LastEventTypeError extends Error {
  constructor() {
    super("le dernier type d'événement ne se supprime pas");
    this.name = "LastEventTypeError";
  }
}

const LABEL_MAX_LENGTH = 80;
const AUDIENCES: EventTypeAudience[] = ["couple", "clients"];

function cleanInput(input: EventTypeInput): EventTypeInput {
  const label = input.label.trim();
  if (label === "" || label.length > LABEL_MAX_LENGTH || !AUDIENCES.includes(input.audience)) throw new RangeError("type d'événement invalide");
  return { label, audience: input.audience };
}

type Row = typeof eventTypes.$inferSelect;
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

const toEventType = (row: Row): EventType => ({ id: row.id, label: row.label, audience: row.audience, position: row.position, starterKey: row.starterKey });

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

async function nextPosition(tx: Tx): Promise<number> {
  const [row] = await tx.select({ next: sql<number>`coalesce(max(${eventTypes.position}) + 1, 0)::int` }).from(eventTypes);
  return row?.next ?? 0;
}

export async function listEventTypes(organizationId: string): Promise<EventType[]> {
  return inOrganization(organizationId, async (tx) =>
    (await tx.select().from(eventTypes).orderBy(asc(eventTypes.position), asc(eventTypes.createdAt))).map(toEventType),
  );
}

// Installe les types de départ qui manquent, par leur clé : jamais en double,
// même si deux requêtes s'y essaient en même temps.
export async function addStarterEventTypes(organizationId: string, types: StarterEventTypeInput[]): Promise<number> {
  if (types.length === 0) return 0;
  return inOrganization(organizationId, async (tx) => {
    const start = await nextPosition(tx);
    const inserted = await tx
      .insert(eventTypes)
      .values(types.map((type, index) => ({ organizationId, ...cleanInput(type), starterKey: type.key, position: start + index })))
      .onConflictDoNothing({ target: [eventTypes.organizationId, eventTypes.starterKey] })
      .returning({ id: eventTypes.id });
    return inserted.length;
  });
}

export async function createEventType(organizationId: string, input: EventTypeInput): Promise<EventType> {
  const clean = cleanInput(input);
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(eventTypes)
      .values({ organizationId, ...clean, position: await nextPosition(tx) })
      .returning();
    if (!row) throw new Error("création du type d'événement échouée");
    return toEventType(row);
  });
}

export async function updateEventType(organizationId: string, eventTypeId: string, input: EventTypeInput): Promise<void> {
  const clean = cleanInput(input);
  const updated = await inOrganization(organizationId, (tx) =>
    tx.update(eventTypes).set(clean).where(eq(eventTypes.id, eventTypeId)).returning({ id: eventTypes.id }),
  );
  if (updated.length === 0) throw new EventTypeNotFoundError();
}

export async function removeEventType(organizationId: string, eventTypeId: string, moveEventsTo: string | null): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    const types = await tx.select({ id: eventTypes.id }).from(eventTypes);
    if (!types.some((type) => type.id === eventTypeId)) throw new EventTypeNotFoundError();
    if (types.length <= 1) throw new LastEventTypeError();
    const [usage] = await tx.select({ total: count() }).from(events).where(eq(events.eventTypeId, eventTypeId));
    const eventCount = usage?.total ?? 0;
    if (eventCount > 0) {
      if (!moveEventsTo || moveEventsTo === eventTypeId || !types.some((type) => type.id === moveEventsTo)) throw new EventTypeInUseError(eventCount);
      await tx.update(events).set({ eventTypeId: moveEventsTo, updatedAt: new Date() }).where(eq(events.eventTypeId, eventTypeId));
    }
    await tx.delete(eventTypes).where(eq(eventTypes.id, eventTypeId));
  });
}

export async function countEventsByType(organizationId: string): Promise<Record<string, number>> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select({ eventTypeId: events.eventTypeId, total: count() }).from(events).where(isNotNull(events.eventTypeId)).groupBy(events.eventTypeId),
  );
  return Object.fromEntries(rows.map((row) => [row.eventTypeId!, row.total]));
}

// false : l'événement n'existe pas dans l'organisation.
export async function setEventTypeOfEvent(organizationId: string, eventId: string, eventTypeId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const [type] = await tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, eventTypeId));
    if (!type) throw new EventTypeNotFoundError();
    const updated = await tx.update(events).set({ eventTypeId, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
    return updated.length > 0;
  });
}

// Un type de l'organisation, sinon une erreur (création d'un événement) : la
// clé étrangère seule ne voit pas la RLS, elle accepterait le type d'une autre.
export async function assertEventTypeOf(organizationId: string, eventTypeId: string): Promise<void> {
  const [type] = await inOrganization(organizationId, (tx) => tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, eventTypeId)));
  if (!type) throw new EventTypeNotFoundError();
}

// Lot 20 (décision 6) : le vocabulaire de chaque événement de l'organisation
// (nul sans type), en une requête, pour les écrans qui en mêlent plusieurs.
export async function findEventAudiences(organizationId: string): Promise<Map<string, EventTypeAudience | null>> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select({ id: events.id, audience: eventTypes.audience }).from(events).leftJoin(eventTypes, eq(eventTypes.id, events.eventTypeId)),
  );
  return new Map(rows.map((row) => [row.id, row.audience ?? null]));
}

export async function findEventAudience(organizationId: string, eventId: string): Promise<EventTypeAudience | null> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx.select({ audience: eventTypes.audience }).from(events).innerJoin(eventTypes, eq(eventTypes.id, events.eventTypeId)).where(eq(events.id, eventId)),
  );
  return row?.audience ?? null;
}
