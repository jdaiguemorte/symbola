// Accès aux données du module events — jamais importé hors de
// modules/events/ (ADR 0011).
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  defaultVendorSlots,
  eventActivities,
  eventClientAccesses,
  eventClients,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorSlots,
  lossReasons,
  programItemParticipants,
  programItems,
  programTemplateItems,
  programTemplates,
  prospectSources,
  taskTemplateItems,
  taskTemplates,
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
  type TaskRecalculation,
  type TaskResponsible,
  type TaskTemplateItemInput,
  type VendorSlotStatus,
} from "@symbola/contracts";
import { addDays, daysBetween, dueDateFor } from "./schedule";

export type EventRow = typeof events.$inferSelect;
export type EventClientRow = typeof eventClients.$inferSelect;
export type ProspectSourceRow = typeof prospectSources.$inferSelect;
export type DefaultVendorSlotRow = typeof defaultVendorSlots.$inferSelect;
export type EventVendorSlotRow = typeof eventVendorSlots.$inferSelect;
export type LossReasonRow = typeof lossReasons.$inferSelect;
export type TaskTemplateRow = typeof taskTemplates.$inferSelect;
export type TaskTemplateItemRow = typeof taskTemplateItems.$inferSelect;
export type EventTaskRow = typeof eventTasks.$inferSelect;
export type ProgramItemRow = typeof programItems.$inferSelect;
export type EventClientAccessRow = typeof eventClientAccesses.$inferSelect;
export type EventActivityRow = typeof eventActivities.$inferSelect;
export type ProgramItemParticipantRow = typeof programItemParticipants.$inferSelect;
export type ProgramTemplateRow = typeof programTemplates.$inferSelect;
export type ProgramTemplateItemRow = typeof programTemplateItems.$inferSelect;

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

// EVT-04 — modèles de rétroplanning.
export async function findTaskTemplates(
  organizationId: string,
): Promise<{ template: TaskTemplateRow; items: TaskTemplateItemRow[] }[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const templates = await tx.select().from(taskTemplates).orderBy(asc(taskTemplates.createdAt));
      const items =
        templates.length > 0
          ? await tx
              .select()
              .from(taskTemplateItems)
              .where(
                inArray(
                  taskTemplateItems.templateId,
                  templates.map((template) => template.id),
                ),
              )
              .orderBy(asc(taskTemplateItems.offsetDays), asc(taskTemplateItems.position))
          : [];
      return templates.map((template) => ({
        template,
        items: items.filter((item) => item.templateId === template.id),
      }));
    });
  } finally {
    await pg.end();
  }
}

export async function insertTaskTemplate(
  organizationId: string,
  name: string,
  items: TaskTemplateItemInput[],
): Promise<{ template: TaskTemplateRow; items: TaskTemplateItemRow[] }> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [template] = await tx.insert(taskTemplates).values({ organizationId, name }).returning();
      if (!template) throw new Error("création du modèle échouée");
      const rows =
        items.length > 0
          ? await tx
              .insert(taskTemplateItems)
              .values(items.map((item, index) => ({ organizationId, templateId: template.id, ...item, position: index })))
              .returning()
          : [];
      return { template, items: rows };
    });
  } finally {
    await pg.end();
  }
}

export async function insertTaskTemplateItem(
  organizationId: string,
  templateId: string,
  item: TaskTemplateItemInput,
): Promise<TaskTemplateItemRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      // Clé étrangère vérifiée sans RLS : on contrôle que le modèle est visible.
      const [template] = await tx
        .select({ id: taskTemplates.id })
        .from(taskTemplates)
        .where(eq(taskTemplates.id, templateId));
      if (!template) return null;
      const existing = await tx
        .select({ position: taskTemplateItems.position })
        .from(taskTemplateItems)
        .where(eq(taskTemplateItems.templateId, templateId));
      const position = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
      const [row] = await tx
        .insert(taskTemplateItems)
        .values({ organizationId, templateId, ...item, position })
        .returning();
      if (!row) throw new Error("ajout de la tâche au modèle échoué");
      return row;
    });
  } finally {
    await pg.end();
  }
}

export async function deleteTaskTemplateItem(organizationId: string, itemId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.delete(taskTemplateItems).where(eq(taskTemplateItems.id, itemId)),
    );
  } finally {
    await pg.end();
  }
}

// Les tâches déjà créées sur les événements restent : elles ne référencent
// pas le modèle.
export async function deleteTaskTemplate(organizationId: string, templateId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, async (tx) => {
      await tx.delete(taskTemplateItems).where(eq(taskTemplateItems.templateId, templateId));
      await tx.delete(taskTemplates).where(eq(taskTemplates.id, templateId));
    });
  } finally {
    await pg.end();
  }
}

// EVT-04 — recalcul des échéances après un changement de date.
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function countUndoneTasks(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(eventTasks)
    .where(and(eq(eventTasks.eventId, eventId), isNull(eventTasks.doneAt)));
  return row?.count ?? 0;
}

// Une proposition est en attente quand la date de l'événement diffère de
// celle qui a servi au calcul des échéances et qu'il reste des tâches non
// faites à décaler.
function recalculationFor(event: EventRow, undoneTasks: number): TaskRecalculation {
  if (!event.eventDate || !event.tasksScheduledFor || event.eventDate === event.tasksScheduledFor || undoneTasks === 0) {
    return { pending: false, shiftDays: 0, undoneTasks };
  }
  return { pending: true, shiftDays: daysBetween(event.tasksScheduledFor, event.eventDate), undoneTasks };
}

export async function updateEventDateRow(
  organizationId: string,
  eventId: string,
  eventDate: string | null,
): Promise<TaskRecalculation | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [current] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!current) return null;
      const undoneTasks = await countUndoneTasks(tx, eventId);
      // Sans tâche à décaler, les échéances suivent directement la nouvelle date.
      const tasksScheduledFor = undoneTasks === 0 ? eventDate : current.tasksScheduledFor;
      const [updated] = await tx
        .update(events)
        .set({ eventDate, tasksScheduledFor, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();
      if (!updated) throw new Error("mise à jour de la date échouée");
      return recalculationFor(updated, undoneTasks);
    });
  } finally {
    await pg.end();
  }
}

export async function findTaskRecalculation(
  organizationId: string,
  eventId: string,
): Promise<TaskRecalculation | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return null;
      return recalculationFor(event, await countUndoneTasks(tx, eventId));
    });
  } finally {
    await pg.end();
  }
}

// Accepter décale les tâches non faites de l'écart entre les deux dates ;
// refuser garde les échéances. Dans les deux cas la proposition est close.
export async function resolveTaskRecalculationRow(
  organizationId: string,
  eventId: string,
  accept: boolean,
): Promise<boolean> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return false;
      const recalculation = recalculationFor(event, await countUndoneTasks(tx, eventId));
      if (!recalculation.pending) return true;
      if (accept) {
        const undone = await tx
          .select()
          .from(eventTasks)
          .where(and(eq(eventTasks.eventId, eventId), isNull(eventTasks.doneAt)));
        for (const task of undone) {
          await tx
            .update(eventTasks)
            .set({ dueDate: addDays(task.dueDate, recalculation.shiftDays), updatedAt: new Date() })
            .where(eq(eventTasks.id, task.id));
        }
      }
      await tx
        .update(events)
        .set({ tasksScheduledFor: event.eventDate, updatedAt: new Date() })
        .where(eq(events.id, eventId));
      return true;
    });
  } finally {
    await pg.end();
  }
}

// EVT-04 — tâches d'un événement.
export type ApplyTaskTemplateResult =
  | { status: "applied"; tasks: EventTaskRow[] }
  | { status: "event_not_found" | "template_not_found" | "date_required" | "recalculation_pending" };

async function nextTaskPosition(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${eventTasks.position})` })
    .from(eventTasks)
    .where(eq(eventTasks.eventId, eventId));
  return row?.max === null || row?.max === undefined ? 0 : row.max + 1;
}

export async function applyTaskTemplateRows(
  organizationId: string,
  eventId: string,
  templateId: string,
): Promise<ApplyTaskTemplateResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return { status: "event_not_found" };
      const [template] = await tx.select().from(taskTemplates).where(eq(taskTemplates.id, templateId));
      if (!template) return { status: "template_not_found" };
      if (!event.eventDate) return { status: "date_required" };
      if (recalculationFor(event, await countUndoneTasks(tx, eventId)).pending) {
        return { status: "recalculation_pending" };
      }

      const items = await tx
        .select()
        .from(taskTemplateItems)
        .where(eq(taskTemplateItems.templateId, templateId))
        .orderBy(asc(taskTemplateItems.offsetDays), asc(taskTemplateItems.position));
      const eventDate = event.eventDate;
      const start = await nextTaskPosition(tx, eventId);
      const tasks =
        items.length > 0
          ? await tx
              .insert(eventTasks)
              .values(
                items.map((item, index) => ({
                  organizationId,
                  eventId,
                  label: item.label,
                  dueDate: dueDateFor(eventDate, item.offsetDays),
                  responsible: item.responsible,
                  position: start + index,
                })),
              )
              .returning()
          : [];
      if (!event.tasksScheduledFor) {
        await tx.update(events).set({ tasksScheduledFor: eventDate }).where(eq(events.id, eventId));
      }
      return { status: "applied", tasks };
    });
  } finally {
    await pg.end();
  }
}

// Vue par mois : tri par mois d'échéance, puis par l'ordre choisi par la planner.
const taskOrder = [sql`date_trunc('month', ${eventTasks.dueDate})`, asc(eventTasks.position), asc(eventTasks.createdAt)];

export async function findEventTasks(organizationId: string, eventId: string): Promise<EventTaskRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(eventTasks)
        .where(eq(eventTasks.eventId, eventId))
        .orderBy(...taskOrder),
    );
  } finally {
    await pg.end();
  }
}

export async function insertEventTask(
  organizationId: string,
  eventId: string,
  task: { label: string; dueDate: string; responsible: TaskResponsible },
): Promise<EventTaskRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      // Clé étrangère vérifiée sans RLS : on contrôle que l'événement est visible.
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return null;
      const position = await nextTaskPosition(tx, eventId);
      const [row] = await tx
        .insert(eventTasks)
        .values({ organizationId, eventId, ...task, position })
        .returning();
      if (!row) throw new Error("ajout de la tâche échoué");
      if (!event.tasksScheduledFor && event.eventDate) {
        await tx.update(events).set({ tasksScheduledFor: event.eventDate }).where(eq(events.id, eventId));
      }
      return row;
    });
  } finally {
    await pg.end();
  }
}

export async function updateEventTaskRow(input: {
  organizationId: string;
  taskId: string;
  label?: string | undefined;
  dueDate?: string | undefined;
  responsible?: TaskResponsible | undefined;
  done?: boolean | undefined;
}): Promise<EventTaskRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [current] = await tx.select().from(eventTasks).where(eq(eventTasks.id, input.taskId));
      if (!current) return null;
      const doneAt = input.done === undefined ? current.doneAt : input.done ? (current.doneAt ?? new Date()) : null;
      const [updated] = await tx
        .update(eventTasks)
        .set({
          label: input.label ?? current.label,
          dueDate: input.dueDate ?? current.dueDate,
          responsible: input.responsible ?? current.responsible,
          doneAt,
          updatedAt: new Date(),
        })
        .where(eq(eventTasks.id, input.taskId))
        .returning();
      return updated ?? null;
    });
  } finally {
    await pg.end();
  }
}

// Échange la tâche avec sa voisine du même mois ; les positions du mois
// sont renumérotées pour rester distinctes.
export async function moveEventTaskRow(
  organizationId: string,
  taskId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.id, taskId));
      if (!task) return false;
      const sameMonth = await tx
        .select()
        .from(eventTasks)
        .where(
          and(
            eq(eventTasks.eventId, task.eventId),
            sql`date_trunc('month', ${eventTasks.dueDate}) = date_trunc('month', ${task.dueDate}::date)`,
          ),
        )
        .orderBy(...taskOrder);
      const index = sameMonth.findIndex((row) => row.id === taskId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= sameMonth.length) return true;
      const ordered = [...sameMonth];
      [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
      const base = Math.min(...sameMonth.map((row) => row.position));
      for (const [offset, row] of ordered.entries()) {
        if (row.position !== base + offset) {
          await tx
            .update(eventTasks)
            .set({ position: base + offset, updatedAt: new Date() })
            .where(eq(eventTasks.id, row.id));
        }
      }
      return true;
    });
  } finally {
    await pg.end();
  }
}

export async function deleteEventTask(organizationId: string, taskId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) => tx.delete(eventTasks).where(eq(eventTasks.id, taskId)));
  } finally {
    await pg.end();
  }
}

// EVT-05 — programme du jour J.
export type ProgramItemData = {
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  internalNote: string | null;
};

export type ProgramItemWithParticipants = {
  item: ProgramItemRow;
  participants: { row: ProgramItemParticipantRow; vendorSlotLabel: string | null }[];
};

async function loadParticipants(tx: Tx, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  return tx
    .select({ row: programItemParticipants, vendorSlotLabel: eventVendorSlots.label })
    .from(programItemParticipants)
    .leftJoin(eventVendorSlots, eq(eventVendorSlots.id, programItemParticipants.vendorSlotId))
    .where(inArray(programItemParticipants.programItemId, itemIds))
    .orderBy(asc(programItemParticipants.position));
}

async function withParticipants(tx: Tx, items: ProgramItemRow[]): Promise<ProgramItemWithParticipants[]> {
  const participants = await loadParticipants(
    tx,
    items.map((item) => item.id),
  );
  return items.map((item) => ({
    item,
    participants: participants.filter((participant) => participant.row.programItemId === item.id),
  }));
}

// Les postes cités doivent appartenir à l'événement (et donc à
// l'organisation : la clé étrangère est vérifiée sans RLS).
async function vendorSlotsBelongToEvent(tx: Tx, eventId: string, vendorSlotIds: string[]): Promise<boolean> {
  const unique = [...new Set(vendorSlotIds)];
  if (unique.length === 0) return true;
  const found = await tx
    .select({ id: eventVendorSlots.id })
    .from(eventVendorSlots)
    .where(and(eq(eventVendorSlots.eventId, eventId), inArray(eventVendorSlots.id, unique)));
  return found.length === unique.length;
}

async function insertParticipants(
  tx: Tx,
  organizationId: string,
  programItemId: string,
  vendorSlotIds: string[],
  freeLabels: string[],
): Promise<void> {
  const rows = [
    ...[...new Set(vendorSlotIds)].map((vendorSlotId) => ({ vendorSlotId, freeLabel: null })),
    ...freeLabels.map((freeLabel) => ({ vendorSlotId: null, freeLabel })),
  ].map((participant, position) => ({ organizationId, programItemId, ...participant, position }));
  if (rows.length > 0) await tx.insert(programItemParticipants).values(rows);
}

async function touchProgram(tx: Tx, eventId: string): Promise<void> {
  await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, eventId));
}

export async function findEventProgram(
  organizationId: string,
  eventId: string,
): Promise<{ event: EventRow; items: ProgramItemWithParticipants[] } | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId));
      if (!event) return null;
      const items = await tx
        .select()
        .from(programItems)
        .where(eq(programItems.eventId, eventId))
        .orderBy(asc(programItems.startTime), asc(programItems.createdAt));
      return { event, items: await withParticipants(tx, items) };
    });
  } finally {
    await pg.end();
  }
}

export type ProgramWriteResult =
  | { status: "saved"; item: ProgramItemWithParticipants }
  | { status: "event_not_found" | "item_not_found" | "participant_not_found" };

export async function insertProgramItem(
  organizationId: string,
  eventId: string,
  data: ProgramItemData,
  vendorSlotIds: string[],
  freeLabels: string[],
): Promise<ProgramWriteResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
      if (!event) return { status: "event_not_found" };
      if (!(await vendorSlotsBelongToEvent(tx, eventId, vendorSlotIds))) return { status: "participant_not_found" };
      const [item] = await tx.insert(programItems).values({ organizationId, eventId, ...data }).returning();
      if (!item) throw new Error("ajout de la ligne du programme échoué");
      await insertParticipants(tx, organizationId, item.id, vendorSlotIds, freeLabels);
      await touchProgram(tx, eventId);
      const [saved] = await withParticipants(tx, [item]);
      return { status: "saved", item: saved! };
    });
  } finally {
    await pg.end();
  }
}

export async function updateProgramItemRow(
  organizationId: string,
  itemId: string,
  data: ProgramItemData,
  vendorSlotIds: string[],
  freeLabels: string[],
): Promise<ProgramWriteResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [current] = await tx.select().from(programItems).where(eq(programItems.id, itemId));
      if (!current) return { status: "item_not_found" };
      if (!(await vendorSlotsBelongToEvent(tx, current.eventId, vendorSlotIds))) {
        return { status: "participant_not_found" };
      }
      const [item] = await tx
        .update(programItems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(programItems.id, itemId))
        .returning();
      if (!item) throw new Error("mise à jour de la ligne du programme échouée");
      await tx.delete(programItemParticipants).where(eq(programItemParticipants.programItemId, itemId));
      await insertParticipants(tx, organizationId, itemId, vendorSlotIds, freeLabels);
      await touchProgram(tx, item.eventId);
      const [saved] = await withParticipants(tx, [item]);
      return { status: "saved", item: saved! };
    });
  } finally {
    await pg.end();
  }
}

export async function deleteProgramItem(organizationId: string, itemId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, async (tx) => {
      const [deleted] = await tx.delete(programItems).where(eq(programItems.id, itemId)).returning();
      if (deleted) await touchProgram(tx, deleted.eventId);
    });
  } finally {
    await pg.end();
  }
}

// EVT-05 — modèles de programme.
export async function findProgramTemplates(
  organizationId: string,
): Promise<{ template: ProgramTemplateRow; items: ProgramTemplateItemRow[] }[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const templates = await tx.select().from(programTemplates).orderBy(asc(programTemplates.createdAt));
      const items =
        templates.length > 0
          ? await tx
              .select()
              .from(programTemplateItems)
              .where(
                inArray(
                  programTemplateItems.templateId,
                  templates.map((template) => template.id),
                ),
              )
              .orderBy(asc(programTemplateItems.startTime), asc(programTemplateItems.position))
          : [];
      return templates.map((template) => ({
        template,
        items: items.filter((item) => item.templateId === template.id),
      }));
    });
  } finally {
    await pg.end();
  }
}

export type ProgramTemplateItemData = Omit<ProgramItemData, "internalNote"> & { participantLabels: string[] };

export async function insertProgramTemplate(
  organizationId: string,
  name: string,
  items: ProgramTemplateItemData[],
): Promise<{ template: ProgramTemplateRow; items: ProgramTemplateItemRow[] }> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [template] = await tx.insert(programTemplates).values({ organizationId, name }).returning();
      if (!template) throw new Error("création du modèle de programme échouée");
      const rows =
        items.length > 0
          ? await tx
              .insert(programTemplateItems)
              .values(items.map((item, position) => ({ organizationId, templateId: template.id, ...item, position })))
              .returning()
          : [];
      return { template, items: rows };
    });
  } finally {
    await pg.end();
  }
}

export async function insertProgramTemplateItem(
  organizationId: string,
  templateId: string,
  item: ProgramTemplateItemData,
): Promise<ProgramTemplateItemRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      // Clé étrangère vérifiée sans RLS : on contrôle que le modèle est visible.
      const [template] = await tx
        .select({ id: programTemplates.id })
        .from(programTemplates)
        .where(eq(programTemplates.id, templateId));
      if (!template) return null;
      const existing = await tx
        .select({ position: programTemplateItems.position })
        .from(programTemplateItems)
        .where(eq(programTemplateItems.templateId, templateId));
      const position = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
      const [row] = await tx
        .insert(programTemplateItems)
        .values({ organizationId, templateId, ...item, position })
        .returning();
      if (!row) throw new Error("ajout de la ligne au modèle échoué");
      return row;
    });
  } finally {
    await pg.end();
  }
}

export async function deleteProgramTemplateItem(organizationId: string, itemId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.delete(programTemplateItems).where(eq(programTemplateItems.id, itemId)),
    );
  } finally {
    await pg.end();
  }
}

// Les lignes déjà copiées dans les programmes restent : elles ne
// référencent pas le modèle.
export async function deleteProgramTemplate(organizationId: string, templateId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.delete(programTemplates).where(eq(programTemplates.id, templateId)),
    );
  } finally {
    await pg.end();
  }
}

export type ApplyProgramTemplateResult =
  | { status: "applied"; items: ProgramItemWithParticipants[] }
  | { status: "event_not_found" | "template_not_found" };

// Copie les lignes du modèle à la suite du programme. Un intervenant du
// modèle devient le poste de l'événement de même libellé (sans tenir
// compte de la casse), sinon un intervenant libre.
export async function applyProgramTemplateRows(
  organizationId: string,
  eventId: string,
  templateId: string,
): Promise<ApplyProgramTemplateResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
      if (!event) return { status: "event_not_found" };
      const [template] = await tx.select().from(programTemplates).where(eq(programTemplates.id, templateId));
      if (!template) return { status: "template_not_found" };

      const templateItems = await tx
        .select()
        .from(programTemplateItems)
        .where(eq(programTemplateItems.templateId, templateId))
        .orderBy(asc(programTemplateItems.startTime), asc(programTemplateItems.position));
      const slots = await tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.eventId, eventId));
      const slotByLabel = new Map(slots.map((slot) => [slot.label.trim().toLowerCase(), slot.id]));

      const created: ProgramItemRow[] = [];
      for (const templateItem of templateItems) {
        const [item] = await tx
          .insert(programItems)
          .values({
            organizationId,
            eventId,
            startTime: templateItem.startTime,
            endTime: templateItem.endTime,
            label: templateItem.label,
            location: templateItem.location,
          })
          .returning();
        if (!item) throw new Error("copie de la ligne du modèle échouée");
        const vendorSlotIds: string[] = [];
        const freeLabels: string[] = [];
        for (const label of templateItem.participantLabels) {
          const slotId = slotByLabel.get(label.trim().toLowerCase());
          if (slotId) vendorSlotIds.push(slotId);
          else freeLabels.push(label.trim());
        }
        await insertParticipants(tx, organizationId, item.id, vendorSlotIds, freeLabels);
        created.push(item);
      }
      if (created.length > 0) await touchProgram(tx, eventId);
      return { status: "applied", items: await withParticipants(tx, created) };
    });
  } finally {
    await pg.end();
  }
}

// EVT-06 — accès des mariés.
export async function findEventClientAccesses(organizationId: string, eventId: string): Promise<EventClientAccessRow[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(eventClientAccesses)
        .where(eq(eventClientAccesses.eventId, eventId))
        .orderBy(asc(eventClientAccesses.createdAt)),
    );
  } finally {
    await pg.end();
  }
}

export type SaveClientAccessResult =
  | { status: "saved"; access: EventClientAccessRow }
  | { status: "event_not_found" | "already_active" };

// Une invitation encore en attente pour le même e-mail est renouvelée
// (nouveau jeton, nouvelle échéance) plutôt que doublée.
export async function saveClientAccess(input: {
  organizationId: string;
  eventId: string;
  email: string;
  invitedByUserId: string;
  expiresAt: Date;
  tokenHash: string | null;
  userId: string | null;
}): Promise<SaveClientAccessResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      // Clé étrangère vérifiée sans RLS : on contrôle que l'événement est visible.
      const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
      if (!event) return { status: "event_not_found" };

      const [current] = await tx
        .select()
        .from(eventClientAccesses)
        .where(
          and(
            eq(eventClientAccesses.eventId, input.eventId),
            sql`lower(${eventClientAccesses.email}) = lower(${input.email})`,
            isNull(eventClientAccesses.revokedAt),
          ),
        );
      const acceptedAt = input.userId ? new Date() : null;
      if (current?.acceptedAt) return { status: "already_active" };
      if (current) {
        const [access] = await tx
          .update(eventClientAccesses)
          .set({
            tokenHash: input.tokenHash,
            userId: input.userId,
            acceptedAt,
            expiresAt: input.expiresAt,
            invitedByUserId: input.invitedByUserId,
          })
          .where(eq(eventClientAccesses.id, current.id))
          .returning();
        return { status: "saved", access: access! };
      }
      const [access] = await tx
        .insert(eventClientAccesses)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          email: input.email,
          tokenHash: input.tokenHash,
          userId: input.userId,
          acceptedAt,
          expiresAt: input.expiresAt,
          invitedByUserId: input.invitedByUserId,
        })
        .returning();
      if (!access) throw new Error("création de l'accès échouée");
      return { status: "saved", access };
    });
  } finally {
    await pg.end();
  }
}

// Retirer un accès invalide aussi le jeton d'une invitation en attente.
export async function revokeClientAccessRow(organizationId: string, accessId: string): Promise<void> {
  const { sql: pg, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx
        .update(eventClientAccesses)
        .set({ revokedAt: new Date(), tokenHash: null })
        .where(and(eq(eventClientAccesses.id, accessId), isNull(eventClientAccesses.revokedAt))),
    );
  } finally {
    await pg.end();
  }
}

export async function findClientAccessByTokenHash(
  organizationId: string,
  tokenHash: string,
): Promise<EventClientAccessRow | null> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [access] = await tx.select().from(eventClientAccesses).where(eq(eventClientAccesses.tokenHash, tokenHash));
      return access ?? null;
    });
  } finally {
    await pg.end();
  }
}

// Le jeton ne sert qu'une fois (acceptedAt) ; son haché reste pour pouvoir
// répondre « invitation déjà acceptée » à un second clic sur le lien.
export async function markClientAccessAccepted(organizationId: string, accessId: string, userId: string): Promise<boolean> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const updated = await tx
        .update(eventClientAccesses)
        .set({ userId, acceptedAt: new Date() })
        .where(
          and(
            eq(eventClientAccesses.id, accessId),
            isNull(eventClientAccesses.acceptedAt),
            isNull(eventClientAccesses.revokedAt),
          ),
        )
        .returning({ id: eventClientAccesses.id });
      return updated.length === 1;
    });
  } finally {
    await pg.end();
  }
}

function activeAccessFor(userId: string) {
  return and(
    eq(eventClientAccesses.userId, userId),
    isNotNull(eventClientAccesses.acceptedAt),
    isNull(eventClientAccesses.revokedAt),
  );
}

export async function findClientEventIds(organizationId: string, userId: string): Promise<string[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const rows = await tx
        .selectDistinct({ eventId: eventClientAccesses.eventId })
        .from(eventClientAccesses)
        .where(activeAccessFor(userId));
      return rows.map((row) => row.eventId);
    });
  } finally {
    await pg.end();
  }
}

export async function hasActiveClientAccess(organizationId: string, userId: string, eventId: string): Promise<boolean> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [row] = await tx
        .select({ id: eventClientAccesses.id })
        .from(eventClientAccesses)
        .where(and(activeAccessFor(userId), eq(eventClientAccesses.eventId, eventId)));
      return row !== undefined;
    });
  } finally {
    await pg.end();
  }
}

export type ClientTaskToggleResult = { status: "saved"; task: EventTaskRow } | { status: "denied" };

// Le marié ne coche que les tâches « mariés » d'un événement auquel il a
// accès ; chaque changement est inscrit au fil d'activité, dans la même
// transaction.
export async function toggleClientTask(
  organizationId: string,
  userId: string,
  taskId: string,
  done: boolean,
): Promise<ClientTaskToggleResult> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.id, taskId));
      if (!task || task.responsible !== "clients") return { status: "denied" };
      const [access] = await tx
        .select({ id: eventClientAccesses.id })
        .from(eventClientAccesses)
        .where(and(activeAccessFor(userId), eq(eventClientAccesses.eventId, task.eventId)));
      if (!access) return { status: "denied" };

      if ((task.doneAt !== null) === done) return { status: "saved", task };
      const [updated] = await tx
        .update(eventTasks)
        .set({ doneAt: done ? new Date() : null, updatedAt: new Date() })
        .where(eq(eventTasks.id, taskId))
        .returning();
      await tx.insert(eventActivities).values({
        organizationId,
        eventId: task.eventId,
        actorUserId: userId,
        kind: done ? "task_done" : "task_undone",
        taskId,
        taskLabel: task.label,
      });
      return { status: "saved", task: updated! };
    });
  } finally {
    await pg.end();
  }
}

export async function findEventActivity(
  organizationId: string,
  eventId: string,
): Promise<{ activity: EventActivityRow; actorEmail: string | null }[]> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const activity = await tx
        .select()
        .from(eventActivities)
        .where(eq(eventActivities.eventId, eventId))
        .orderBy(desc(eventActivities.createdAt));
      const actorIds = [...new Set(activity.map((row) => row.actorUserId))];
      const accesses =
        actorIds.length > 0
          ? await tx
              .select({ userId: eventClientAccesses.userId, email: eventClientAccesses.email })
              .from(eventClientAccesses)
              .where(and(eq(eventClientAccesses.eventId, eventId), inArray(eventClientAccesses.userId, actorIds)))
          : [];
      const emailByUser = new Map(accesses.map((access) => [access.userId, access.email]));
      return activity.map((row) => ({ activity: row, actorEmail: emailByUser.get(row.actorUserId) ?? null }));
    });
  } finally {
    await pg.end();
  }
}
