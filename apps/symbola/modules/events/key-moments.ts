// Lot 49 (EVT-04 premier pas, INV-03 ; D2) — temps forts d'un évènement (cérémonie, dîner, brunch),
// gérés depuis la fiche ; le RSVP du module Invités demande la présence par temps fort. Le lot 51
// les complétera (chrono par temps fort, évènement sur plusieurs jours). Exposé aux autres modules
// seulement par service.ts (ADR 0011), avec ce que le module Invités lit d'un évènement.
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventClients, eventPlaces, events, eventStatusHistory, keyMoments } from "@symbola/db/schema/events";
import { inTrash, markDeleted } from "@symbola/db/soft-delete";
import { withOrganization } from "@symbola/db/with-organization";
import { parisToday } from "@symbola/i18n";
import type { GuestEventContext, KeyMoment, KeyMomentInput } from "@symbola/contracts";
import { withContacts } from "./clients";
import { findEventAudiences } from "./event-types";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Plusieurs temps forts par évènement, pas une liste sans fin.
export const KEY_MOMENTS_MAX = 20;

export class KeyMomentInvalidError extends Error {
  constructor(readonly problem: "name" | "date" | "time" | "place" | "too_many") {
    super(`temps fort invalide : ${problem}`);
    this.name = "KeyMomentInvalidError";
  }
}

// Évènement ou temps fort d'une autre organisation, ou inexistant : même réponse (SEC-13).
export class KeyMomentNotFoundError extends Error {
  constructor() {
    super("temps fort introuvable");
    this.name = "KeyMomentNotFoundError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

function cleanInput(input: KeyMomentInput): { name: string; date: string; startTime: string | null; placeId: string | null } {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name || name.length > 100) throw new KeyMomentInvalidError("name");
  if (!DATE.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))) throw new KeyMomentInvalidError("date");
  const startTime = input.startTime?.trim() || null;
  if (startTime && !TIME.test(startTime)) throw new KeyMomentInvalidError("time");
  const placeId = input.placeId?.trim() || null;
  if (placeId && !UUID.test(placeId)) throw new KeyMomentInvalidError("place");
  return { name, date: input.date, startTime, placeId };
}

async function rowsOf(tx: Tx, eventIds: string[]): Promise<KeyMoment[]> {
  if (eventIds.length === 0) return [];
  const rows = await tx
    .select({ moment: keyMoments, placeLabel: eventPlaces.label })
    .from(keyMoments)
    .leftJoin(eventPlaces, eq(eventPlaces.id, keyMoments.placeId))
    .where(inArray(keyMoments.eventId, eventIds))
    .orderBy(asc(keyMoments.date), asc(keyMoments.startTime), asc(keyMoments.position), asc(keyMoments.createdAt));
  return rows.map(({ moment, placeLabel }) => ({
    id: moment.id,
    eventId: moment.eventId,
    name: moment.name,
    date: moment.date,
    startTime: moment.startTime ? moment.startTime.slice(0, 5) : null,
    placeId: moment.placeId,
    placeLabel: placeLabel ?? null,
    position: moment.position,
  }));
}

export async function listKeyMoments(organizationId: string, eventId: string): Promise<KeyMoment[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, (tx) => rowsOf(tx, [eventId]));
}

async function assertPlace(tx: Tx, eventId: string, placeId: string | null): Promise<void> {
  if (!placeId) return;
  const [place] = await tx.select({ id: eventPlaces.id }).from(eventPlaces).where(and(eq(eventPlaces.id, placeId), eq(eventPlaces.eventId, eventId)));
  if (!place) throw new KeyMomentInvalidError("place");
}

export async function addKeyMoment(organizationId: string, eventId: string, input: KeyMomentInput): Promise<KeyMoment> {
  if (!UUID.test(eventId)) throw new KeyMomentNotFoundError();
  const clean = cleanInput(input);
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) throw new KeyMomentNotFoundError();
    await assertPlace(tx, eventId, clean.placeId);
    const [{ count, next } = { count: 0, next: 0 }] = await tx
      .select({ count: sql<number>`count(*)::int`, next: sql<number>`coalesce(max(${keyMoments.position}) + 1, 0)::int` })
      .from(keyMoments)
      .where(eq(keyMoments.eventId, eventId));
    if (count >= KEY_MOMENTS_MAX) throw new KeyMomentInvalidError("too_many");
    const [row] = await tx.insert(keyMoments).values({ organizationId, eventId, ...clean, position: next }).returning({ id: keyMoments.id });
    const created = (await rowsOf(tx, [eventId])).find((moment) => moment.id === row?.id);
    if (!created) throw new Error("ajout du temps fort échoué");
    return created;
  });
}

export async function updateKeyMoment(organizationId: string, eventId: string, keyMomentId: string, input: KeyMomentInput): Promise<KeyMoment> {
  if (!UUID.test(eventId) || !UUID.test(keyMomentId)) throw new KeyMomentNotFoundError();
  const clean = cleanInput(input);
  return inOrganization(organizationId, async (tx) => {
    await assertPlace(tx, eventId, clean.placeId);
    const updated = await tx
      .update(keyMoments)
      .set({ ...clean, updatedAt: new Date() })
      .where(and(eq(keyMoments.id, keyMomentId), eq(keyMoments.eventId, eventId)))
      .returning({ id: keyMoments.id });
    if (updated.length === 0) throw new KeyMomentNotFoundError();
    return (await rowsOf(tx, [eventId])).find((moment) => moment.id === keyMomentId)!;
  });
}

// Suppression logique (ADR 0073) : la ligne est cachée, puis purgée avec les éléments de la fiche ;
// les réponses des invités à ce temps fort ne s'affichent plus.
export async function removeKeyMoment(organizationId: string, eventId: string, keyMomentId: string): Promise<void> {
  if (!UUID.test(eventId) || !UUID.test(keyMomentId)) throw new KeyMomentNotFoundError();
  // Marquer se fait dans une transaction qui voit la corbeille (ADR 0073).
  const removed = await inTrash(organizationId, (tx) =>
    tx
      .update(keyMoments)
      .set(markDeleted())
      .where(and(eq(keyMoments.id, keyMomentId), eq(keyMoments.eventId, eventId), isNull(keyMoments.deletedAt)))
      .returning({ id: keyMoments.id }),
  );
  if (removed.length === 0) throw new KeyMomentNotFoundError();
}

// Ce que le module Invités lit des évènements donnés (ceux d'une autre organisation, ou à la
// corbeille, n'y sont pas) : clients, dates, statut et jour d'annulation, vocabulaire, temps forts.
export async function guestEventContexts(organizationId: string, eventIds: string[]): Promise<GuestEventContext[]> {
  const ids = [...new Set(eventIds.filter((id) => UUID.test(id)))];
  if (ids.length === 0) return [];
  const found = await inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(events).where(inArray(events.id, ids));
    if (rows.length === 0) return null;
    const present = rows.map((row) => row.id);
    const clientLinks = await tx.select().from(eventClients).where(inArray(eventClients.eventId, present)).orderBy(asc(eventClients.position));
    const cancellations = await tx
      .select({ eventId: eventStatusHistory.eventId, changedAt: eventStatusHistory.changedAt })
      .from(eventStatusHistory)
      .where(and(inArray(eventStatusHistory.eventId, present), eq(eventStatusHistory.toStatus, "cancelled")))
      .orderBy(desc(eventStatusHistory.changedAt));
    return { rows, clientLinks, cancellations, moments: await rowsOf(tx, present) };
  });
  if (!found) return [];
  const clients = await withContacts(organizationId, found.clientLinks);
  const audiences = await findEventAudiences(organizationId);
  return found.rows.map((row) => {
    const cancelledAt = found.cancellations.find((change) => change.eventId === row.id)?.changedAt ?? null;
    return {
      eventId: row.id,
      isDemo: row.isDemo,
      status: row.status,
      eventDate: row.eventDate,
      timeZone: row.timeZone,
      cancelledOn: row.status === "cancelled" ? (cancelledAt ? parisToday(new Date(cancelledAt)) : parisToday(row.updatedAt)) : null,
      clients: clients.filter((client) => client.eventId === row.id).map((client) => ({ id: client.id, firstName: client.firstName, lastName: client.lastName })),
      vocabulary: audiences.get(row.id) ?? "couple",
      keyMoments: found.moments.filter((moment) => moment.eventId === row.id),
    };
  });
}

// Évènements réels (ni d'essai, ni à la corbeille) de l'organisation : ceux où le module Invités
// cherche des données à purger ou des relances à faire.
export async function listRealEventIds(organizationId: string): Promise<string[]> {
  return inOrganization(organizationId, async (tx) => (await tx.select({ id: events.id }).from(events).where(eq(events.isDemo, false))).map((row) => row.id));
}
