// Accès aux données du module events — jamais importé hors de
// modules/events/ (ADR 0011).
import { and, asc, desc, eq, exists, gt, gte, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { actingMemberId, assertAssignable, emitTaskAssignments } from "./task-assignment";
import { appDatabase } from "@symbola/db/client";
import {
  dayReminderOverrides,
  defaultVendorSlots,
  eventActivities,
  eventClients,
  eventLinks,
  eventPlaces,
  events,
  eventStatusHistory,
  eventTasks,
  eventTypes,
  eventVendorCandidates,
  eventVendorSlots,
  lossReasons,
  programItemParticipants,
  programItems,
  programTemplateItems,
  keyMoments,
  programTemplates,
  prospectSources,
  taskTemplateItems,
  taskTemplates,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { foldedColumn, foldedContains, likeWord } from "@symbola/db/search";
import { emitDomainEvent } from "@symbola/db/events/emit";
import {
  EVT_EVENT_CREATED,
  EVT_EVENT_CREATED_VERSION,
  EVT_EVENT_STATUS_CHANGED,
  EVT_EVENT_STATUS_CHANGED_VERSION,
  ENGAGED_CANDIDATE_STATUSES,
  type EventStatus,
  type TaskRecalculation,
  type TaskPriority,
  type TaskResponsible,
  type TaskTemplateItemInput,
  type VendorCandidateStatus,
} from "@symbola/contracts";
import { addDays, daysBetween, dueDateFor } from "./schedule";
import { isVisibleCategory } from "./task-categories";
import { shiftedTimes } from "./program";
import { ensureMainKeyMoment, followEventDate, keyMomentOfEvent } from "./main-moment";
import { resolveClientContacts, withContacts, type EventClientLinkRow, type EventClientRow } from "./clients";
import { searchContactIds, searchContactIdsByWord } from "@/modules/hub/service";

export type EventRow = typeof events.$inferSelect;
// Lot 34b (EVT-03, D10) : un événement et son lieu de réception, le premier lieu de la liste.
export type EventRecord = EventRow & { venueName: string | null; venueCity: string | null };
// Lot 36a (CRM-03, ADR 0069) : un client est un lien vers un contact du hub, complété par lui.
export type { EventClientRow } from "./clients";

async function resolveClients<T extends { clients: EventClientLinkRow[] }>(organizationId: string, items: T[]): Promise<(Omit<T, "clients"> & { clients: EventClientRow[] })[]> {
  const resolved = new Map((await withContacts(organizationId, items.flatMap((item) => item.clients))).map((client) => [client.id, client]));
  return items.map((item) => ({ ...item, clients: item.clients.map((client) => resolved.get(client.id)!) }));
}
export type ProspectSourceRow = typeof prospectSources.$inferSelect;
export type DefaultVendorSlotRow = typeof defaultVendorSlots.$inferSelect;
export type EventVendorSlotRow = typeof eventVendorSlots.$inferSelect;
export type LossReasonRow = typeof lossReasons.$inferSelect;
export type TaskTemplateRow = typeof taskTemplates.$inferSelect;
export type TaskTemplateItemRow = typeof taskTemplateItems.$inferSelect;
export type EventTaskRow = typeof eventTasks.$inferSelect;
export type ProgramItemRow = typeof programItems.$inferSelect;
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
    // Lot 71f (P-06) : le filtre « Origine » de la liste.
    origin?: "created" | "takeover" | undefined;
  },
): Promise<{ event: EventRecord; clients: EventClientRow[] }[]> {
  const db = appDatabase();
  // Lot 36a : le nom des clients est celui de leur contact, cherché chez le hub.
  const contactIds = filters.search ? await searchContactIds(organizationId, filters.search) : [];
  const found = await withOrganization(db, organizationId, async (tx) => {
    let matchingIds: string[] | undefined;
    if (filters.search) {
      const term = `%${filters.search}%`;
      const matches = await tx
        .selectDistinct({ id: events.id })
        .from(events)
        .leftJoin(eventClients, eq(eventClients.eventId, events.id))
        .where(
          or(
            // Lot 34b (D10) : les lieux de l'événement, réception comprise.
            sql`exists (select 1 from "events"."event_places" ep where ep.event_id = ${events.id} and (ep.label ilike ${term} or ep.city ilike ${term}))`,
            contactIds.length > 0 ? inArray(eventClients.contactId, contactIds) : sql`false`,
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
    if (filters.origin) {
      conditions.push(eq(events.origin, filters.origin));
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

    return (await withVenues(tx, eventRows)).map((event) => ({
      event,
      clients: clientRows.filter((client) => client.eventId === event.id),
    }));
  });
  return resolveClients(organizationId, found);
}

// Lot 34b (EVT-03, D10) : le lieu de réception de chaque événement, son premier lieu (intitulé et
// ville).
async function withVenues(tx: Tx, rows: EventRow[]): Promise<EventRecord[]> {
  if (rows.length === 0) return [];
  const firsts = await tx
    .selectDistinctOn([eventPlaces.eventId], { eventId: eventPlaces.eventId, label: eventPlaces.label, city: eventPlaces.city })
    .from(eventPlaces)
    .where(inArray(eventPlaces.eventId, rows.map((row) => row.id)))
    .orderBy(eventPlaces.eventId, asc(eventPlaces.position), asc(eventPlaces.createdAt));
  const byEvent = new Map(firsts.map((first) => [first.eventId, first]));
  return rows.map((row) => ({ ...row, venueName: byEvent.get(row.id)?.label ?? null, venueCity: byEvent.get(row.id)?.city ?? null }));
}

// Le lieu de réception saisi à la création (ou à l'import) devient le premier lieu ; sans nom, la
// ville sert d'intitulé.
async function insertVenuePlace(tx: Tx, organizationId: string, eventId: string, venueName: string | null | undefined, venueCity: string | null | undefined): Promise<void> {
  const name = venueName?.trim() || null;
  const city = venueCity?.trim() || null;
  if (!name && !city) return;
  const [first] = await tx.select({ position: sql<number>`min(${eventPlaces.position})` }).from(eventPlaces).where(eq(eventPlaces.eventId, eventId));
  await tx.insert(eventPlaces).values({ organizationId, eventId, label: (name ?? city)!, city: name ? city : null, position: first?.position === null || first?.position === undefined ? 0 : Number(first.position) - 1 });
}

export async function findEventById(
  organizationId: string,
  eventId: string,
): Promise<{ event: EventRecord; clients: EventClientRow[] } | null> {
  const db = appDatabase();
  const found = await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!row) return null;
    const [event] = await withVenues(tx, [row]);
    const clients = await tx
      .select()
      .from(eventClients)
      .where(eq(eventClients.eventId, eventId))
      .orderBy(asc(eventClients.position));
    return { event: event!, clients };
  });
  if (!found) return null;
  const [resolved] = await resolveClients(organizationId, [found]);
  return resolved!;
}

export async function insertProspect(input: {
  organizationId: string;
  // Lot 44 (CRM-01, D5) : null pour un prospect créé par le formulaire de contact public.
  createdByUserId: string | null;
  // Lot 36a : les contacts des clients, déjà résolus chez le hub, dans l'ordre.
  clientContactIds: string[];
  // Lot 63c (Q43) : nom facultatif de l'évènement.
  name?: string | null | undefined;
  prospectSourceId: string | null;
  eventTypeId?: string | null | undefined;
  eventDate?: string | null | undefined;
  venueName?: string | null | undefined;
  venueCity?: string | null | undefined;
  // Lot 44 (CRM-01, CRM-02) : invités estimés, budget souhaité et étape du pipeline reçus du formulaire.
  guestsEstimated?: number | null | undefined;
  wantedBudgetCents?: number | null | undefined;
  pipelineStageId?: string | null | undefined;
  // Lot 71b (HUB-14) : un mariage saisi sur la page de reprise, Confirmé, d'origine « reprise ».
  takeover?: boolean | undefined;
  // Écritures de l'appelant dans la même transaction (la demande reçue et son événement interne).
  afterInsert?: ((tx: Tx, event: EventRow) => Promise<void>) | undefined;
}): Promise<EventRow> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        organizationId: input.organizationId,
        status: input.takeover ? "confirmed" : "option",
        origin: input.takeover ? "takeover" : "created",
        name: input.name ?? null,
        eventDate: input.eventDate ?? null,
        prospectSourceId: input.prospectSourceId,
        eventTypeId: input.eventTypeId ?? null,
        guestsEstimated: input.guestsEstimated ?? null,
        wantedBudgetCents: input.wantedBudgetCents ?? null,
        pipelineStageId: input.pipelineStageId ?? null,
      })
      .returning();
    if (!event) throw new Error("création de l'événement échouée");
    await insertVenuePlace(tx, input.organizationId, event.id, input.venueName, input.venueCity);

    for (const [index, contactId] of input.clientContactIds.entries()) {
      await tx.insert(eventClients).values({ organizationId: input.organizationId, eventId: event.id, contactId, position: index });
    }

    // PRD-EVT-03 : l'événement reçoit la liste de postes par défaut de la planner.
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
          icon: slot.icon,
          position: index,
        })),
      );
    }

    await tx.insert(eventStatusHistory).values({
      organizationId: input.organizationId,
      eventId: event.id,
      fromStatus: null,
      toStatus: input.takeover ? "confirmed" : "option",
      changedByUserId: input.createdByUserId,
      // Lot 71b (C-64) : signé avant la reprise, à une date que la planner n'a pas dite.
      dateKnown: !input.takeover,
    });

    await emitDomainEvent(tx, {
      organizationId: input.organizationId,
      name: EVT_EVENT_CREATED,
      version: EVT_EVENT_CREATED_VERSION,
      payload: { eventId: event.id, status: event.status },
    });
    if (input.afterInsert) await input.afterInsert(tx, event);

    return event;
  });
}

export async function updateEventStatus(input: {
  organizationId: string;
  eventId: string;
  changedByUserId: string;
  toStatus: EventStatus;
  lossReasonId?: string | null;
  lossReasonNote?: string | null;
  // Lot 72a (J2, migration 0224) : la date effective du changement (« Signé le », jour d'une annulation).
  effectiveOn?: string | null;
  // Lot 72a : le changement n'a lieu que depuis ce statut (relu dans la transaction).
  expectFrom?: EventStatus;
}): Promise<EventRow> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [current] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("update");
    if (!current) throw new Error("événement introuvable");
    if (input.expectFrom && current.status !== input.expectFrom) throw new StatusChangedMeanwhileError();

    // Lot 34a (EVT-05, D6) : l'annulation garde son motif ; quitter un report en cours (par une
    // annulation) oublie la date et le statut d'avant.
    const [updated] = await tx
      .update(events)
      .set({
        status: input.toStatus,
        lossReasonId: input.toStatus === "cancelled" ? (input.lossReasonId ?? null) : null,
        lossReasonNote: input.toStatus === "cancelled" ? (input.lossReasonNote ?? null) : null,
        ...(input.toStatus === "postponed" ? {} : { postponedFromDate: null, postponedFromStatus: null }),
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
      effectiveOn: input.effectiveOn ?? null,
    });

    // AIDE-02 : un événement d'essai ne publie rien (aucun consommateur
    // ne doit voir de donnée fictive).
    if (!current.isDemo) {
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
    }

    return updated;
  });
}

export async function findProspectSources(organizationId: string): Promise<ProspectSourceRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(prospectSources)
      .where(eq(prospectSources.organizationId, organizationId))
      .orderBy(asc(prospectSources.createdAt)),
  );
}

export async function insertProspectSource(organizationId: string, label: string): Promise<ProspectSourceRow> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.insert(prospectSources).values({ organizationId, label }).returning();
    if (!row) throw new Error("création de la source échouée");
    return row;
  });
}

export async function findLossReasons(organizationId: string): Promise<LossReasonRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(lossReasons)
      .where(eq(lossReasons.organizationId, organizationId))
      .orderBy(asc(lossReasons.createdAt)),
  );
}

export async function insertLossReason(
  organizationId: string,
  label: string,
  isFreeText: boolean,
): Promise<LossReasonRow> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.insert(lossReasons).values({ organizationId, label, isFreeText }).returning();
    if (!row) throw new Error("création du motif échouée");
    return row;
  });
}

// PRD-EVT-03 — liste de postes par défaut de l'organisation.
export async function findDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlotRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(defaultVendorSlots)
      .orderBy(asc(defaultVendorSlots.position), asc(defaultVendorSlots.createdAt)),
  );
}

// Ajoute les libellés absents de la liste (comparaison sans tenir compte
// de la casse), à la suite des postes existants : recharger le modèle de
// départ ne crée pas de doublon.
export async function insertDefaultVendorSlots(
  organizationId: string,
  entries: (string | { label: string; icon?: string | null })[],
): Promise<DefaultVendorSlotRow[]> {
  const labels = entries.map((entry) => (typeof entry === "string" ? entry : entry.label));
  const icons = new Map(entries.map((entry) => (typeof entry === "string" ? [entry.trim().toLowerCase(), null] : [entry.label.trim().toLowerCase(), entry.icon ?? null])));
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const existing = await tx.select().from(defaultVendorSlots);
    const known = new Set(existing.map((slot) => slot.label.trim().toLowerCase()));
    let nextPosition = existing.reduce((max, slot) => Math.max(max, slot.position + 1), 0);
    const toInsert = [];
    for (const label of labels.map((value) => value.trim()).filter(Boolean)) {
      const key = label.toLowerCase();
      if (known.has(key)) continue;
      known.add(key);
      toInsert.push({ organizationId, label, icon: icons.get(key) ?? null, position: nextPosition++ });
    }
    if (toInsert.length === 0) return [];
    return tx.insert(defaultVendorSlots).values(toInsert).returning();
  });
}

export async function deleteDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) =>
    tx.delete(defaultVendorSlots).where(eq(defaultVendorSlots.id, defaultVendorSlotId)),
  );
}

// Lot 13 (L13-HUB-16) — nouvel ordre des lignes du budget par défaut : la liste
// doit contenir exactement les lignes de l'organisation (sinon rien ne
// change, renvoie false) ; chaque position vaut son rang.
export async function reorderDefaultVendorSlotRows(organizationId: string, orderedIds: string[]): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const existing = await tx.select({ id: defaultVendorSlots.id }).from(defaultVendorSlots);
    const known = new Set(existing.map((slot) => slot.id));
    if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length || !orderedIds.every((id) => known.has(id))) return false;
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(defaultVendorSlots).set({ position }).where(eq(defaultVendorSlots.id, id));
    }
    return true;
  });
}

// PRD-EVT-03 — postes d'un événement.
export async function findEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlotRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(eventVendorSlots)
      .where(eq(eventVendorSlots.eventId, eventId))
      .orderBy(asc(eventVendorSlots.position), asc(eventVendorSlots.createdAt)),
  );
}

export async function insertEventVendorSlot(
  organizationId: string,
  eventId: string,
  label: string,
): Promise<EventVendorSlotRow | null> {
  const db = appDatabase();
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
}

// Lot 28b (PRE-02, décision D14) : « Non requis » est la seule donnée du poste
// qui change ici ; ses prestataires retenus portent le reste.
export async function updateEventVendorSlotRow(input: { organizationId: string; vendorSlotId: string; notRequired: boolean }): Promise<EventVendorSlotRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [updated] = await tx
      .update(eventVendorSlots)
      .set({ notRequired: input.notRequired, updatedAt: new Date() })
      .where(eq(eventVendorSlots.id, input.vendorSlotId))
      .returning();
    return updated ?? null;
  });
}

// Lot 28a (PRE-02) — statuts des prestataires rattachés, par poste, pour en
// déduire le statut affiché de chaque poste.
export async function findCandidateStatuses(organizationId: string, eventIds: string[]): Promise<{ vendorSlotId: string; status: VendorCandidateStatus }[]> {
  if (eventIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ vendorSlotId: eventVendorCandidates.vendorSlotId, status: eventVendorCandidates.status })
      .from(eventVendorCandidates)
      .where(inArray(eventVendorCandidates.eventId, eventIds)),
  );
}

export async function deleteEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) =>
    tx.delete(eventVendorSlots).where(eq(eventVendorSlots.id, vendorSlotId)),
  );
}

// PRD-EVT-04 — modèles de rétroplanning.
export async function findTaskTemplates(
  organizationId: string,
): Promise<{ template: TaskTemplateRow; items: TaskTemplateItemRow[] }[]> {
  const db = appDatabase();
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
}

export async function insertTaskTemplate(
  organizationId: string,
  name: string,
  items: TaskTemplateItemInput[],
  eventTypeId: string | null = null,
): Promise<{ template: TaskTemplateRow; items: TaskTemplateItemRow[] }> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [template] = await tx.insert(taskTemplates).values({ organizationId, name, eventTypeId }).returning();
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
}

export async function insertTaskTemplateItem(
  organizationId: string,
  templateId: string,
  item: TaskTemplateItemInput,
): Promise<TaskTemplateItemRow | null> {
  const db = appDatabase();
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
}

// Lot 21 (L21-EVT-22) : une ligne de modèle se corrige sans être recréée ; elle
// garde sa place.
export async function updateTaskTemplateItemRow(organizationId: string, itemId: string, item: TaskTemplateItemInput): Promise<TaskTemplateItemRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.update(taskTemplateItems).set(item).where(eq(taskTemplateItems.id, itemId)).returning();
    return row ?? null;
  });
}

// Lot 34a (EVT-01, D8) : rattacher un modèle à un type d'événement (ou le détacher).
export async function setTaskTemplateEventTypeRow(organizationId: string, templateId: string, eventTypeId: string | null): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    if (eventTypeId) {
      const [type] = await tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, eventTypeId));
      if (!type) return false;
    }
    const rows = await tx.update(taskTemplates).set({ eventTypeId }).where(eq(taskTemplates.id, templateId)).returning({ id: taskTemplates.id });
    return rows.length > 0;
  });
}

// Le modèle à appliquer à la création : celui du type, sinon le premier créé.
// Lot 63a (EVT-01, CHR-01, HUB-21 ; recette du 21/11/2026) : seul le modèle du type de l'évènement
// s'applique. Plus de repli sur le premier modèle de l'organisation : un shooting ou un évènement
// « Autres » recevait le rétroplanning du mariage. Sans type ou sans modèle pour ce type : rien.
export async function findDefaultTaskTemplateId(organizationId: string, eventTypeId: string | null): Promise<string | null> {
  if (!eventTypeId) return null;
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [typed] = await tx.select({ id: taskTemplates.id }).from(taskTemplates).where(eq(taskTemplates.eventTypeId, eventTypeId)).orderBy(asc(taskTemplates.createdAt)).limit(1);
    return typed?.id ?? null;
  });
}

export async function renameTaskTemplateRow(organizationId: string, templateId: string, name: string): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx.update(taskTemplates).set({ name }).where(eq(taskTemplates.id, templateId)).returning({ id: taskTemplates.id });
    return rows.length > 0;
  });
}

export async function deleteTaskTemplateItem(organizationId: string, itemId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) =>
    tx.delete(taskTemplateItems).where(eq(taskTemplateItems.id, itemId)),
  );
}

// Les tâches déjà créées sur les événements restent : elles ne référencent
// pas le modèle.
// Lot 39a (HUB-17 ; ADR 0073) : le modèle va à la corbeille avec ses lignes ; la purge les efface.
export async function deleteTaskTemplate(organizationId: string, templateId: string): Promise<void> {
  await inTrash(organizationId, (tx) => tx.update(taskTemplates).set(markDeleted()).where(and(eq(taskTemplates.id, templateId), isNull(taskTemplates.deletedAt))));
}

// PRD-EVT-04 — recalcul des échéances après un changement de date.
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function countUndoneTasks(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(eventTasks)
    .where(and(eq(eventTasks.eventId, eventId), isNull(eventTasks.doneAt), isNull(eventTasks.fixedAt)));
  return row?.count ?? 0;
}

// Lot 34a (CHR-01, DAT-07) : nouvelle échéance d'une tâche non faite et non fixée — la date de
// l'événement plus son écart ; une tâche d'avant le lot 34a sans écart suit l'écart des deux dates.
function shiftedDueDate(task: EventTaskRow, eventDate: string, shiftDays: number): string {
  return task.offsetDays === null ? addDays(task.dueDate, shiftDays) : addDays(eventDate, task.offsetDays);
}

async function movableTasks(tx: Tx, eventId: string): Promise<EventTaskRow[]> {
  return tx
    .select()
    .from(eventTasks)
    .where(and(eq(eventTasks.eventId, eventId), isNull(eventTasks.doneAt), isNull(eventTasks.fixedAt)))
    .orderBy(asc(eventTasks.dueDate), asc(eventTasks.position));
}

export type TaskMoveRow = { taskId: string; label: string; fromDate: string; toDate: string };

// Ce que ferait le recalcul : chaque tâche non faite et non fixée, de sa date à la nouvelle.
export async function previewTaskRecalculationRows(organizationId: string, eventId: string): Promise<TaskMoveRow[] | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const recalculation = recalculationFor(event, await countUndoneTasks(tx, eventId));
    if (!recalculation.pending || !event.eventDate) return [];
    const eventDate = event.eventDate;
    return (await movableTasks(tx, eventId))
      .map((task) => ({ taskId: task.id, label: task.label, fromDate: task.dueDate, toDate: shiftedDueDate(task, eventDate, recalculation.shiftDays) }))
      .filter((move) => move.fromDate !== move.toDate);
  });
}

async function applyRecalculation(tx: Tx, event: EventRow, shiftDays: number): Promise<void> {
  if (!event.eventDate) return;
  const eventDate = event.eventDate;
  for (const task of await movableTasks(tx, event.id)) {
    const dueDate = shiftedDueDate(task, eventDate, shiftDays);
    await tx
      .update(eventTasks)
      .set({ dueDate, offsetDays: task.offsetDays ?? daysBetween(eventDate, dueDate), updatedAt: new Date() })
      .where(eq(eventTasks.id, task.id));
  }
}

// Lot 34a (DAT-07) : échéances gardées malgré la nouvelle date — l'écart de chaque tâche se compte
// désormais depuis cette date, pour qu'un report suivant ne rejoue pas le décalage refusé.
async function keepDueDates(tx: Tx, event: EventRow): Promise<void> {
  if (!event.eventDate) return;
  const eventDate = event.eventDate;
  for (const task of await movableTasks(tx, event.id)) {
    await tx.update(eventTasks).set({ offsetDays: daysBetween(eventDate, task.dueDate), updatedAt: new Date() }).where(eq(eventTasks.id, task.id));
  }
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
  const db = appDatabase();
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
    await followEventDate(tx, eventId, current.eventDate, eventDate);
    return recalculationFor(updated, undoneTasks);
  });
}

// Historique et événement interne d'un changement de statut (hors événement fictif).
async function recordStatusChange(tx: Tx, current: EventRow, toStatus: EventStatus, changedByUserId: string): Promise<void> {
  await tx.insert(eventStatusHistory).values({
    organizationId: current.organizationId,
    eventId: current.id,
    fromStatus: current.status,
    toStatus,
    changedByUserId,
  });
  if (current.isDemo) return;
  await emitDomainEvent(tx, {
    organizationId: current.organizationId,
    name: EVT_EVENT_STATUS_CHANGED,
    version: EVT_EVENT_STATUS_CHANGED_VERSION,
    payload: { eventId: current.id, fromStatus: current.status, toStatus, changedByUserId },
  });
}

// Lot 34a (EVT-05, D4) — reporter : la date et le statut d'avant sont gardés ; la nouvelle date
// (ou « date à définir ») s'applique, et les échéances attendent la confirmation du report.
export type PostponeEventResult = { status: "postponed"; event: EventRow } | { status: "not_found" | "not_postponable" };

export async function postponeEventRow(input: { organizationId: string; eventId: string; changedByUserId: string; newDate: string | null }): Promise<PostponeEventResult> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [current] = await tx.select().from(events).where(eq(events.id, input.eventId));
    if (!current) return { status: "not_found" };
    if (current.status !== "confirmed") return { status: "not_postponable" };
    const [updated] = await tx
      .update(events)
      .set({ status: "postponed", postponedFromDate: current.eventDate, postponedFromStatus: current.status, eventDate: input.newDate, updatedAt: new Date() })
      .where(eq(events.id, input.eventId))
      .returning();
    if (!updated) throw new Error("report de l'événement échoué");
    await followEventDate(tx, input.eventId, current.eventDate, input.newDate);
    await recordStatusChange(tx, current, "postponed", input.changedByUserId);
    return { status: "postponed", event: updated };
  });
}

// Confirmer le report : les échéances relatives suivent la nouvelle date (les tâches faites et
// fixées ne bougent pas, CHR-01), et l'événement retrouve son statut d'avant.
export type ConfirmPostponementResult =
  | { status: "confirmed"; event: EventRow; previousDate: string | null }
  | { status: "not_found" | "not_postponed" | "date_required" };

export async function confirmPostponementRow(input: { organizationId: string; eventId: string; changedByUserId: string }): Promise<ConfirmPostponementResult> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [current] = await tx.select().from(events).where(eq(events.id, input.eventId));
    if (!current) return { status: "not_found" };
    if (current.status !== "postponed") return { status: "not_postponed" };
    if (!current.eventDate) return { status: "date_required" };
    const recalculation = recalculationFor(current, await countUndoneTasks(tx, input.eventId));
    if (recalculation.pending) await applyRecalculation(tx, current, recalculation.shiftDays);
    const toStatus = current.postponedFromStatus ?? "confirmed";
    const [updated] = await tx
      .update(events)
      .set({ status: toStatus, tasksScheduledFor: current.eventDate, postponedFromDate: null, postponedFromStatus: null, updatedAt: new Date() })
      .where(eq(events.id, input.eventId))
      .returning();
    if (!updated) throw new Error("confirmation du report échouée");
    await recordStatusChange(tx, current, toStatus, input.changedByUserId);
    return { status: "confirmed", event: updated, previousDate: current.postponedFromDate };
  });
}

// Lot 34a (ARC-17, D9) — fuseau de l'événement (déjà validé par l'appelant).
export async function updateEventTimeZoneRow(organizationId: string, eventId: string, timeZone: string): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx.update(events).set({ timeZone, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
    return rows.length > 0;
  });
}

export async function findTaskRecalculation(
  organizationId: string,
  eventId: string,
): Promise<TaskRecalculation | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!event) return null;
    return recalculationFor(event, await countUndoneTasks(tx, eventId));
  });
}

// Accepter décale les tâches non faites de l'écart entre les deux dates ;
// refuser garde les échéances. Dans les deux cas la proposition est close.
export async function resolveTaskRecalculationRow(
  organizationId: string,
  eventId: string,
  accept: boolean,
): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!event) return false;
    const recalculation = recalculationFor(event, await countUndoneTasks(tx, eventId));
    if (!recalculation.pending) return true;
    if (accept) await applyRecalculation(tx, event, recalculation.shiftDays);
    else await keepDueDates(tx, event);
    await tx
      .update(events)
      .set({ tasksScheduledFor: event.eventDate, updatedAt: new Date() })
      .where(eq(events.id, eventId));
    return true;
  });
}

// PRD-EVT-04 — tâches d'un événement.
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
  const db = appDatabase();
  // Lot 70a (A3) : les tâches « planner » du modèle sont à la personne qui l'applique.
  const actorId = await actingMemberId();
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
                // DAT-07 : la tâche garde sa date relative.
                offsetDays: item.offsetDays,
                responsible: item.responsible,
                assigneeUserId: item.responsible === "planner" ? actorId : null,
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
}

// Vue par mois : tri par mois d'échéance, puis par l'ordre choisi par la planner.
const taskOrder = [sql`date_trunc('month', ${eventTasks.dueDate})`, asc(eventTasks.position), asc(eventTasks.createdAt)];

export async function findEventTasks(organizationId: string, eventId: string): Promise<EventTaskRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(eventTasks)
      .where(eq(eventTasks.eventId, eventId))
      .orderBy(...taskOrder),
  );
}

// PRD-HUB-02 — tâches de toute l'organisation, hors événements perdus ou
// réalisés ; échéance au plus tard `until` (date sans heure) si fournie.
export async function findOrganizationTasks(
  organizationId: string,
  options: { until: string | null; includeDone: boolean },
): Promise<EventTaskRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ task: eventTasks })
      .from(eventTasks)
      .innerJoin(events, eq(events.id, eventTasks.eventId))
      .where(
        and(
          notInArray(events.status, ["cancelled", "closed"]),
          options.until ? lte(eventTasks.dueDate, options.until) : undefined,
          options.includeDone ? undefined : isNull(eventTasks.doneAt),
        ),
      )
      .orderBy(asc(eventTasks.dueDate), asc(eventTasks.position), asc(eventTasks.createdAt))
      .then((rows) => rows.map((row) => row.task)),
  );
}

// Lot 34b (CHR-02, D12) : une tâche se confie à un prestataire engagé (ENGAGED_CANDIDATE_STATUSES)
// sur le même événement ; la clé étrangère seule ne voit ni la RLS ni l'événement.

async function isEngagedCandidate(tx: Tx, eventId: string, candidateId: string | null | undefined): Promise<boolean> {
  if (!candidateId) return false;
  const [candidate] = await tx
    .select({ id: eventVendorCandidates.id })
    .from(eventVendorCandidates)
    .where(and(eq(eventVendorCandidates.id, candidateId), eq(eventVendorCandidates.eventId, eventId), inArray(eventVendorCandidates.status, [...ENGAGED_CANDIDATE_STATUSES])));
  return Boolean(candidate);
}

export async function insertEventTask(
  organizationId: string,
  eventId: string,
  task: {
    label: string;
    dueDate: string;
    responsible: TaskResponsible;
    vendorCandidateId?: string | null | undefined;
    categoryId?: string | null | undefined;
    priority?: TaskPriority | undefined;
    // Lot 70a (A3) : vérifié ici, dans la transaction ; sans valeur, la personne qui agit.
    assigneeUserId?: string | null | undefined;
    note?: string | null | undefined;
  },
  actorId: string | null = null,
): Promise<EventTaskRow | null | "invalid_vendor" | "invalid_category"> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    // Clé étrangère vérifiée sans RLS : on contrôle que l'événement est visible.
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!event) return null;
    // Revue du 70a : la personne choisie est un membre actif, lu dans la même transaction que l'écriture.
    if (task.responsible === "planner" && task.assigneeUserId) await assertAssignable(tx, organizationId, task.assigneeUserId);
    const vendorCandidateId = task.responsible === "vendor" ? (task.vendorCandidateId ?? null) : null;
    if (task.responsible === "vendor" && !(await isEngagedCandidate(tx, eventId, vendorCandidateId))) return "invalid_vendor";
    // Lot 63d (CHR-03) : seulement une catégorie de l'organisation (même contrôle que l'événement).
    if (task.categoryId && !(await isVisibleCategory(tx, task.categoryId))) return "invalid_category";
    const position = await nextTaskPosition(tx, eventId);
    // Lot 34a (DAT-07, D5) : une tâche créée à la main sur un événement daté est relative.
    const offsetDays = event.eventDate ? daysBetween(event.eventDate, task.dueDate) : null;
    // Lot 70a (CHR-02 ; A3) : une tâche « planner » est à la personne choisie, sinon à qui la crée.
    const assigneeUserId = task.responsible === "planner" ? (task.assigneeUserId !== undefined ? task.assigneeUserId : actorId) : null;
    const [row] = await tx
      .insert(eventTasks)
      .values({ organizationId, eventId, label: task.label, dueDate: task.dueDate, responsible: task.responsible, vendorCandidateId, offsetDays, position, categoryId: task.categoryId ?? null, priority: task.priority ?? "normal", assigneeUserId, note: task.note ?? null })
      .returning();
    if (!row) throw new Error("ajout de la tâche échoué");
    // Lot 70a (A19) : confiée à un collègue, il en est prévenu (même transaction).
    await emitTaskAssignments(tx, [{ organizationId, taskId: row.id, eventId, before: null, after: assigneeUserId, done: false, isDemo: event.isDemo, actorId }]);
    if (!event.tasksScheduledFor && event.eventDate) {
      await tx.update(events).set({ tasksScheduledFor: event.eventDate }).where(eq(events.id, eventId));
    }
    return row;
  });
}

export async function updateEventTaskRow(input: {
  organizationId: string;
  taskId: string;
  label?: string | undefined;
  dueDate?: string | undefined;
  responsible?: TaskResponsible | undefined;
  vendorCandidateId?: string | null | undefined;
  done?: boolean | undefined;
  categoryId?: string | null | undefined;
  priority?: TaskPriority | undefined;
  // Lot 70a : note déjà normalisée par le service ; la personne est vérifiée ici, dans la transaction.
  assigneeUserId?: string | null | undefined;
  note?: string | null | undefined;
  actorId?: string | null | undefined;
}): Promise<EventTaskRow | null | "invalid_vendor" | "invalid_category"> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [current] = await tx.select().from(eventTasks).where(eq(eventTasks.id, input.taskId));
    if (!current) return null;
    const responsible = input.responsible ?? current.responsible;
    const actorId = input.actorId ?? null;
    // Lot 70a (CHR-02 ; A3) : la personne ne vaut que pour une tâche « planner » ; reprise à l'agence, la
    // tâche revient à qui agit, sauf choix.
    const assigneeUserId =
      responsible !== "planner" ? null : input.assigneeUserId !== undefined ? input.assigneeUserId : current.responsible !== "planner" ? actorId : current.assigneeUserId;
    // Revue du 70a : une nouvelle personne doit être un membre actif (même transaction) ; la personne
    // actuelle, même retirée (A4), reste sans être revérifiée.
    if (responsible === "planner" && input.assigneeUserId && input.assigneeUserId !== current.assigneeUserId) await assertAssignable(tx, input.organizationId, input.assigneeUserId);
    const vendorCandidateId = responsible === "vendor" ? (input.vendorCandidateId !== undefined ? input.vendorCandidateId : current.vendorCandidateId) : null;
    const vendorChanged = responsible === "vendor" && (responsible !== current.responsible || vendorCandidateId !== current.vendorCandidateId);
    if (vendorChanged && (current.eventId === null || !(await isEngagedCandidate(tx, current.eventId, vendorCandidateId)))) return "invalid_vendor";
    if (input.categoryId && input.categoryId !== current.categoryId && !(await isVisibleCategory(tx, input.categoryId))) return "invalid_category";
    const doneAt = input.done === undefined ? current.doneAt : input.done ? (current.doneAt ?? new Date()) : null;
    // Lot 34a (DAT-07) : déplacée à la main, la tâche est fixée ; le report ne la bouge plus.
    const moved = input.dueDate !== undefined && input.dueDate !== current.dueDate;
    const [updated] = await tx
      .update(eventTasks)
      .set({
        label: input.label ?? current.label,
        dueDate: input.dueDate ?? current.dueDate,
        responsible,
        vendorCandidateId,
        doneAt,
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(moved ? { fixedAt: current.fixedAt ?? new Date() } : {}),
        assigneeUserId,
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventTasks.id, input.taskId))
      .returning();
    if (!updated) return null;
    // Lot 70a (A19) : la tâche passe à un collègue (même transaction ; rien si l'écriture échoue).
    if (assigneeUserId !== current.assigneeUserId) {
      const [event] = current.eventId ? await tx.select({ isDemo: events.isDemo }).from(events).where(eq(events.id, current.eventId)) : [];
      await emitTaskAssignments(tx, [{ organizationId: input.organizationId, taskId: updated.id, eventId: updated.eventId, before: current.assigneeUserId, after: assigneeUserId, done: updated.doneAt !== null, isDemo: event?.isDemo ?? false, actorId }]);
    }
    return updated;
  });
}

// Lot 34a (DAT-07) : remettre une tâche fixée en relatif — sa date redevient la date de
// l'événement plus son écart. Sans écart ou sans date d'événement, rien ne change.
export async function releaseEventTaskRow(organizationId: string, taskId: string): Promise<EventTaskRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.id, taskId));
    if (!task) return null;
    // Lot 53 (CHR-10) : une tâche hors évènement n'a pas de date relative.
    if (!task.eventId) return task;
    const [event] = await tx.select().from(events).where(eq(events.id, task.eventId));
    if (!event?.eventDate || task.offsetDays === null) return task;
    const [updated] = await tx
      .update(eventTasks)
      .set({ fixedAt: null, dueDate: addDays(event.eventDate, task.offsetDays), updatedAt: new Date() })
      .where(eq(eventTasks.id, taskId))
      .returning();
    return updated ?? null;
  });
}

// Échange la tâche avec sa voisine du même mois ; les positions du mois
// sont renumérotées pour rester distinctes.
export async function moveEventTaskRow(
  organizationId: string,
  taskId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.id, taskId));
    if (!task) return false;
    const sameMonth = await tx
      .select()
      .from(eventTasks)
      .where(
        and(
          task.eventId ? eq(eventTasks.eventId, task.eventId) : isNull(eventTasks.eventId),
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
}

// Lot 39a (UX-07, DAT-03 ; ADR 0073) : la tâche est marquée, « Annuler » la démarque ; la purge l'efface.
export async function deleteEventTask(organizationId: string, taskId: string): Promise<boolean> {
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(eventTasks).set(markDeleted()).where(and(eq(eventTasks.id, taskId), isNull(eventTasks.deletedAt))).returning({ id: eventTasks.id }),
  );
  return rows.length > 0;
}

export async function restoreEventTaskRow(organizationId: string, taskId: string): Promise<boolean> {
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(eventTasks).set(UNMARKED).where(and(eq(eventTasks.id, taskId), isNotNull(eventTasks.deletedAt))).returning({ id: eventTasks.id }),
  );
  return rows.length > 0;
}

// PRD-EVT-05 — programme du jour J.
export type ProgramItemData = {
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  internalNote: string | null;
  // Lot 30b (CHR-06, décision D6).
  responsible: string | null;
  // Lot 51 (EVT-04 ; D1) : le temps fort de la séquence ; absent à l'ajout, le premier temps fort du
  // jour de l'évènement (créé de lui-même au besoin) ; absent à la modification, inchangé.
  keyMomentId?: string | null;
  // Lot 63b (Q44) : absent à la modification, inchangé ; absent à l'ajout, visible des mariés.
  hiddenFromClients?: boolean;
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
): Promise<{ event: EventRow; items: ProgramItemWithParticipants[]; moments: { id: string; name: string; date: string }[] } | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const items = await tx
      .select()
      .from(programItems)
      .where(eq(programItems.eventId, eventId))
      .orderBy(asc(programItems.startTime), asc(programItems.createdAt));
    // Lot 67d (CHR-06) : le jour de chaque temps fort, pour ne comparer que les séquences d'un même jour.
    const moments = items.some((item) => item.keyMomentId !== null)
      ? await tx.select({ id: keyMoments.id, name: keyMoments.name, date: keyMoments.date }).from(keyMoments).where(eq(keyMoments.eventId, eventId)).orderBy(asc(keyMoments.date), asc(keyMoments.position))
      : [];
    return { event, items: await withParticipants(tx, items), moments };
  });
}

export type ProgramWriteResult =
  | { status: "saved"; item: ProgramItemWithParticipants }
  | { status: "event_not_found" | "item_not_found" | "participant_not_found" | "moment_not_found" };

export async function insertProgramItem(
  organizationId: string,
  eventId: string,
  data: ProgramItemData,
  vendorSlotIds: string[],
  freeLabels: string[],
  // Lot 51 (D1) : nom du temps fort créé de lui-même, dans la langue de l'organisation.
  mainMomentName: string,
): Promise<ProgramWriteResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return { status: "event_not_found" };
    if (!(await vendorSlotsBelongToEvent(tx, eventId, vendorSlotIds))) return { status: "participant_not_found" };
    if (data.keyMomentId && !(await keyMomentOfEvent(tx, eventId, data.keyMomentId))) return { status: "moment_not_found" };
    const keyMomentId = data.keyMomentId || (await ensureMainKeyMoment(tx, organizationId, eventId, mainMomentName));
    const [item] = await tx.insert(programItems).values({ organizationId, eventId, ...data, keyMomentId }).returning();
    if (!item) throw new Error("ajout de la ligne du programme échoué");
    await insertParticipants(tx, organizationId, item.id, vendorSlotIds, freeLabels);
    await touchProgram(tx, eventId);
    const [saved] = await withParticipants(tx, [item]);
    return { status: "saved", item: saved! };
  });
}

export async function updateProgramItemRow(
  organizationId: string,
  itemId: string,
  data: ProgramItemData,
  vendorSlotIds: string[],
  freeLabels: string[],
): Promise<ProgramWriteResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [current] = await tx.select().from(programItems).where(eq(programItems.id, itemId));
    if (!current) return { status: "item_not_found" };
    if (!(await vendorSlotsBelongToEvent(tx, current.eventId, vendorSlotIds))) {
      return { status: "participant_not_found" };
    }
    if (data.keyMomentId && !(await keyMomentOfEvent(tx, current.eventId, data.keyMomentId))) return { status: "moment_not_found" };
    const { keyMomentId, ...fields } = data;
    const [item] = await tx
      .update(programItems)
      .set({ ...fields, ...(keyMomentId ? { keyMomentId } : {}), updatedAt: new Date() })
      .where(eq(programItems.id, itemId))
      .returning();
    if (!item) throw new Error("mise à jour de la ligne du programme échouée");
    await tx.delete(programItemParticipants).where(eq(programItemParticipants.programItemId, itemId));
    await insertParticipants(tx, organizationId, itemId, vendorSlotIds, freeLabels);
    await touchProgram(tx, item.eventId);
    const [saved] = await withParticipants(tx, [item]);
    return { status: "saved", item: saved! };
  });
}

// Lot 62c (UX-13, décision D1) : le programme s'enregistre d'un coup — séquences modifiées et
// séquences ajoutées dans une seule transaction. Tout est vérifié avant la première écriture :
// une séquence d'un autre évènement (ou d'une autre organisation, invisible sous RLS), un poste
// ou un temps fort étranger refuse tout, et rien n'est écrit.
export type ProgramBatchEntry = { data: ProgramItemData; vendorSlotIds: string[]; freeLabels: string[] };

export type ProgramBatchResult =
  | { status: "saved"; items: ProgramItemWithParticipants[] }
  | { status: "event_not_found" | "item_not_found" | "participant_not_found" | "moment_not_found" };

export async function saveProgramItemRows(
  organizationId: string,
  eventId: string,
  updates: (ProgramBatchEntry & { itemId: string })[],
  additions: ProgramBatchEntry[],
  mainMomentName: string,
): Promise<ProgramBatchResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return { status: "event_not_found" };
    const itemIds = updates.map((update) => update.itemId);
    if (itemIds.length > 0) {
      const rows = await tx.select({ id: programItems.id }).from(programItems).where(and(eq(programItems.eventId, eventId), inArray(programItems.id, itemIds)));
      if (rows.length !== itemIds.length) return { status: "item_not_found" };
    }
    const entries = [...updates, ...additions];
    if (!(await vendorSlotsBelongToEvent(tx, eventId, entries.flatMap((entry) => entry.vendorSlotIds)))) return { status: "participant_not_found" };
    for (const keyMomentId of new Set(entries.flatMap((entry) => (entry.data.keyMomentId ? [entry.data.keyMomentId] : [])))) {
      if (!(await keyMomentOfEvent(tx, eventId, keyMomentId))) return { status: "moment_not_found" };
    }
    const saved: ProgramItemRow[] = [];
    for (const update of updates) {
      const { keyMomentId, ...fields } = update.data;
      const [item] = await tx
        .update(programItems)
        .set({ ...fields, ...(keyMomentId ? { keyMomentId } : {}), updatedAt: new Date() })
        .where(eq(programItems.id, update.itemId))
        .returning();
      if (!item) throw new Error("mise à jour de la ligne du programme échouée");
      await tx.delete(programItemParticipants).where(eq(programItemParticipants.programItemId, update.itemId));
      await insertParticipants(tx, organizationId, update.itemId, update.vendorSlotIds, update.freeLabels);
      saved.push(item);
    }
    for (const addition of additions) {
      const keyMomentId = addition.data.keyMomentId || (await ensureMainKeyMoment(tx, organizationId, eventId, mainMomentName));
      const [item] = await tx.insert(programItems).values({ organizationId, eventId, ...addition.data, keyMomentId }).returning();
      if (!item) throw new Error("ajout de la ligne du programme échoué");
      await insertParticipants(tx, organizationId, item.id, addition.vendorSlotIds, addition.freeLabels);
      saved.push(item);
    }
    if (saved.length > 0) await touchProgram(tx, eventId);
    return { status: "saved", items: await withParticipants(tx, saved) };
  });
}

// Lot 30b (CHR-06, décision D8) : décale des séquences de l'événement, début et fin,
// en une transaction. Tout ou rien : une séquence d'un autre événement (ou d'une autre
// organisation, invisible sous RLS) ou un début qui sortirait du jour J refuse tout.
export type ProgramShiftResult =
  | { status: "shifted"; items: ProgramItemWithParticipants[] }
  | { status: "event_not_found" | "item_not_found" | "out_of_day" };

export async function shiftProgramItemRows(organizationId: string, eventId: string, itemIds: string[], minutes: number): Promise<ProgramShiftResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return { status: "event_not_found" };
    const rows = await tx.select().from(programItems).where(and(eq(programItems.eventId, eventId), inArray(programItems.id, itemIds)));
    if (rows.length !== itemIds.length) return { status: "item_not_found" };
    const plans = rows.map((row) => ({ row, times: shiftedTimes(row, minutes) }));
    if (plans.some((plan) => plan.times === null)) return { status: "out_of_day" };
    const updated: ProgramItemRow[] = [];
    for (const { row, times } of plans) {
      const [item] = await tx
        .update(programItems)
        .set({ ...times!, updatedAt: new Date() })
        .where(eq(programItems.id, row.id))
        .returning();
      if (!item) throw new Error("décalage de la ligne du programme échoué");
      updated.push(item);
    }
    await touchProgram(tx, eventId);
    return { status: "shifted", items: await withParticipants(tx, updated) };
  });
}

// Lot 39a (UX-07 ; ADR 0073) : marquée puis purgée ; le programme compte comme modifié dans les deux sens.
export async function deleteProgramItem(organizationId: string, itemId: string): Promise<void> {
  await inTrash(organizationId, async (tx) => {
    const [deleted] = await tx.update(programItems).set(markDeleted()).where(and(eq(programItems.id, itemId), isNull(programItems.deletedAt))).returning();
    if (deleted) await touchProgram(tx, deleted.eventId);
  });
}

export async function restoreProgramItemRow(organizationId: string, itemId: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => {
    const [restored] = await tx.update(programItems).set(UNMARKED).where(and(eq(programItems.id, itemId), isNotNull(programItems.deletedAt))).returning();
    if (restored) await touchProgram(tx, restored.eventId);
    return Boolean(restored);
  });
}

// PRD-EVT-05 — modèles de programme.
export async function findProgramTemplates(
  organizationId: string,
): Promise<{ template: ProgramTemplateRow; items: ProgramTemplateItemRow[] }[]> {
  const db = appDatabase();
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
}

export type ProgramTemplateItemData = Omit<ProgramItemData, "internalNote" | "responsible" | "keyMomentId"> & {
  participantLabels: string[];
  // Lot 51 (CHR-08, EVT-04) : temps fort de la ligne et son jour depuis le jour de l'évènement.
  momentName: string | null;
  dayOffset: number;
};

export async function insertProgramTemplate(
  organizationId: string,
  name: string,
  items: ProgramTemplateItemData[],
): Promise<{ template: ProgramTemplateRow; items: ProgramTemplateItemRow[] }> {
  const db = appDatabase();
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
}

export async function insertProgramTemplateItem(
  organizationId: string,
  templateId: string,
  item: ProgramTemplateItemData,
): Promise<ProgramTemplateItemRow | null> {
  const db = appDatabase();
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
}

// Lot 21 (L21-EVT-21) : une ligne de modèle se corrige sans être recréée ; elle
// garde sa place.
export async function updateProgramTemplateItemRow(
  organizationId: string,
  itemId: string,
  item: ProgramTemplateItemData,
): Promise<ProgramTemplateItemRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.update(programTemplateItems).set(item).where(eq(programTemplateItems.id, itemId)).returning();
    return row ?? null;
  });
}

export async function renameProgramTemplateRow(organizationId: string, templateId: string, name: string): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx.update(programTemplates).set({ name }).where(eq(programTemplates.id, templateId)).returning({ id: programTemplates.id });
    return rows.length > 0;
  });
}

export async function deleteProgramTemplateItem(organizationId: string, itemId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) =>
    tx.delete(programTemplateItems).where(eq(programTemplateItems.id, itemId)),
  );
}

// Les lignes déjà copiées dans les programmes restent : elles ne
// référencent pas le modèle.
// Lot 39a (HUB-17 ; ADR 0073) : le modèle va à la corbeille ; la purge l'efface avec ses lignes.
export async function deleteProgramTemplate(organizationId: string, templateId: string): Promise<void> {
  await inTrash(organizationId, (tx) => tx.update(programTemplates).set(markDeleted()).where(and(eq(programTemplates.id, templateId), isNull(programTemplates.deletedAt))));
}

export type ApplyProgramTemplateResult =
  | { status: "applied"; items: ProgramItemWithParticipants[] }
  | { status: "event_not_found" | "template_not_found" };

// Copie les lignes du modèle à la suite du programme. Un intervenant du
// modèle devient le poste de l'événement de même libellé (sans tenir
// compte de la casse), sinon un intervenant libre.
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Lot 51 (CHR-08, EVT-04) : une ligne qui nomme un temps fort rejoint celui de même nom au jour dit
// (créé s'il manque) ; sans nom, le premier temps fort du jour de l'évènement. Le modèle est copié tel
// qu'il est à l'application (HUB-21) : le modifier ensuite ne change pas l'évènement.
export async function applyProgramTemplateRows(
  organizationId: string,
  eventId: string,
  templateId: string,
  mainMomentName: string,
): Promise<ApplyProgramTemplateResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(eq(events.id, eventId));
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
    const momentIds = new Map<string, string | null>();
    const momentFor = async (name: string | null, dayOffset: number): Promise<string | null> => {
      if (!event.eventDate) return null;
      if (name === null && dayOffset === 0) return ensureMainKeyMoment(tx, organizationId, eventId, mainMomentName);
      const date = shiftDate(event.eventDate, dayOffset);
      const wanted = name ?? mainMomentName;
      const key = `${date}|${wanted.trim().toLowerCase()}`;
      if (momentIds.has(key)) return momentIds.get(key)!;
      const existing = await tx.select({ id: keyMoments.id, name: keyMoments.name }).from(keyMoments).where(and(eq(keyMoments.eventId, eventId), eq(keyMoments.date, date)));
      const found = existing.find((moment) => moment.name.trim().toLowerCase() === wanted.trim().toLowerCase());
      const id = found?.id ?? (await tx.insert(keyMoments).values({ organizationId, eventId, name: wanted, date, position: existing.length }).returning({ id: keyMoments.id }))[0]?.id ?? null;
      momentIds.set(key, id);
      return id;
    };
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
          keyMomentId: await momentFor(templateItem.momentName, templateItem.dayOffset),
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
}

// Lot 13 (L13-EVT-19) — passages de statut d'un événement, du plus ancien au
// plus récent, pour dater les étapes de la frise.
export async function findEventStatusChanges(organizationId: string, eventId: string): Promise<{ toStatus: EventStatus; changedAt: Date; effectiveOn: string | null; dateKnown: boolean }[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ toStatus: eventStatusHistory.toStatus, changedAt: eventStatusHistory.changedAt, effectiveOn: eventStatusHistory.effectiveOn, dateKnown: eventStatusHistory.dateKnown })
      .from(eventStatusHistory)
      .where(eq(eventStatusHistory.eventId, eventId))
      .orderBy(asc(eventStatusHistory.changedAt)),
  );
}

// Lot 26a : l'auteur d'une coche est le lien d'un tiers (son nom) ; une
// ancienne coche d'un compte de marié (ADR 0020, retiré) reste sans nom.
export async function findEventActivity(
  organizationId: string,
  eventId: string,
): Promise<{ activity: EventActivityRow; actorName: string | null; vendorName: string | null }[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const activity = await tx
      .select()
      .from(eventActivities)
      .where(eq(eventActivities.eventId, eventId))
      .orderBy(desc(eventActivities.createdAt));
    const linkIds = [...new Set(activity.flatMap((row) => (row.actorLinkId ? [row.actorLinkId] : [])))];
    const links =
      linkIds.length > 0
        ? await tx.select({ id: eventLinks.id, personName: eventLinks.personName }).from(eventLinks).where(inArray(eventLinks.id, linkIds))
        : [];
    const nameByLink = new Map(links.map((link) => [link.id, link.personName]));
    // Lot 32a (D6, RGP-05) : le nom du prestataire relancé se lit sur sa fiche de consulté.
    const candidateIds = [...new Set(activity.flatMap((row) => (row.vendorCandidateId ? [row.vendorCandidateId] : [])))];
    const candidates =
      candidateIds.length > 0
        ? await tx.select({ id: eventVendorCandidates.id, vendorName: eventVendorCandidates.vendorName }).from(eventVendorCandidates).where(inArray(eventVendorCandidates.id, candidateIds))
        : [];
    const nameByCandidate = new Map(candidates.map((candidate) => [candidate.id, candidate.vendorName]));
    return activity.map((row) => ({
      activity: row,
      actorName: row.actorLinkId ? (nameByLink.get(row.actorLinkId) ?? null) : null,
      vendorName: row.vendorCandidateId ? (nameByCandidate.get(row.vendorCandidateId) ?? null) : null,
    }));
  });
}

// AIDE-02 — essai guidé : événement fictif complet, puis purge.
export type DemoEventData = {
  createdByUserId: string;
  // Lot 33b (HUB-10) : l'exemple du démarrage est un mariage confirmé ; l'essai reste une option.
  status?: "option" | "confirmed";
  eventDate: string;
  expiresAt: Date;
  clients: { firstName: string; lastName: string }[];
  venueName: string;
  venueCity: string;
  // Postes du modèle de départ, utilisés si l'organisation n'a pas encore
  // de liste par défaut.
  fallbackVendorSlotLabels: string[];
  tasks: { label: string; dueDate: string; responsible: TaskResponsible }[];
  programItems: (Omit<ProgramItemData, "internalNote" | "responsible"> & { participantLabels: string[] })[];
};

function activeDemo(now: Date) {
  return and(eq(events.isDemo, true), gt(events.demoExpiresAt, now));
}

export async function findActiveDemoEvent(organizationId: string, now: Date): Promise<EventRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx.select().from(events).where(activeDemo(now)).orderBy(desc(events.createdAt)).limit(1);
    return event ?? null;
  });
}

export async function insertDemoEvent(organizationId: string, data: DemoEventData): Promise<EventRow> {
  const db = appDatabase();
  // Lot 36a : les clients fictifs sont des contacts d'essai du hub, supprimés avec l'essai.
  const clientContactIds = await resolveClientContacts(organizationId, data.clients, { isDemo: true });
  return await withOrganization(db, organizationId, async (tx) => {
    const now = new Date();
    // Lot 16 (ADR 0045) : l'événement fictif est un mariage ; il prend le premier
    // type « les mariés » de l'organisation, s'il y en a un.
    const [weddingType] = await tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.audience, "couple")).orderBy(asc(eventTypes.position)).limit(1);
    const [event] = await tx
      .insert(events)
      .values({
        organizationId,
        status: data.status ?? "option",
        eventTypeId: weddingType?.id ?? null,
        eventDate: data.eventDate,
        tasksScheduledFor: data.eventDate,
        programUpdatedAt: now,
        isDemo: true,
        demoExpiresAt: data.expiresAt,
      })
      .returning();
    if (!event) throw new Error("création de l'événement d'essai échouée");
    await insertVenuePlace(tx, organizationId, event.id, data.venueName, data.venueCity);

    await tx.insert(eventClients).values(clientContactIds.map((contactId, position) => ({ organizationId, eventId: event.id, contactId, position })));
    await tx.insert(eventStatusHistory).values({
      organizationId,
      eventId: event.id,
      fromStatus: null,
      toStatus: data.status ?? "option",
      changedByUserId: data.createdByUserId,
    });

    const defaults = await tx
      .select()
      .from(defaultVendorSlots)
      .orderBy(asc(defaultVendorSlots.position), asc(defaultVendorSlots.createdAt));
    const labels = defaults.length > 0 ? defaults.map((slot) => slot.label) : data.fallbackVendorSlotLabels;
    const slots =
      labels.length > 0
        ? await tx
            .insert(eventVendorSlots)
            .values(labels.map((label, position) => ({ organizationId, eventId: event.id, label, position })))
            .returning()
        : [];
    const slotByLabel = new Map(slots.map((slot) => [slot.label.trim().toLowerCase(), slot.id]));

    if (data.tasks.length > 0) {
      await tx
        .insert(eventTasks)
        .values(data.tasks.map((task, position) => ({ organizationId, eventId: event.id, ...task, assigneeUserId: task.responsible === "planner" ? data.createdByUserId : null, position })));
    }
    for (const programItem of data.programItems) {
      const { participantLabels, ...values } = programItem;
      const [item] = await tx
        .insert(programItems)
        .values({ organizationId, eventId: event.id, ...values })
        .returning();
      if (!item) throw new Error("création de la ligne d'essai échouée");
      const vendorSlotIds: string[] = [];
      const freeLabels: string[] = [];
      for (const label of participantLabels) {
        const slotId = slotByLabel.get(label.trim().toLowerCase());
        if (slotId) vendorSlotIds.push(slotId);
        else freeLabels.push(label);
      }
      await insertParticipants(tx, organizationId, item.id, vendorSlotIds, freeLabels);
    }
    return event;
  });
}

// Supprime des événements d'essai et toutes leurs lignes, enfants d'abord
// (les clés étrangères ne cascadent pas toutes).
async function deleteDemoEventRows(tx: Tx, eventIds: string[], demoOnly = true): Promise<void> {
  if (eventIds.length === 0) return;
  await tx.delete(eventActivities).where(inArray(eventActivities.eventId, eventIds));
  await tx.delete(eventLinks).where(inArray(eventLinks.eventId, eventIds));
  await tx.delete(programItems).where(inArray(programItems.eventId, eventIds));
  await tx.delete(eventTasks).where(inArray(eventTasks.eventId, eventIds));
  await tx.delete(eventVendorSlots).where(inArray(eventVendorSlots.eventId, eventIds));
  await tx.delete(eventStatusHistory).where(inArray(eventStatusHistory.eventId, eventIds));
  await tx.delete(eventClients).where(inArray(eventClients.eventId, eventIds));
  await tx.delete(events).where(and(inArray(events.id, eventIds), ...(demoOnly ? [eq(events.isDemo, true)] : [])));
}

// Lot 39a (HUB-17, DAT-03 ; ADR 0073) : purge réelle d'évènements à la corbeille (échus ou supprimés
// définitivement), mêmes lignes que l'essai guidé ; les fichiers sont effacés par l'appelant.
export async function purgeEventRows(organizationId: string, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await inTrash(organizationId, (tx) => deleteDemoEventRows(tx, eventIds, false));
}

// Ne supprime qu'un événement d'essai : un identifiant de vrai événement
// ne fait rien.
export async function deleteDemoEvent(organizationId: string, eventId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, async (tx) => {
    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.isDemo, true)));
    if (event) await deleteDemoEventRows(tx, [event.id]);
  });
}

// Une seule connexion pour toutes les organisations (purge planifiée), une
// transaction par organisation (RLS).
export async function deleteExpiredDemoEvents(organizationIds: string[], now: Date): Promise<number> {
  const db = appDatabase();
  let purged = 0;
  for (const organizationId of organizationIds) {
    purged += await withOrganization(db, organizationId, async (tx) => {
      const expired = await tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.isDemo, true), lte(events.demoExpiresAt, now)));
      await deleteDemoEventRows(
        tx,
        expired.map((event) => event.id),
      );
      return expired.length;
    });
  }
  return purged;
}

export async function countRealEvents(organizationId: string): Promise<number> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.isDemo, false));
    return row?.count ?? 0;
  });
}

// AIDE-02 : essais expirés, pour que les autres modules (budget) purgent
// leurs propres données avant la suppression de l'événement.
export async function findExpiredDemoEventIds(
  organizationIds: string[],
  now: Date,
): Promise<{ organizationId: string; eventId: string }[]> {
  const db = appDatabase();
  const found: { organizationId: string; eventId: string }[] = [];
  for (const organizationId of organizationIds) {
    const rows = await withOrganization(db, organizationId, (tx) =>
      tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.isDemo, true), lte(events.demoExpiresAt, now))),
    );
    found.push(...rows.map((row) => ({ organizationId, eventId: row.id })));
  }
  return found;
}

// Lot 9 (ADR 0029) — nombre d'événements réels créés par mois (Europe/Paris)
// depuis une date : statistique d'usage pour l'Admin, sans aucun contenu.
// Une seule connexion pour toutes les organisations, chacune dans son propre
// contexte RLS (aucune requête ne lit plusieurs organisations à la fois).
export async function countEventsByCreationMonth(
  organizationIds: string[],
  since: Date,
): Promise<Record<string, { month: string; count: number }[]>> {
  const db = appDatabase();
  const result: Record<string, { month: string; count: number }[]> = {};
  for (const organizationId of organizationIds) {
    result[organizationId] = await withOrganization(db, organizationId, async (tx) => {
      const month = sql<string>`to_char(${events.createdAt} at time zone 'Europe/Paris', 'YYYY-MM')`;
      return tx
        .select({ month, count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(eq(events.isDemo, false), gte(events.createdAt, since)))
        .groupBy(month)
        .orderBy(month);
    });
  }
  return result;
}

// Lot 10 (AIDE-08) — recherche globale : événements réels (jamais les essais)
// dont les clients ou le lieu contiennent chacun des mots cherchés, puis
// tâches et prestataires. Toujours dans le contexte RLS de l'organisation.
export type EventSearchRow = { id: string; names: string; eventDate: string | null; venueName: string | null; status: string };
export type TaskSearchRow = { id: string; eventId: string; label: string; dueDate: string; eventNames: string };
export type VendorSearchRow = { id: string; eventId: string; label: string; vendorName: string | null; eventNames: string };

// Sous-requêtes écrites avec un alias explicite : Drizzle n'y qualifie pas les
// colonnes, et « id » désignerait alors la table des clients.
// Lot 36a (ADR 0069) : prénoms des clients de chaque évènement, lus chez le hub (contacts).
async function eventNamesOf(organizationId: string, eventIds: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(eventIds)];
  if (unique.length === 0) return new Map();
  const links = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx.select().from(eventClients).where(inArray(eventClients.eventId, unique)).orderBy(asc(eventClients.position), asc(eventClients.createdAt)),
  );
  // Lot 63c (Q43) : le nom de l'évènement, s'il en a un, remplace celui tiré des clients.
  const named = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: events.id, name: events.name }).from(events).where(inArray(events.id, unique)));
  const ownNames = new Map(named.flatMap((row) => (row.name ? [[row.id, row.name] as const] : [])));
  const names = new Map<string, string[]>();
  for (const client of await withContacts(organizationId, links)) names.set(client.eventId, [...(names.get(client.eventId) ?? []), client.firstName]);
  return new Map(unique.map((id) => [id, ownNames.get(id) ?? (names.get(id) ?? []).join(" & ")]));
}
// Lot 34b (D10) : le lieu de réception, premier lieu de la liste.
const venueNameSql = sql<string | null>`(select ep.label from "events"."event_places" ep where ep.event_id = "events"."id" order by ep.position, ep.created_at limit 1)`;

export async function searchEventRows(
  organizationId: string,
  words: string[],
  limit: number,
): Promise<{ events: EventSearchRow[]; tasks: TaskSearchRow[]; vendors: VendorSearchRow[] }> {
  if (words.length === 0) return { events: [], tasks: [], vendors: [] };
  const db = appDatabase();
  // Lot 36a : les prénoms et noms des clients sont ceux de leurs contacts, cherchés chez le hub, mot
  // par mot ; chaque mot doit se trouver dans les lieux ou dans un client de l'évènement.
  const contactsByWord = await Promise.all(words.map((word) => searchContactIdsByWord(organizationId, word)));
  const found = await withOrganization(db, organizationId, async (tx) => {
    const places = foldedColumn(sql`(select string_agg(concat_ws(' ', ep.label, ep.city), ' ') from "events"."event_places" ep where ep.event_id = "events"."id")`);
    const eventRows = await tx
      .select({ id: events.id, eventDate: events.eventDate, venueName: venueNameSql, status: events.status })
      .from(events)
      .where(
        and(
          eq(events.isDemo, false),
          ...words.map((word, index) => {
            const ids = contactsByWord[index]!;
            const byClient =
              ids.length > 0
                ? exists(tx.select({ one: sql`1` }).from(eventClients).where(and(eq(eventClients.eventId, events.id), inArray(eventClients.contactId, ids))))
                : sql`false`;
            // Lot 63c (Q43) : le nom de l'évènement est cherché comme ses lieux.
            return or(sql`${places} like ${likeWord(word)}`, sql`${foldedColumn(sql`coalesce(${events.name}, '')`)} like ${likeWord(word)}`, byClient)!;
          }),
        ),
      )
      .orderBy(sql`${events.eventDate} desc nulls last`)
      .limit(limit);

    const taskRows = await tx
      .select({ id: eventTasks.id, eventId: eventTasks.eventId, label: eventTasks.label, dueDate: eventTasks.dueDate })
      .from(eventTasks)
      .innerJoin(events, eq(events.id, eventTasks.eventId))
      .where(and(eq(events.isDemo, false), ...words.map((word) => foldedContains(eventTasks.label, word))))
      .orderBy(asc(eventTasks.dueDate))
      .limit(limit);

    // Lot 28b (PRE-02) : les prestataires retenus d'un poste (plusieurs possibles).
    const vendorRows = await tx
      .select({ id: eventVendorSlots.id, eventId: eventVendorSlots.eventId, label: eventVendorSlots.label, vendorName: eventVendorCandidates.vendorName })
      .from(eventVendorSlots)
      .innerJoin(events, eq(events.id, eventVendorSlots.eventId))
      .leftJoin(
        eventVendorCandidates,
        and(eq(eventVendorCandidates.vendorSlotId, eventVendorSlots.id), inArray(eventVendorCandidates.status, [...ENGAGED_CANDIDATE_STATUSES])),
      )
      .where(
        and(
          eq(events.isDemo, false),
          ...words.map((word) => sql`${foldedColumn(sql`concat_ws(' ', ${eventVendorCandidates.vendorName}, ${eventVendorSlots.label})`)} like ${likeWord(word)}`),
        ),
      )
      .limit(limit);

    return { events: eventRows, tasks: taskRows, vendors: vendorRows };
  });
  // Lot 53 (CHR-10) : la recherche ne trouve que les tâches d'un évènement (jointure).
  const eventTaskRows = found.tasks.flatMap((row) => (row.eventId ? [{ ...row, eventId: row.eventId }] : []));
  const names = await eventNamesOf(organizationId, [...found.events.map((row) => row.id), ...eventTaskRows.map((row) => row.eventId), ...found.vendors.map((row) => row.eventId)]);
  return {
    events: found.events.map((row) => ({ ...row, names: names.get(row.id) ?? "" })),
    tasks: eventTaskRows.map((row) => ({ ...row, eventNames: names.get(row.eventId) ?? "" })),
    vendors: found.vendors.map((row) => ({ ...row, eventNames: names.get(row.eventId) ?? "" })),
  };
}

// Lot 10 (AIDE-08) — prénoms des clients de quelques événements (affichage
// d'un devis trouvé par son numéro).
export async function findEventNamesByIds(organizationId: string, eventIds: string[]): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const db = appDatabase();
  const rows = await withOrganization(db, organizationId, (tx) => tx.select({ id: events.id }).from(events).where(inArray(events.id, eventIds)));
  const names = await eventNamesOf(organizationId, rows.map((row) => row.id));
  return Object.fromEntries(rows.map((row) => [row.id, names.get(row.id) ?? ""]));
}

// Lot 12 (L12-EVT-17) — renommer une ligne du budget par défaut ou changer son icône.
export async function updateDefaultVendorSlotRow(organizationId: string, id: string, label: string, icon: string | null): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(
    db,
    organizationId,
    async (tx) => (await tx.update(defaultVendorSlots).set({ label, icon }).where(eq(defaultVendorSlots.id, id)).returning()).length > 0,
  );
}

export async function updateEventVendorSlotIcon(organizationId: string, id: string, icon: string | null): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) => tx.update(eventVendorSlots).set({ icon }).where(eq(eventVendorSlots.id, id)));
}

// Lot 14 (décision I) — un client de l'événement ; lot 36a : ses coordonnées sont celles de son
// contact, modifiées chez le hub.
export async function findEventClientLink(organizationId: string, eventId: string, clientId: string): Promise<EventClientLinkRow | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(eventClients)
      .where(and(eq(eventClients.id, clientId), eq(eventClients.eventId, eventId))),
  );
  return row ?? null;
}

// Lot 36a : clients des évènements donnés (contacts), pour la fin d'un essai et la purge RGPD.
export async function findClientLinks(organizationId: string, eventIds: readonly string[]): Promise<EventClientLinkRow[]> {
  if (eventIds.length === 0) return [];
  return withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(eventClients).where(inArray(eventClients.eventId, [...eventIds])));
}

// Lot 36a : contacts encore clients d'au moins un évènement de l'organisation.
export async function findLinkedContactIds(organizationId: string, contactIds?: readonly string[]): Promise<Set<string>> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .selectDistinct({ contactId: eventClients.contactId })
      .from(eventClients)
      .where(contactIds ? inArray(eventClients.contactId, contactIds.length > 0 ? [...contactIds] : ["00000000-0000-0000-0000-000000000000"]) : sql`${eventClients.contactId} is not null`),
  );
  return new Set(rows.map((row) => row.contactId).filter((id): id is string => id !== null));
}

// Lot 36a (CRM-03, D7) : évènements dont le contact est client.
export async function findEventIdsOfContact(organizationId: string, contactId: string): Promise<string[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx.selectDistinct({ eventId: eventClients.eventId }).from(eventClients).where(eq(eventClients.contactId, contactId)),
  );
  return rows.map((row) => row.eventId);
}

// Lot 14 (décision K) — budget souhaité par les clients.
// Lot 31b (FAC-04, DOC-02) : lieu de l'événement, repris par la variable {evenement.lieu} du
// contrat. Lot 34b (D10) : c'est le premier lieu de la liste ; il est créé s'il manque, et un nom
// et une ville vides le laissent tel quel (un lieu se retire par la liste).
export async function updateVenueRow(organizationId: string, eventId: string, venue: { venueName: string | null; venueCity: string | null }): Promise<boolean> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return false;
    const [first] = await tx.select().from(eventPlaces).where(eq(eventPlaces.eventId, eventId)).orderBy(asc(eventPlaces.position), asc(eventPlaces.createdAt)).limit(1);
    if (!first) {
      await insertVenuePlace(tx, organizationId, eventId, venue.venueName, venue.venueCity);
    } else if (venue.venueName || venue.venueCity) {
      await tx
        .update(eventPlaces)
        .set({ label: venue.venueName ?? first.label, city: venue.venueCity, updatedAt: new Date() })
        .where(eq(eventPlaces.id, first.id));
    }
    await tx.update(events).set({ updatedAt: new Date() }).where(eq(events.id, eventId));
    return true;
  });
}

// Lot 34b (EVT-03, D11) — invités estimés et confirmés, style et notes.
export async function updateEventIdentityRow(organizationId: string, eventId: string, identity: { guestsEstimated: number | null; guestsConfirmed: number | null; style: string | null; notes: string | null }): Promise<boolean> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    // Lot 48a (DAT-08) : des notes confidentielles ne changent que par saveEventNotes.
    const rows = await tx
      .update(events)
      .set({ ...identity, notes: sql`case when ${events.notesSealed} is null then ${identity.notes} else null end`, updatedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning({ id: events.id });
    return rows.length > 0;
  });
}

export async function updateWantedBudgetRow(organizationId: string, eventId: string, wantedBudgetCents: number | null): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx.update(events).set({ wantedBudgetCents, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
    return rows.length > 0;
  });
}

// Lot 33b (PAR-01, étape 6) : liens client créés sur un évènement réel (révoqués compris : le client
// a été invité au moins une fois).
export async function countRealClientLinks(organizationId: string): Promise<number> {
  return await withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(eventLinks)
      .innerJoin(events, eq(events.id, eventLinks.eventId))
      .where(and(eq(eventLinks.audience, "client"), eq(events.isDemo, false)));
    return row?.count ?? 0;
  });
}

// Lot 39b (UX-09 ; D8 ; ADR 0074) — identité d'un évènement et sa version (date et auteur de la
// dernière modification de l'évènement), pour l'enregistrement automatique.
export async function findEventIdentityState(organizationId: string, eventId: string) {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ guestsEstimated: events.guestsEstimated, guestsConfirmed: events.guestsConfirmed, style: events.style, notes: events.notes, updatedAt: events.updatedAt, updatedBy: events.updatedBy })
      .from(events)
      .where(eq(events.id, eventId)),
  );
  return row ?? null;
}

// Lot 48a (DAT-08 ; ADR 0093) — notes d'évènement, en clair ou chiffrées.
export async function findEventNotesRow(organizationId: string, eventId: string): Promise<{ notes: string | null; notesSealed: string | null; notesConfidentialBy: string | null } | null> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx.select({ notes: events.notes, notesSealed: events.notesSealed, notesConfidentialBy: events.notesConfidentialBy }).from(events).where(eq(events.id, eventId));
    return row ?? null;
  });
}

export async function writeEventNotesRow(organizationId: string, eventId: string, values: { notes: string | null; notesSealed: string | null; notesConfidentialBy: string | null }): Promise<boolean> {
  return withOrganization(appDatabase(), organizationId, async (tx) => (await tx.update(events).set({ ...values, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id })).length > 0);
}

// Lot 48a (PRE-05, PRE-10 ; D3) : la fiche du carnet derrière le lien d'un prestataire (null : saisie
// libre ou lien d'un autre public). Le lien a déjà été vérifié par l'appelant (session de lien).
export async function findLinkVendorRecordId(organizationId: string, linkId: string): Promise<string | null> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx
      .select({ vendorId: eventVendorCandidates.vendorId })
      .from(eventLinks)
      .innerJoin(eventVendorCandidates, eq(eventVendorCandidates.id, eventLinks.vendorCandidateId))
      .where(and(eq(eventLinks.id, linkId), eq(eventLinks.audience, "vendor")));
    return row?.vendorId ?? null;
  });
}

// Lot 66a (HUB-28 ; D1 ; ADR 0112) : les fuseaux des évènements à venir (ou sans date), pour placer
// l'heure d'envoi des automatismes dans le fuseau de chaque évènement. Des noms de fuseau seulement.
export async function findUpcomingEventTimeZones(organizationId: string, today: string): Promise<string[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .selectDistinct({ timeZone: events.timeZone })
      .from(events)
      .where(and(eq(events.organizationId, organizationId), or(isNull(events.eventDate), gte(events.eventDate, today)))),
  );
  return rows.map((row) => row.timeZone);
}

// Lot 66b (JRJ-01 ; D2, D3 ; ADR 0112) : le rappel du jour J réglé pour un évènement, cible par cible.
export async function findDayReminderOverrideRows(organizationId: string, eventId: string) {
  return withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(dayReminderOverrides).where(eq(dayReminderOverrides.eventId, eventId)));
}

export async function upsertDayReminderOverrideRow(organizationId: string, eventId: string, value: { target: "planner" | "vendors" | "team" | "clients"; enabled: boolean; moment: "eve" | "morning"; sendTime: string }): Promise<void> {
  await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(dayReminderOverrides)
      .values({ organizationId, eventId, ...value })
      .onConflictDoUpdate({ target: [dayReminderOverrides.eventId, dayReminderOverrides.target], set: { enabled: value.enabled, moment: value.moment, sendTime: value.sendTime, updatedAt: new Date() } }),
  );
}

export async function deleteDayReminderOverrideRow(organizationId: string, eventId: string, target: string): Promise<void> {
  await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(dayReminderOverrides).where(and(eq(dayReminderOverrides.eventId, eventId), eq(dayReminderOverrides.target, target as "planner"))));
}

// Lot 66b (JRJ-01 ; ADR 0112) : les évènements dont la date tombe entre from et to, pour le rappel du
// jour J (statut, essai et fuseau : le service décide).
export async function findDayReminderEventRows(organizationId: string, from: string, to: string) {
  return withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ id: events.id, eventDate: events.eventDate, timeZone: events.timeZone, status: events.status, isDemo: events.isDemo })
      .from(events)
      .where(and(eq(events.organizationId, organizationId), gte(events.eventDate, from), lte(events.eventDate, to), isNull(events.deletedAt))),
  );
}

// Lot 72a : le statut a changé entre la lecture et l'écriture.
export class StatusChangedMeanwhileError extends Error {
  constructor() {
    super("le statut a changé entre-temps");
    this.name = "StatusChangedMeanwhileError";
  }
}

// Lot 72a (EVT-07, UX-01 ; critère 9) — tâches faites, total et en retard par évènement, en une requête
// groupée (index (organization_id, event_id)), hors corbeille. En retard : à faire, échéance avant
// « today » (le jour même ne l'est pas), comme l'état d'échéance unique (due-state.ts).
export async function countTasksByEvent(organizationId: string, eventIds: string[], today: string): Promise<{ eventId: string; done: number; total: number; late: number }[]> {
  if (eventIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select({
        eventId: sql<string>`${eventTasks.eventId}`,
        done: sql<number>`count(*) filter (where ${eventTasks.doneAt} is not null)::int`,
        total: sql<number>`count(*)::int`,
        late: sql<number>`count(*) filter (where ${eventTasks.doneAt} is null and ${eventTasks.dueDate} < ${today}::date)::int`,
      })
      .from(eventTasks)
      .where(and(inArray(eventTasks.eventId, eventIds), isNull(eventTasks.deletedAt)))
      .groupBy(eventTasks.eventId),
  );
}
