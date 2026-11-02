// RGPD-05 — ce que la purge mensuelle (lib/privacy/purge.ts) doit savoir des
// événements pour appliquer les règles de conservation : statut, date,
// dernière activité de la fiche (décision de Julien du 02/11/2026 :
// création, dernière modification, dernier changement de statut) et ses
// clients. Les événements d'essai (ADR 0008) et ceux dont tous les clients
// sont déjà anonymisés (oubli ou purge passés) ne sont jamais proposés.
import { asc, eq, inArray, max } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, eventStatusHistory } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, parisDate } from "@symbola/privacy";

export type RetentionEvent = {
  eventId: string;
  status: "prospect" | "quote_sent" | "confirmed" | "done" | "lost";
  eventDate: string | null;
  // Jours (Paris) de création, de dernière modification et de dernier changement de statut.
  activityDates: string[];
  clientNames: string[];
  clientIds: string[];
};

export async function listRetentionEvents(organizationId: string): Promise<RetentionEvent[]> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const rows = await tx.select().from(events).where(eq(events.isDemo, false));
      if (rows.length === 0) return [];
      const ids = rows.map((row) => row.id);
      const clients = await tx.select().from(eventClients).where(inArray(eventClients.eventId, ids)).orderBy(asc(eventClients.position));
      const lastChanges = await tx
        .select({ eventId: eventStatusHistory.eventId, changedAt: max(eventStatusHistory.changedAt) })
        .from(eventStatusHistory)
        .where(inArray(eventStatusHistory.eventId, ids))
        .groupBy(eventStatusHistory.eventId);
      const lastChange = new Map(lastChanges.map((row) => [row.eventId, row.changedAt]));
      const result: RetentionEvent[] = [];
      for (const row of rows) {
        const own = clients.filter((client) => client.eventId === row.id);
        if (own.length > 0 && own.every((client) => client.firstName === ANONYMIZED)) continue;
        const changedAt = lastChange.get(row.id);
        result.push({
          eventId: row.id,
          status: row.status,
          eventDate: row.eventDate,
          activityDates: [parisDate(row.createdAt), parisDate(row.updatedAt), ...(changedAt ? [parisDate(new Date(changedAt))] : [])],
          clientNames: own.map((client) => (client.lastName ? `${client.firstName} ${client.lastName}` : client.firstName)),
          clientIds: own.map((client) => client.id),
        });
      }
      return result;
    });
  } finally {
    await sql.end();
  }
}
