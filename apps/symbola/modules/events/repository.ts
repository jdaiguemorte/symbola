// Accès aux données du module events — jamais importé hors de
// modules/events/ (ADR 0011).
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  eventClients,
  events,
  eventStatusHistory,
  lossReasons,
  prospectSources,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { emitDomainEvent } from "@symbola/db/events/emit";
import {
  EVT_EVENT_CREATED,
  EVT_EVENT_CREATED_VERSION,
  EVT_EVENT_STATUS_CHANGED,
  EVT_EVENT_STATUS_CHANGED_VERSION,
  type EventStatus,
} from "@symbola/contracts";

export type EventRow = typeof events.$inferSelect;
export type EventClientRow = typeof eventClients.$inferSelect;
export type ProspectSourceRow = typeof prospectSources.$inferSelect;
export type LossReasonRow = typeof lossReasons.$inferSelect;

export async function findEvents(
  organizationId: string,
  filters: { statusIn?: EventStatus[] | undefined; year?: number | undefined; search?: string | undefined },
): Promise<{ event: EventRow; clients: EventClientRow[] }[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      let matchingIds: string[] | undefined;
      if (filters.search) {
        const term = `%${filters.search}%`;
        const matches = await tx
          .selectDistinct({ id: events.id })
          .from(events)
          .leftJoin(eventClients, eq(eventClients.eventId, events.id))
          .where(
            or(
              ilike(events.venueName, term),
              ilike(events.venueCity, term),
              ilike(eventClients.firstName, term),
              ilike(eventClients.lastName, term),
            ),
          );
        matchingIds = matches.map((row) => row.id);
        if (matchingIds.length === 0) return [];
      }

      const conditions = [];
      if (filters.statusIn && filters.statusIn.length > 0) {
        conditions.push(inArray(events.status, filters.statusIn));
      }
      if (filters.year !== undefined) {
        conditions.push(sql`extract(year from ${events.eventDate}) = ${filters.year}`);
      }
      if (matchingIds) {
        conditions.push(inArray(events.id, matchingIds));
      }

      const eventRows = await tx
        .select()
        .from(events)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${events.eventDate} asc nulls first`);

      const eventIds = eventRows.map((row) => row.id);
      const clientRows =
        eventIds.length > 0
          ? await tx
              .select()
              .from(eventClients)
              .where(inArray(eventClients.eventId, eventIds))
              .orderBy(asc(eventClients.position))
          : [];

      return eventRows.map((event) => ({
        event,
        clients: clientRows.filter((client) => client.eventId === event.id),
      }));
    });
  } finally {
    await pg.end();
  }
}

export async function findEventById(
  organizationId: string,
  eventId: string,
): Promise<{ event: EventRow; clients: EventClientRow[] } | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return null;
      const clients = await tx
        .select()
        .from(eventClients)
        .where(eq(eventClients.eventId, eventId))
        .orderBy(asc(eventClients.position));
      return { event, clients };
    });
  } finally {
    await pg.end();
  }
}

export async function insertProspect(input: {
  organizationId: string;
  createdByUserId: string;
  clients: { firstName: string; lastName?: string | null }[];
  prospectSourceId: string;
  eventDate?: string | null | undefined;
  venueName?: string | null | undefined;
  venueCity?: string | null | undefined;
}): Promise<EventRow> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [event] = await tx
        .insert(events)
        .values({
          organizationId: input.organizationId,
          status: "prospect",
          eventDate: input.eventDate ?? null,
          venueName: input.venueName ?? null,
          venueCity: input.venueCity ?? null,
          prospectSourceId: input.prospectSourceId,
        })
        .returning();
      if (!event) throw new Error("création de l'événement échouée");

      for (const [index, client] of input.clients.entries()) {
        await tx.insert(eventClients).values({
          organizationId: input.organizationId,
          eventId: event.id,
          firstName: client.firstName,
          lastName: client.lastName ?? null,
          position: index,
        });
      }

      await tx.insert(eventStatusHistory).values({
        organizationId: input.organizationId,
        eventId: event.id,
        fromStatus: null,
        toStatus: "prospect",
        changedByUserId: input.createdByUserId,
      });

      await emitDomainEvent(tx, {
        organizationId: input.organizationId,
        name: EVT_EVENT_CREATED,
        version: EVT_EVENT_CREATED_VERSION,
        payload: { eventId: event.id, status: event.status },
      });

      return event;
    });
  } finally {
    await pg.end();
  }
}

export async function updateEventStatus(input: {
  organizationId: string;
  eventId: string;
  changedByUserId: string;
  toStatus: EventStatus;
  lossReasonId?: string | null;
  lossReasonNote?: string | null;
}): Promise<EventRow> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [current] = await tx.select().from(events).where(eq(events.id, input.eventId));
      if (!current) throw new Error("événement introuvable");

      const [updated] = await tx
        .update(events)
        .set({
          status: input.toStatus,
          lossReasonId: input.toStatus === "lost" ? (input.lossReasonId ?? null) : null,
          lossReasonNote: input.toStatus === "lost" ? (input.lossReasonNote ?? null) : null,
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.eventId))
        .returning();
      if (!updated) throw new Error("mise à jour de l'événement échouée");

      await tx.insert(eventStatusHistory).values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        fromStatus: current.status,
        toStatus: input.toStatus,
        changedByUserId: input.changedByUserId,
      });

      await emitDomainEvent(tx, {
        organizationId: input.organizationId,
        name: EVT_EVENT_STATUS_CHANGED,
        version: EVT_EVENT_STATUS_CHANGED_VERSION,
        payload: {
          eventId: input.eventId,
          fromStatus: current.status,
          toStatus: input.toStatus,
          changedByUserId: input.changedByUserId,
        },
      });

      return updated;
    });
  } finally {
    await pg.end();
  }
}

export async function findProspectSources(organizationId: string): Promise<ProspectSourceRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(prospectSources)
        .where(eq(prospectSources.organizationId, organizationId))
        .orderBy(asc(prospectSources.createdAt)),
    );
  } finally {
    await pg.end();
  }
}

export async function insertProspectSource(organizationId: string, label: string): Promise<ProspectSourceRow> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [row] = await tx.insert(prospectSources).values({ organizationId, label }).returning();
      if (!row) throw new Error("création de la source échouée");
      return row;
    });
  } finally {
    await pg.end();
  }
}

export async function findLossReasons(organizationId: string): Promise<LossReasonRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(lossReasons)
        .where(eq(lossReasons.organizationId, organizationId))
        .orderBy(asc(lossReasons.createdAt)),
    );
  } finally {
    await pg.end();
  }
}

export async function insertLossReason(
  organizationId: string,
  label: string,
  isFreeText: boolean,
): Promise<LossReasonRow> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [row] = await tx.insert(lossReasons).values({ organizationId, label, isFreeText }).returning();
      if (!row) throw new Error("création du motif échouée");
      return row;
    });
  } finally {
    await pg.end();
  }
}
