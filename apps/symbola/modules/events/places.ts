// Lot 12 (L12-EVT-15) — lieux d'un événement (réception, cérémonie,
// préparatifs…), saisis une fois puis choisis dans le programme. Exposé aux
// autres modules seulement par service.ts (ADR 0011). Lot 34b (EVT-03, D10) : une seule liste ;
// chaque lieu porte adresse, ville, horaires et contact ; le premier est le lieu de réception.
import { and, asc, eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventPlaces, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventPlace, EventPlaceInput } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

const hhmm = (time: string | null) => (time ? time.slice(0, 5) : null);

const toPlace = (row: typeof eventPlaces.$inferSelect): EventPlace => ({
  id: row.id,
  eventId: row.eventId,
  label: row.label,
  address: row.address,
  city: row.city,
  startTime: hhmm(row.startTime),
  endTime: hhmm(row.endTime),
  contactName: row.contactName,
  contactPhone: row.contactPhone,
  contactEmail: row.contactEmail,
  vendorId: row.vendorId,
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Texte facultatif : espaces retirés, vide = nul, longueur bornée.
function optional(value: string | null | undefined, max: number, name: string): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  if (text.length > max) throw new RangeError(`${name} trop long`);
  return text;
}

// Lot 34b (EVT-03) : les détails d'un lieu, contrôlés ; une heure est « HH:MM ».
function placeDetails(input: EventPlaceInput) {
  const startTime = optional(input.startTime, 5, "heure de début");
  const endTime = optional(input.endTime, 5, "heure de fin");
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) throw new RangeError("heure invalide");
  const contactEmail = optional(input.contactEmail, 320, "e-mail du contact");
  if (contactEmail && !EMAIL.test(contactEmail)) throw new RangeError("e-mail du contact invalide");
  return {
    address: optional(input.address, 500, "adresse"),
    city: optional(input.city, 200, "ville"),
    startTime,
    endTime,
    contactName: optional(input.contactName, 200, "nom du contact"),
    contactPhone: optional(input.contactPhone, 40, "téléphone du contact"),
    contactEmail,
  };
}

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

export async function addPlace(organizationId: string, eventId: string, input: EventPlaceInput): Promise<EventPlace> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du lieu est obligatoire");
  if (label.length > 200) throw new RangeError("nom du lieu trop long");
  if (input.vendorId && !UUID.test(input.vendorId)) throw new RangeError("fiche du carnet invalide");
  const details = placeDetails(input);
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) throw new EventPlaceEventNotFoundError();
    const existing = (await tx.select().from(eventPlaces).where(eq(eventPlaces.eventId, eventId))).find(
      (place) => place.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"),
    );
    if (existing) {
      // Lot 34b (D10) : le lieu existe déjà (lieu de réception saisi à la création, import) : ses
      // champs encore vides reçoivent ce qui est donné, sans écraser une valeur saisie.
      const missing = Object.fromEntries(
        Object.entries({ ...details, vendorId: input.vendorId ?? null }).filter(([key, value]) => value !== null && existing[key as keyof typeof existing] === null),
      );
      if (Object.keys(missing).length === 0) return toPlace(existing);
      const [completed] = await tx.update(eventPlaces).set({ ...missing, updatedAt: new Date() }).where(eq(eventPlaces.id, existing.id)).returning();
      return toPlace(completed ?? existing);
    }
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${eventPlaces.position}) + 1, 0)::int` })
      .from(eventPlaces)
      .where(eq(eventPlaces.eventId, eventId));
    const [row] = await tx
      .insert(eventPlaces)
      .values({ organizationId, eventId, label, ...details, vendorId: input.vendorId ?? null, position: next })
      .returning();
    if (!row) throw new Error("ajout du lieu échoué");
    return toPlace(row);
  });
}

export class EventPlaceNotFoundError extends Error {
  constructor() {
    super("lieu introuvable");
    this.name = "EventPlaceNotFoundError";
  }
}

// Lot 34b (EVT-03, D10) : nom, adresse, ville, horaires et contact d'un lieu de l'événement.
export async function updatePlace(organizationId: string, eventId: string, placeId: string, input: EventPlaceInput): Promise<EventPlace> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du lieu est obligatoire");
  if (label.length > 200) throw new RangeError("nom du lieu trop long");
  if (!UUID.test(placeId)) throw new EventPlaceNotFoundError();
  const details = placeDetails(input);
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .update(eventPlaces)
      .set({ label, ...details, updatedAt: new Date() })
      .where(and(eq(eventPlaces.id, placeId), eq(eventPlaces.eventId, eventId)))
      .returning();
    if (!row) throw new EventPlaceNotFoundError();
    return toPlace(row);
  });
}

// Le lieu passe en tête de liste : il devient le lieu de réception.
export async function makeReceptionPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  if (!UUID.test(placeId)) throw new EventPlaceNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const [first] = await tx.select({ position: sql<number>`min(${eventPlaces.position})::int` }).from(eventPlaces).where(eq(eventPlaces.eventId, eventId));
    const rows = await tx
      .update(eventPlaces)
      .set({ position: (first?.position ?? 0) - 1, updatedAt: new Date() })
      .where(and(eq(eventPlaces.id, placeId), eq(eventPlaces.eventId, eventId)))
      .returning({ id: eventPlaces.id });
    if (rows.length === 0) throw new EventPlaceNotFoundError();
  });
}

export async function removePlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.delete(eventPlaces).where(and(eq(eventPlaces.id, placeId), eq(eventPlaces.eventId, eventId))));
}
