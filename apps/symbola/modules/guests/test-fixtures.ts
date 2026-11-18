// Lot 49 — fabriques des tests d'intégration du module Invités (contre un vrai PostgreSQL) : une
// organisation prête (module ouvert, analyse d'impact confirmée), un évènement daté avec ses temps
// forts, un foyer, un lien personnel. Données fictives générées (aucune donnée réelle).
import { randomUUID } from "node:crypto";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import type { HouseholdInput } from "@symbola/contracts";
import { addKeyMoment, createProspect, createProspectSource } from "@/modules/events/service";
import { setModuleEnabled } from "@/modules/hub/service";
import { confirmImpactAssessment, issueGuestLink, listHouseholds, saveGuestEventSettings, saveHousehold } from "./service";

export async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

export async function readyOrganization(options: { confirm?: boolean; enabled?: boolean } = {}) {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`))).id;
  const owner = await withDb((db) => createUser(db, { organizationId, email: `owner-${randomUUID()}@example.test`, role: "owner" }));
  if (options.enabled !== false) await withDb((db) => setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: true }));
  if (options.confirm !== false) await confirmImpactAssessment(organizationId, owner.id);
  return { organizationId, ownerId: owner.id };
}

// Mariage de référence : cérémonie et dîner le 12 juin 2027, brunch le lendemain.
export async function weddingEvent(organizationId: string, ownerId: string, eventDate = "2027-06-12") {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }], eventDate });
  const ceremony = await addKeyMoment(organizationId, event.id, { name: "Cérémonie laïque", date: eventDate, startTime: "15:00" });
  const dinner = await addKeyMoment(organizationId, event.id, { name: "Dîner", date: eventDate, startTime: "20:00" });
  const next = new Date(Date.parse(`${eventDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const brunch = await addKeyMoment(organizationId, event.id, { name: "Brunch", date: next, startTime: "11:00" });
  return { eventId: event.id, moments: { ceremony: ceremony.id, dinner: dinner.id, brunch: brunch.id } };
}

export async function openResponses(organizationId: string, eventId: string, closeOn = "2027-05-13", extra: Partial<{ askAccommodation: boolean; askTransport: boolean; reminderDays: number[] }> = {}, now?: Date) {
  return saveGuestEventSettings(organizationId, eventId, { responsesCloseOn: closeOn, askDiet: true, askAccommodation: extra.askAccommodation ?? false, askTransport: extra.askTransport ?? false, reminderDays: extra.reminderDays ?? [21, 7] }, now);
}

// Foyer de Jeanne (71 ans) : Jeanne, qui a un téléphone, et Paul, sans coordonnées.
export function jeanneHousehold(email: string | null = null): HouseholdInput {
  return {
    displayName: "Jeanne et Paul Durand",
    people: [
      { kind: "adult", firstName: "Jeanne", lastName: "Durand", phone: "06 12 34 56 78", email },
      { kind: "adult", firstName: "Paul", lastName: "Durand" },
    ],
  };
}

export async function household(organizationId: string, eventId: string, input: HouseholdInput) {
  const id = await saveHousehold(organizationId, eventId, null, input);
  const [view] = (await listHouseholds(organizationId, eventId, { kind: "owner" })).filter((candidate) => candidate.id === id);
  return view!;
}

export async function linkFor(organizationId: string, eventId: string, guestId: string, now?: Date): Promise<string> {
  const { url } = await issueGuestLink(organizationId, eventId, guestId, now);
  return url.split("#")[1]!;
}
