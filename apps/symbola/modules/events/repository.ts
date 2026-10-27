// Accès aux données du module events — jamais importé hors de
// modules/events/ (ADR 0011).
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  defaultVendorSlots,
  eventClients,
  events,
  eventStatusHistory,
  eventVendorSlots,
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
  EVT_VENDOR_SLOT_BOOKED,
  EVT_VENDOR_SLOT_BOOKED_VERSION,
  vendorSlotBookedPayloadSchema,
  type EventStatus,
  type VendorSlotStatus,
} from "@symbola/contracts";

export type EventRow = typeof events.$inferSelect;
export type EventClientRow = typeof eventClients.$inferSelect;
export type ProspectSourceRow = typeof prospectSources.$inferSelect;
export type DefaultVendorSlotRow = typeof defaultVendorSlots.$inferSelect;
export type EventVendorSlotRow = typeof eventVendorSlots.$inferSelect;
export type LossReasonRow = typeof lossReasons.$inferSelect;

export async function findEvents(
  organizationId: string,
  filters: {
    statusIn?: EventStatus[] | undefined;
    year?: number | undefined;
    search?: string | undefined;
    prospectSourceId?: string | undefined;
  },
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
      if (filters.prospectSourceId) {
        conditions.push(eq(events.prospectSourceId, filters.prospectSourceId));
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

      // EVT-03 : l'événement reçoit la liste de postes par défaut de la planner.
      const defaults = await tx
        .select()
        .from(defaultVendorSlots)
        .orderBy(asc(defaultVendorSlots.position), asc(defaultVendorSlots.createdAt));
      if (defaults.length > 0) {
        await tx.insert(eventVendorSlots).values(
          defaults.map((slot, index) => ({
            organizationId: input.organizationId,
            eventId: event.id,
            label: slot.label,
            position: index,
          })),
        );
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

// EVT-03 — liste de postes par défaut de l'organisation.
export async function findDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlotRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(defaultVendorSlots)
        .orderBy(asc(defaultVendorSlots.position), asc(defaultVendorSlots.createdAt)),
    );
  } finally {
    await pg.end();
  }
}

// Ajoute les libellés absents de la liste (comparaison sans tenir compte
// de la casse), à la suite des postes existants : recharger le modèle de
// départ ne crée pas de doublon.
export async function insertDefaultVendorSlots(
  organizationId: string,
  labels: string[],
): Promise<DefaultVendorSlotRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const existing = await tx.select().from(defaultVendorSlots);
      const known = new Set(existing.map((slot) => slot.label.trim().toLowerCase()));
      let nextPosition = existing.reduce((max, slot) => Math.max(max, slot.position + 1), 0);
      const toInsert = [];
      for (const label of labels.map((value) => value.trim()).filter(Boolean)) {
        const key = label.toLowerCase();
        if (known.has(key)) continue;
        known.add(key);
        toInsert.push({ organizationId, label, position: nextPosition++ });
      }
      if (toInsert.length === 0) return [];
      return tx.insert(defaultVendorSlots).values(toInsert).returning();
    });
  } finally {
    await pg.end();
  }
}

export async function deleteDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.delete(defaultVendorSlots).where(eq(defaultVendorSlots.id, defaultVendorSlotId)),
    );
  } finally {
    await pg.end();
  }
}

// EVT-03 — postes d'un événement.
export async function findEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlotRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(eventVendorSlots)
        .where(eq(eventVendorSlots.eventId, eventId))
        .orderBy(asc(eventVendorSlots.position), asc(eventVendorSlots.createdAt)),
    );
  } finally {
    await pg.end();
  }
}

export async function insertEventVendorSlot(
  organizationId: string,
  eventId: string,
  label: string,
): Promise<EventVendorSlotRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      // La clé étrangère est vérifiée sans RLS : sans ce contrôle, un
      // identifiant d'événement d'une autre organisation serait accepté.
      const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
      if (!event) return null;

      const existing = await tx
        .select({ position: eventVendorSlots.position })
        .from(eventVendorSlots)
        .where(eq(eventVendorSlots.eventId, eventId));
      const position = existing.reduce((max, slot) => Math.max(max, slot.position + 1), 0);
      const [row] = await tx.insert(eventVendorSlots).values({ organizationId, eventId, label, position }).returning();
      if (!row) throw new Error("ajout du poste échoué");
      return row;
    });
  } finally {
    await pg.end();
  }
}

export async function updateEventVendorSlotRow(input: {
  organizationId: string;
  vendorSlotId: string;
  changedByUserId: string;
  status: VendorSlotStatus;
  vendorName?: string | null | undefined;
  amountCents?: number | null | undefined;
}): Promise<EventVendorSlotRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [current] = await tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.id, input.vendorSlotId));
      if (!current) return null;

      const vendorName = input.vendorName === undefined ? current.vendorName : input.vendorName;
      const amountCents = input.amountCents === undefined ? current.amountCents : input.amountCents;

      const [updated] = await tx
        .update(eventVendorSlots)
        .set({ status: input.status, vendorName, amountCents, updatedAt: new Date() })
        .where(eq(eventVendorSlots.id, input.vendorSlotId))
        .returning();
      if (!updated) throw new Error("mise à jour du poste échouée");

      // Publié à la réservation, puis à chaque changement de montant d'un
      // poste réservé (le futur module Budget garde la dernière valeur).
      const becomesBooked = current.status !== "booked" && updated.status === "booked";
      const bookedAmountChanged =
        current.status === "booked" && updated.status === "booked" && current.amountCents !== updated.amountCents;
      if (becomesBooked || bookedAmountChanged) {
        await emitDomainEvent(tx, {
          organizationId: input.organizationId,
          name: EVT_VENDOR_SLOT_BOOKED,
          version: EVT_VENDOR_SLOT_BOOKED_VERSION,
          payload: vendorSlotBookedPayloadSchema.parse({
            eventId: updated.eventId,
            vendorSlotId: updated.id,
            label: updated.label,
            amountCents: updated.amountCents,
            currency: "EUR",
            bookedByUserId: input.changedByUserId,
          }),
        });
      }

      return updated;
    });
  } finally {
    await pg.end();
  }
}

export async function deleteEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.delete(eventVendorSlots).where(eq(eventVendorSlots.id, vendorSlotId)),
    );
  } finally {
    await pg.end();
  }
}
