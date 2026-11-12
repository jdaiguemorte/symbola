// Lot 30a (JRJ-03, décision D4) — contacts du jour J saisis pour l'événement
// (régisseur du domaine, taxi, pharmacie de garde). Accès aux données et règles du
// module events ; exposé seulement par service.ts (ADR 0011).
import { asc, eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventDayContacts, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventDayContact, EventDayContactInput } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type ContactRow = typeof eventDayContacts.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DAY_CONTACT_TEXT_MAX = 120;
export const DAY_CONTACT_PHONE_MAX = 40;

export class DayContactInvalidError extends Error {
  constructor(readonly reason: "name" | "role" | "phone") {
    super(`contact du jour J refusé : ${reason}`);
    this.name = "DayContactInvalidError";
  }
}

export class EventDayContactNotFoundError extends Error {
  constructor() {
    super("contact du jour J introuvable");
    this.name = "EventDayContactNotFoundError";
  }
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function toContact(row: ContactRow): EventDayContact {
  return { id: row.id, eventId: row.eventId, name: row.name, role: row.role, phone: row.phone, position: row.position };
}

const oneLine = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

// Nom et rôle d'une ligne ; un téléphone d'au moins trois chiffres (appel en un toucher).
export function dayContactValues(input: EventDayContactInput): { name: string; role: string | null; phone: string } {
  const name = oneLine(input.name);
  const role = oneLine(input.role) || null;
  const phone = oneLine(input.phone);
  if (name.length === 0 || name.length > DAY_CONTACT_TEXT_MAX) throw new DayContactInvalidError("name");
  if (role !== null && role.length > DAY_CONTACT_TEXT_MAX) throw new DayContactInvalidError("role");
  if (phone.length > DAY_CONTACT_PHONE_MAX || phone.replace(/\D/g, "").length < 3 || /[^\d\s+().-]/.test(phone)) throw new DayContactInvalidError("phone");
  return { name, role, phone };
}

export async function listDayContacts(organizationId: string, eventId: string): Promise<EventDayContact[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventDayContacts).where(eq(eventDayContacts.eventId, eventId)).orderBy(asc(eventDayContacts.position), asc(eventDayContacts.createdAt)),
  );
  return rows.map(toContact);
}

// Renvoie null si l'événement n'existe pas dans l'organisation.
export async function addDayContact(organizationId: string, eventId: string, input: EventDayContactInput): Promise<EventDayContact | null> {
  const values = dayContactValues(input);
  if (!UUID.test(eventId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const [last] = await tx
      .select({ position: sql<number>`coalesce(max(${eventDayContacts.position}), -1)` })
      .from(eventDayContacts)
      .where(eq(eventDayContacts.eventId, eventId));
    const [row] = await tx
      .insert(eventDayContacts)
      .values({ organizationId, eventId, ...values, position: Number(last?.position ?? -1) + 1 })
      .returning();
    return toContact(row!);
  });
}

export async function removeDayContact(organizationId: string, contactId: string): Promise<void> {
  if (!UUID.test(contactId)) throw new EventDayContactNotFoundError();
  const deleted = await inOrganization(organizationId, (tx) => tx.delete(eventDayContacts).where(eq(eventDayContacts.id, contactId)).returning());
  if (deleted.length === 0) throw new EventDayContactNotFoundError();
}
