// Lot 70e (EVT-01, EVT-07, CRM-03 ; A14) — « Nouvel évènement » ne demande plus la source ni le second
// client : ils se complètent depuis la fiche. Deux écritures du module, chacune sous RLS dans
// l'organisation de l'évènement : la source du prospect (une de celles de l'organisation, ou aucune), et
// un client de plus (un contact choisi ou un nouveau, deux au plus).
import { and, eq } from "drizzle-orm";
import type { EventClientInput } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { eventClients, events, prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { resolveClientContacts } from "./clients";
import { assertEventWritable } from "./closing";
import { EventNotFoundError } from "./errors";

export class InvalidProspectSourceError extends Error {
  constructor() {
    super("source inconnue");
    this.name = "InvalidProspectSourceError";
  }
}

export class EventClientsFullError extends Error {
  constructor() {
    super("deux clients au plus");
    this.name = "EventClientsFullError";
  }
}

const MAX_CLIENTS = 2;

// La source d'un évènement, ou aucune (null). Une source d'une autre organisation n'existe pas : même
// erreur qu'une source inconnue (SEC-13).
export async function setEventProspectSource(organizationId: string, eventId: string, prospectSourceId: string | null): Promise<void> {
  await assertEventWritable(organizationId, eventId);
  const found = await withOrganization(appDatabase(), organizationId, async (tx) => {
    if (prospectSourceId !== null) {
      const [source] = await tx.select({ id: prospectSources.id }).from(prospectSources).where(and(eq(prospectSources.id, prospectSourceId), eq(prospectSources.organizationId, organizationId)));
      if (!source) return "source" as const;
    }
    const rows = await tx.update(events).set({ prospectSourceId, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
    return rows.length > 0 ? ("ok" as const) : ("event" as const);
  });
  if (found === "source") throw new InvalidProspectSourceError();
  if (found === "event") throw new EventNotFoundError();
}

// Un client de plus sur l'évènement : un contact existant ou un nouveau (créé au hub). Un même contact
// n'est client qu'une fois d'un même évènement ; deux clients au plus.
export async function addEventClient(input: { organizationId: string; eventId: string; client: EventClientInput }): Promise<void> {
  await assertEventWritable(input.organizationId, input.eventId);
  const [contactId] = await resolveClientContacts(input.organizationId, [input.client]);
  if (!contactId) throw new EventNotFoundError();
  const outcome = await withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
    if (!event) return "event" as const;
    const links = await tx.select({ contactId: eventClients.contactId }).from(eventClients).where(eq(eventClients.eventId, input.eventId));
    if (links.some((link) => link.contactId === contactId)) return "ok" as const;
    if (links.length >= MAX_CLIENTS) return "full" as const;
    await tx.insert(eventClients).values({ organizationId: input.organizationId, eventId: input.eventId, contactId, position: links.length });
    return "ok" as const;
  });
  if (outcome === "event") throw new EventNotFoundError();
  if (outcome === "full") throw new EventClientsFullError();
}
