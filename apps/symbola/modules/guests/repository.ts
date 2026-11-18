// Lot 49 — accès base du module guests (ADR 0011 : jamais importé hors du module). Chaque lecture et
// écriture passe par withOrganization (RLS, SEC-10) ; aucune requête ne lit une autre organisation.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { dietaryOptions, diets, eventSettings, guestLinks, guests, householdGroups, households, moduleSettings, purgePostponements, rsvpAnswers } from "@symbola/db/schema/guests";
import { withOrganization } from "@symbola/db/with-organization";
import { starterDietaryOptions } from "@symbola/starter-templates";

export type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HouseholdRow = typeof households.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type EventSettingsRow = typeof eventSettings.$inferSelect;
export type GuestLinkRow = typeof guestLinks.$inferSelect;
export type DietaryOptionRow = typeof dietaryOptions.$inferSelect;

export function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export async function findModuleSettings(tx: Tx, organizationId: string) {
  const [row] = await tx.select().from(moduleSettings).where(eq(moduleSettings.organizationId, organizationId));
  return row ?? null;
}

export async function findEventSettings(tx: Tx, eventId: string): Promise<EventSettingsRow | null> {
  const [row] = await tx.select().from(eventSettings).where(eq(eventSettings.eventId, eventId));
  return row ?? null;
}

// Ligne des réglages d'un évènement, créée avec les valeurs par défaut au premier besoin.
export async function ensureEventSettings(tx: Tx, organizationId: string, eventId: string, reminderDays: number[]): Promise<EventSettingsRow> {
  const existing = await findEventSettings(tx, eventId);
  if (existing) return existing;
  await tx.insert(eventSettings).values({ organizationId, eventId, reminderDays }).onConflictDoNothing({ target: eventSettings.eventId });
  return (await findEventSettings(tx, eventId))!;
}

export type EventGuestRows = {
  households: HouseholdRow[];
  people: GuestRow[];
  answers: (typeof rsvpAnswers.$inferSelect)[];
  links: GuestLinkRow[];
  dietRows: (typeof diets.$inferSelect)[];
  groups: (typeof householdGroups.$inferSelect)[];
};

// Tout le contenu d'un évènement (une transaction, quelques requêtes).
export async function loadEventRows(tx: Tx, eventId: string): Promise<EventGuestRows> {
  const householdRows = await tx.select().from(households).where(eq(households.eventId, eventId)).orderBy(asc(households.displayName), asc(households.createdAt));
  const people = await tx.select().from(guests).where(eq(guests.eventId, eventId)).orderBy(asc(guests.position), asc(guests.createdAt));
  const ids = people.map((person) => person.id);
  const [answers, links, dietRows, groups] = await Promise.all([
    ids.length > 0 ? tx.select().from(rsvpAnswers).where(inArray(rsvpAnswers.guestId, ids)) : Promise.resolve([]),
    ids.length > 0 ? tx.select().from(guestLinks).where(eq(guestLinks.eventId, eventId)) : Promise.resolve([]),
    ids.length > 0 ? tx.select().from(diets).where(inArray(diets.guestId, ids)) : Promise.resolve([]),
    tx.select().from(householdGroups).where(eq(householdGroups.eventId, eventId)).orderBy(asc(householdGroups.label)),
  ]);
  return { households: householdRows, people, answers, links, dietRows, groups };
}

// Liste des régimes de l'organisation : copiée des données de départ à la première lecture
// (RGP-06, D6). Les libellés des entrées de départ se traduisent à l'affichage.
export async function ensureDietaryOptions(tx: Tx, organizationId: string): Promise<DietaryOptionRow[]> {
  const rows = await tx.select().from(dietaryOptions).orderBy(asc(dietaryOptions.position), asc(dietaryOptions.createdAt));
  const known = new Set(rows.map((row) => row.starterKey).filter((key): key is string => key !== null));
  const missing = starterDietaryOptions("fr").filter((option) => !known.has(option.key));
  if (missing.length === 0) return rows;
  const start = rows.reduce((max, row) => Math.max(max, row.position + 1), 0);
  await tx
    .insert(dietaryOptions)
    .values(missing.map((option, index) => ({ organizationId, kind: option.kind, starterKey: option.key, label: null, position: start + index })))
    .onConflictDoNothing();
  return tx.select().from(dietaryOptions).orderBy(asc(dietaryOptions.position), asc(dietaryOptions.createdAt));
}

export async function findPostponement(tx: Tx, eventId: string) {
  const [row] = await tx.select().from(purgePostponements).where(eq(purgePostponements.eventId, eventId));
  return row ?? null;
}

export async function activeLinksOf(tx: Tx, guestIds: string[]): Promise<GuestLinkRow[]> {
  if (guestIds.length === 0) return [];
  return tx.select().from(guestLinks).where(and(inArray(guestLinks.guestId, guestIds), isNull(guestLinks.revokedAt)));
}
