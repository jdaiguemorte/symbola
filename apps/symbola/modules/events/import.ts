// IMP-05 — fonctions d'import du module events (ADR 0022), exposées par
// service.ts : écriture d'un lot de lignes en une transaction, relecture de
// l'état des éléments écrits, annulation. Jamais d'élément d'essai (ADR
// 0008) : un rapprochement vers un événement d'essai est ignoré.
import { and, asc, eq, isNotNull, max, sql } from "drizzle-orm";
import {
  EVT_EVENT_CREATED,
  EVT_EVENT_CREATED_VERSION,
  EVT_EVENT_STATUS_CHANGED,
  EVT_EVENT_STATUS_CHANGED_VERSION,
  type EventStatus,
  type ImportApplyResult,
  type ImportApplyRow,
  type ImportedItem,
  type ImportUndoItem,
  type ImportUndoOutcome,
  type TaskResponsible,
  sameImportValue,
} from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { emitDomainEvent } from "@symbola/db/events/emit";
import {
  defaultVendorSlots,
  eventActivities,
  eventClientAccesses,
  eventClients,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorCandidateNotes,
  eventVendorCandidates,
  eventVendorSlots,
  lossReasons,
  eventPlaces,
  programItems,
  prospectSources,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { parsePlacesCell } from "@symbola/import-engine";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Values = Record<string, unknown>;

async function inTransaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const same = sameImportValue;

// Valeurs écrites qui diffèrent de l'état actuel : rien = ligne inchangée.
function changedKeys(current: Values, wanted: Values): string[] {
  return Object.keys(wanted).filter((key) => !same(current[key], wanted[key]));
}

function pick(values: Values, keys: string[]): Values {
  return Object.fromEntries(keys.map((key) => [key, values[key] ?? null]));
}

// Champs libres : ceux du fichier complètent ceux déjà présents.
function mergedImportedFields(current: Record<string, string> | null, added: Record<string, string>): Record<string, string> | null {
  if (Object.keys(added).length === 0) return current;
  return { ...(current ?? {}), ...added };
}

// —— Événements (avec leurs clients) ————————————————————————————————————

// Lot 14c (IMP-08) — valeurs propres à une fiche PDF : budget souhaité
// (centimes) ; lieux (le premier est aussi le lieu de réception), et pour
// ceux qui ont une heure, une ligne du programme à cette heure.
function sheetValues(values: Values): { wantedBudgetCents: number | null; places: ImportedPlace[]; program: ImportedProgramItem[] } {
  const budget = values.wantedBudget;
  const entries = typeof values.places === "string" ? parsePlacesCell(values.places) : [];
  const unique = [...new Map(entries.map((entry) => [normalized(entry.label), entry])).values()];
  return {
    wantedBudgetCents: typeof budget === "number" && budget > 0 ? budget : null,
    places: unique.map((entry) => ({ label: entry.label })),
    program: entries
      .filter((entry): entry is { label: string; time: string } => entry.time !== null)
      .map((entry) => ({ startTime: entry.time, label: entry.label, location: entry.label })),
  };
}

// Lot 14 (décision I) : coordonnées gardées seulement quand elles sont
// renseignées (l'état relu d'un import plus ancien reste comparable).
const CONTACT_KEYS = ["email", "phone", "addressLine", "postalCode", "city"] as const;
type ImportedClient = { firstName: string; lastName: string | null } & Partial<Record<(typeof CONTACT_KEYS)[number], string>>;
type ImportedPlace = { label: string };
type ImportedProgramItem = { startTime: string; label: string; location: string | null };

function clientOf(row: { firstName: string; lastName: string | null } & Partial<Record<(typeof CONTACT_KEYS)[number], string | null>>): ImportedClient {
  const client: ImportedClient = { firstName: row.firstName, lastName: row.lastName };
  for (const key of CONTACT_KEYS) {
    const value = row[key];
    if (value) client[key] = value;
  }
  return client;
}

function clientColumns(client: ImportedClient) {
  return Object.fromEntries(CONTACT_KEYS.map((key) => [key, client[key] ?? null])) as Record<(typeof CONTACT_KEYS)[number], string | null>;
}

async function eventState(tx: Tx, eventId: string): Promise<Values | null> {
  const [event] = await tx.select().from(events).where(and(eq(events.id, eventId), eq(events.isDemo, false)));
  if (!event) return null;
  const clients = await tx.select().from(eventClients).where(eq(eventClients.eventId, eventId)).orderBy(asc(eventClients.position));
  return {
    eventDate: event.eventDate,
    venueName: event.venueName,
    venueCity: event.venueCity,
    prospectSourceId: event.prospectSourceId,
    status: event.status,
    clients: clients.map(clientOf),
    importedFields: event.importedFields,
    wantedBudgetCents: event.wantedBudgetCents,
    places: (await tx.select().from(eventPlaces).where(eq(eventPlaces.eventId, eventId)).orderBy(asc(eventPlaces.position))).map((place) => ({ label: place.label })),
    program: (await tx.select().from(programItems).where(eq(programItems.eventId, eventId)).orderBy(asc(programItems.startTime), asc(programItems.createdAt))).map(
      (item) => ({ startTime: item.startTime.slice(0, 5), label: item.label, location: item.location }),
    ),
  };
}

function rowClients(values: Values, current: ImportedClient[]): ImportedClient[] | null {
  const result = [...current];
  let touched = false;
  for (const [position, index] of [
    [0, 1],
    [1, 2],
  ] as const) {
    const firstName = text(values[`client${index}FirstName`]);
    const lastName = text(values[`client${index}LastName`]);
    const contact = Object.fromEntries(CONTACT_KEYS.map((key) => [key, text(values[`client${index}${key[0]!.toUpperCase()}${key.slice(1)}`])]));
    if (!firstName && !lastName && Object.values(contact).every((value) => value === null)) continue;
    touched = true;
    const existing = result[position];
    // Une coordonnée vide dans le fichier ne remplace jamais celle de la fiche.
    result[position] = clientOf({
      firstName: firstName ?? existing?.firstName ?? "",
      lastName: lastName ?? existing?.lastName ?? null,
      ...Object.fromEntries(CONTACT_KEYS.map((key) => [key, (contact[key] as string | null) ?? existing?.[key] ?? null])),
    });
  }
  // Un client 2 sans client 1 reste à sa place (le client 1 vide n'existe pas).
  return touched ? result.filter((client): client is ImportedClient => client !== undefined) : null;
}

async function writeEventFields(tx: Tx, organizationId: string, eventId: string, fields: Values, userId: string, fromStatus: EventStatus | null): Promise<void> {
  const set: Partial<typeof events.$inferInsert> = { updatedAt: new Date() };
  if ("eventDate" in fields) set.eventDate = (fields.eventDate as string | null) ?? null;
  if ("venueName" in fields) set.venueName = (fields.venueName as string | null) ?? null;
  if ("venueCity" in fields) set.venueCity = (fields.venueCity as string | null) ?? null;
  if ("prospectSourceId" in fields) set.prospectSourceId = (fields.prospectSourceId as string | null) ?? null;
  if ("importedFields" in fields) set.importedFields = (fields.importedFields as Record<string, string> | null) ?? null;
  if ("status" in fields) set.status = fields.status as EventStatus;
  if ("wantedBudgetCents" in fields) set.wantedBudgetCents = (fields.wantedBudgetCents as number | null) ?? null;
  await tx.update(events).set(set).where(eq(events.id, eventId));

  if ("places" in fields) {
    const places = (fields.places as ImportedPlace[] | null) ?? [];
    await tx.delete(eventPlaces).where(eq(eventPlaces.eventId, eventId));
    if (places.length > 0) await tx.insert(eventPlaces).values(places.map((place, position) => ({ organizationId, eventId, label: place.label, position })));
  }
  if ("program" in fields) {
    const program = (fields.program as ImportedProgramItem[] | null) ?? [];
    await tx.delete(programItems).where(eq(programItems.eventId, eventId));
    if (program.length > 0) await tx.insert(programItems).values(program.map((item) => ({ organizationId, eventId, ...item })));
    await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, eventId));
  }

  if ("clients" in fields) {
    const clients = (fields.clients as ImportedClient[] | null) ?? [];
    await tx.delete(eventClients).where(eq(eventClients.eventId, eventId));
    if (clients.length > 0) {
      await tx.insert(eventClients).values(
        clients.map((client, position) => ({ organizationId, eventId, firstName: client.firstName, lastName: client.lastName, ...clientColumns(client), position })),
      );
    }
  }
  if ("status" in fields && fields.status !== fromStatus) {
    const toStatus = fields.status as EventStatus;
    await tx.insert(eventStatusHistory).values({ organizationId, eventId, fromStatus, toStatus, changedByUserId: userId });
    if (fromStatus !== null) {
      await emitDomainEvent(tx, {
        organizationId,
        name: EVT_EVENT_STATUS_CHANGED,
        version: EVT_EVENT_STATUS_CHANGED_VERSION,
        payload: { eventId, fromStatus, toStatus, changedByUserId: userId },
      });
    }
  }
}

export async function importEventRows(input: {
  organizationId: string;
  userId: string;
  rows: ImportApplyRow[];
  // PRD-EVT-07 : la source est obligatoire ; une ligne sans source reçoit celle-ci.
  defaultProspectSourceId: string;
}): Promise<ImportApplyResult> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const sources = await tx.select().from(prospectSources);
    if (!sources.some((source) => source.id === input.defaultProspectSourceId)) throw new Error("source par défaut inconnue");
    const sourceByLabel = new Map(sources.map((source) => [normalized(source.label), source.id]));
    const defaults = await tx.select().from(defaultVendorSlots).orderBy(asc(defaultVendorSlots.position), asc(defaultVendorSlots.createdAt));

    // Source citée par la ligne : existante, ou créée (décision de Julien,
    // lot 5) et annulée avec l'import si elle n'a pas servi ailleurs.
    const sourceFor = async (label: string | null): Promise<string | null> => {
      if (!label) return null;
      const known = sourceByLabel.get(normalized(label));
      if (known) return known;
      const [created] = await tx.insert(prospectSources).values({ organizationId: input.organizationId, label }).returning();
      if (!created) throw new Error("création de la source échouée");
      sourceByLabel.set(normalized(label), created.id);
      items.push({ rowIndex: null, module: "events", kind: "prospect_source", elementId: created.id, action: "created", previous: null, written: { label } });
      return created.id;
    };

    for (const row of input.rows) {
      const sourceId = await sourceFor(text(row.values.prospectSource));
      const status = (row.values.status as EventStatus | null) ?? null;
      const current = row.matchId ? await eventState(tx, row.matchId) : null;
      const sheet = sheetValues(row.values);

      if (row.matchId && current) {
        const wanted: Values = {};
        for (const key of ["eventDate", "venueName", "venueCity"]) {
          const value = row.values[key];
          if (value !== null && value !== undefined) wanted[key] = value;
        }
        if (sourceId) wanted.prospectSourceId = sourceId;
        if (status) wanted.status = status;
        const clients = rowClients(row.values, current.clients as ImportedClient[]);
        if (clients) wanted.clients = clients;
        // Fiche PDF (lot 14c) : budget souhaité ; lieux et programme
        // seulement si l'événement n'en a pas encore (jamais de doublon).
        if (sheet.wantedBudgetCents !== null) wanted.wantedBudgetCents = sheet.wantedBudgetCents;
        if (sheet.places.length > 0 && (current.places as ImportedPlace[]).length === 0) wanted.places = sheet.places;
        if (sheet.program.length > 0 && (current.program as ImportedProgramItem[]).length === 0) wanted.program = sheet.program;
        const importedFields = mergedImportedFields(current.importedFields as Record<string, string> | null, row.importedFields);
        if (!same(importedFields, current.importedFields)) wanted.importedFields = importedFields;

        const keys = changedKeys(current, wanted);
        if (keys.length === 0) {
          unchanged += 1;
          continue;
        }
        const written = pick(wanted, keys);
        await writeEventFields(tx, input.organizationId, row.matchId, written, input.userId, current.status as EventStatus);
        items.push({ rowIndex: row.rowIndex, module: "events", kind: "event", elementId: row.matchId, action: "updated", previous: pick(current, keys), written });
        continue;
      }

      const clients = rowClients(row.values, []) ?? [];
      const finalStatus: EventStatus = status ?? "prospect";
      const [event] = await tx
        .insert(events)
        .values({
          organizationId: input.organizationId,
          status: finalStatus,
          eventDate: (row.values.eventDate as string | null) ?? null,
          venueName: text(row.values.venueName),
          venueCity: text(row.values.venueCity),
          prospectSourceId: sourceId ?? input.defaultProspectSourceId,
          importedFields: Object.keys(row.importedFields).length > 0 ? row.importedFields : null,
          wantedBudgetCents: sheet.wantedBudgetCents,
          programUpdatedAt: sheet.program.length > 0 ? new Date() : null,
        })
        .returning();
      if (!event) throw new Error("création de l'événement échouée");
      if (clients.length > 0) {
        await tx.insert(eventClients).values(
          clients.map((client, position) => ({
            organizationId: input.organizationId,
            eventId: event.id,
            firstName: client.firstName,
            lastName: client.lastName,
            ...clientColumns(client),
            position,
          })),
        );
      }
      if (sheet.places.length > 0) {
        await tx.insert(eventPlaces).values(sheet.places.map((place, position) => ({ organizationId: input.organizationId, eventId: event.id, label: place.label, position })));
      }
      if (sheet.program.length > 0) {
        await tx.insert(programItems).values(sheet.program.map((item) => ({ organizationId: input.organizationId, eventId: event.id, ...item })));
      }
      // PRD-EVT-03 : comme une création à la main, l'événement reçoit les postes par défaut.
      if (defaults.length > 0) {
        await tx.insert(eventVendorSlots).values(
          defaults.map((slot, position) => ({ organizationId: input.organizationId, eventId: event.id, label: slot.label, position })),
        );
      }
      await tx.insert(eventStatusHistory).values({
        organizationId: input.organizationId,
        eventId: event.id,
        fromStatus: null,
        toStatus: finalStatus,
        changedByUserId: input.userId,
      });
      await emitDomainEvent(tx, {
        organizationId: input.organizationId,
        name: EVT_EVENT_CREATED,
        version: EVT_EVENT_CREATED_VERSION,
        payload: { eventId: event.id, status: finalStatus },
      });
      const state = await eventState(tx, event.id);
      items.push({ rowIndex: row.rowIndex, module: "events", kind: "event", elementId: event.id, action: "created", previous: null, written: state ?? {} });
    }
    return { items, unchanged };
  });
}

// —— Tâches ————————————————————————————————————————————————————————————

async function taskState(tx: Tx, taskId: string): Promise<Values | null> {
  const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.id, taskId));
  if (!task) return null;
  return {
    eventId: task.eventId,
    label: task.label,
    dueDate: task.dueDate,
    responsible: task.responsible,
    done: task.doneAt !== null,
    importedFields: task.importedFields,
  };
}

export async function importTaskRows(input: { organizationId: string; rows: ImportApplyRow[] }): Promise<ImportApplyResult> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const realEvents = new Set(
      (await tx.select({ id: events.id }).from(events).where(eq(events.isDemo, false))).map((event) => event.id),
    );
    for (const row of input.rows) {
      if (!row.eventId || !realEvents.has(row.eventId)) throw new Error("événement de rattachement inconnu");
      const current = row.matchId ? await taskState(tx, row.matchId) : null;
      if (row.matchId && current && current.eventId === row.eventId) {
        const wanted: Values = {};
        for (const key of ["label", "dueDate", "responsible", "done"]) {
          const value = row.values[key];
          if (value !== null && value !== undefined) wanted[key] = value;
        }
        const importedFields = mergedImportedFields(current.importedFields as Record<string, string> | null, row.importedFields);
        if (!same(importedFields, current.importedFields)) wanted.importedFields = importedFields;
        const keys = changedKeys(current, wanted);
        if (keys.length === 0) {
          unchanged += 1;
          continue;
        }
        const written = pick(wanted, keys);
        await writeTaskFields(tx, row.matchId, written);
        items.push({ rowIndex: row.rowIndex, module: "events", kind: "task", elementId: row.matchId, action: "updated", previous: pick(current, keys), written });
        continue;
      }
      const [last] = await tx.select({ value: max(eventTasks.position) }).from(eventTasks).where(eq(eventTasks.eventId, row.eventId));
      const [task] = await tx
        .insert(eventTasks)
        .values({
          organizationId: input.organizationId,
          eventId: row.eventId,
          label: text(row.values.label) ?? "",
          dueDate: row.values.dueDate as string,
          responsible: (row.values.responsible as TaskResponsible | null) ?? "planner",
          doneAt: row.values.done === true ? new Date() : null,
          position: (last?.value ?? -1) + 1,
          importedFields: Object.keys(row.importedFields).length > 0 ? row.importedFields : null,
        })
        .returning();
      if (!task) throw new Error("création de la tâche échouée");
      items.push({ rowIndex: row.rowIndex, module: "events", kind: "task", elementId: task.id, action: "created", previous: null, written: (await taskState(tx, task.id)) ?? {} });
    }
    return { items, unchanged };
  });
}

async function writeTaskFields(tx: Tx, taskId: string, fields: Values): Promise<void> {
  const set: Partial<typeof eventTasks.$inferInsert> = { updatedAt: new Date() };
  if ("label" in fields) set.label = fields.label as string;
  if ("dueDate" in fields) set.dueDate = fields.dueDate as string;
  if ("responsible" in fields) set.responsible = fields.responsible as TaskResponsible;
  if ("done" in fields) set.doneAt = fields.done === true ? new Date() : null;
  if ("importedFields" in fields) set.importedFields = (fields.importedFields as Record<string, string> | null) ?? null;
  await tx.update(eventTasks).set(set).where(eq(eventTasks.id, taskId));
}

// —— Postes d'un événement (lignes de budget, PRD-BUD-02) ————————————————————

async function vendorSlotState(tx: Tx, slotId: string): Promise<Values | null> {
  const [slot] = await tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.id, slotId));
  if (!slot) return null;
  // Lot 28a/28b (PRE-02) : le poste n'a plus de statut ni de prestataire à lui.
  return { eventId: slot.eventId, label: slot.label, importedFields: slot.importedFields };
}

async function vendorCandidateState(tx: Tx, candidateId: string): Promise<Values | null> {
  const [candidate] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, candidateId));
  if (!candidate) return null;
  return { vendorSlotId: candidate.vendorSlotId, vendorName: candidate.vendorName, status: candidate.status };
}

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";

// Lot 28b (PRE-02) : le prestataire d'une ligne importée devient un prestataire
// rattaché au poste (retenu si la ligne a un montant réel, pressenti sinon),
// sauf s'il l'est déjà sous ce nom.
async function importedCandidate(tx: Tx, organizationId: string, row: ImportApplyRow, slotId: string, eventId: string, items: ImportedItem[]): Promise<string | null> {
  const vendorName = text(row.values.vendorName);
  if (!vendorName) return null;
  const existing = (await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slotId))).find(
    (candidate) => candidate.vendorName.trim().toLowerCase() === vendorName.toLowerCase(),
  );
  if (existing) return existing.id;
  const [last] = await tx.select({ value: max(eventVendorCandidates.position) }).from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slotId));
  const [candidate] = await tx
    .insert(eventVendorCandidates)
    .values({
      organizationId,
      eventId,
      vendorSlotId: slotId,
      vendorName,
      status: hasValue(row.values.actualAmount) ? "retained" : "shortlisted",
      position: (last?.value ?? -1) + 1,
    })
    .returning();
  if (!candidate) throw new Error("création du prestataire rattaché échouée");
  items.push({ rowIndex: row.rowIndex, module: "events", kind: "event_vendor_candidate", elementId: candidate.id, action: "created", previous: null, written: (await vendorCandidateState(tx, candidate.id)) ?? {} });
  return candidate.id;
}

// Postes des lignes de budget importées : existant (rapproché) ou créé, et le
// prestataire de la ligne ; le module budget écrit ensuite les lignes.
export async function importVendorSlotsForBudget(input: {
  organizationId: string;
  rows: ImportApplyRow[];
}): Promise<{ items: ImportedItem[]; slotIdByRow: Map<number, string>; candidateIdByRow: Map<number, string> }> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    const slotIdByRow = new Map<number, string>();
    const candidateIdByRow = new Map<number, string>();
    for (const row of input.rows) {
      if (!row.eventId) throw new Error("événement de rattachement inconnu");
      const [event] = await tx.select({ id: events.id }).from(events).where(and(eq(events.id, row.eventId), eq(events.isDemo, false)));
      if (!event) throw new Error("événement de rattachement inconnu");
      const current = row.matchId ? await vendorSlotState(tx, row.matchId) : null;
      let slotId: string;
      if (row.matchId && current && current.eventId === row.eventId) {
        slotId = row.matchId;
        const importedFields = mergedImportedFields(current.importedFields as Record<string, string> | null, row.importedFields);
        if (!same(importedFields, current.importedFields)) {
          await tx.update(eventVendorSlots).set({ importedFields, updatedAt: new Date() }).where(eq(eventVendorSlots.id, slotId));
          items.push({ rowIndex: row.rowIndex, module: "events", kind: "event_vendor_slot", elementId: slotId, action: "updated", previous: { importedFields: current.importedFields }, written: { importedFields } });
        }
      } else {
        const [last] = await tx.select({ value: max(eventVendorSlots.position) }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, row.eventId));
        const [slot] = await tx
          .insert(eventVendorSlots)
          .values({
            organizationId: input.organizationId,
            eventId: row.eventId,
            label: text(row.values.slotLabel) ?? "",
            position: (last?.value ?? -1) + 1,
            importedFields: Object.keys(row.importedFields).length > 0 ? row.importedFields : null,
          })
          .returning();
        if (!slot) throw new Error("création du poste échouée");
        slotId = slot.id;
        items.push({ rowIndex: row.rowIndex, module: "events", kind: "event_vendor_slot", elementId: slot.id, action: "created", previous: null, written: (await vendorSlotState(tx, slot.id)) ?? {} });
      }
      slotIdByRow.set(row.rowIndex, slotId);
      const candidateId = await importedCandidate(tx, input.organizationId, row, slotId, row.eventId, items);
      if (candidateId) candidateIdByRow.set(row.rowIndex, candidateId);
    }
    return { items, slotIdByRow, candidateIdByRow };
  });
}

// —— Listes paramétrables ——————————————————————————————————————————————

const LIST_KINDS = {
  prospect_sources: "prospect_source",
  loss_reasons: "loss_reason",
  vendor_slots: "default_vendor_slot",
} as const;

export async function importListRows(input: {
  organizationId: string;
  entityType: keyof typeof LIST_KINDS;
  rows: ImportApplyRow[];
}): Promise<ImportApplyResult> {
  return inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const kind = LIST_KINDS[input.entityType];
    const existing =
      input.entityType === "prospect_sources"
        ? await tx.select({ label: prospectSources.label }).from(prospectSources)
        : input.entityType === "loss_reasons"
          ? await tx.select({ label: lossReasons.label }).from(lossReasons)
          : await tx.select({ label: defaultVendorSlots.label }).from(defaultVendorSlots);
    const labels = new Set(existing.map((item) => normalized(item.label)));
    let position = existing.length;
    for (const row of input.rows) {
      const label = text(row.values.label);
      // Rapprochée ou déjà présente dans le fichier : rien à écrire.
      if (!label || row.matchId || labels.has(normalized(label))) {
        unchanged += 1;
        continue;
      }
      labels.add(normalized(label));
      const [created] =
        input.entityType === "prospect_sources"
          ? await tx.insert(prospectSources).values({ organizationId: input.organizationId, label }).returning({ id: prospectSources.id })
          : input.entityType === "loss_reasons"
            ? await tx.insert(lossReasons).values({ organizationId: input.organizationId, label }).returning({ id: lossReasons.id })
            : await tx.insert(defaultVendorSlots).values({ organizationId: input.organizationId, label, position: position++ }).returning({ id: defaultVendorSlots.id });
      if (!created) throw new Error("création de l'élément de liste échouée");
      items.push({ rowIndex: row.rowIndex, module: "events", kind, elementId: created.id, action: "created", previous: null, written: { label } });
    }
    return { items, unchanged };
  });
}

// —— Relecture et annulation ————————————————————————————————————————————

async function listItemState(tx: Tx, kind: string, id: string): Promise<Values | null> {
  const table = kind === "prospect_source" ? prospectSources : kind === "loss_reason" ? lossReasons : defaultVendorSlots;
  const [row] = await tx.select({ label: table.label }).from(table).where(eq(table.id, id));
  return row ? { label: row.label } : null;
}

async function stateOf(tx: Tx, kind: string, id: string): Promise<Values | null> {
  switch (kind) {
    case "event":
      return eventState(tx, id);
    case "task":
      return taskState(tx, id);
    case "event_vendor_slot":
      return vendorSlotState(tx, id);
    case "event_vendor_candidate":
      return vendorCandidateState(tx, id);
    default:
      return listItemState(tx, kind, id);
  }
}

// Lot 28a/28b : la trace d'un poste importé avant ces lots porte encore son
// statut et son prestataire, qui n'existent plus ; ils n'entrent pas dans la
// comparaison ni dans la restauration.
const RETIRED_KEYS = new Set(["status", "vendorName"]);

function modifiedSince(current: Values, written: Values | null): boolean {
  return Object.keys(written ?? {}).some((key) => !(RETIRED_KEYS.has(key) && !(key in current)) && !same(current[key], (written ?? {})[key]));
}

// Un événement créé par l'import puis enrichi à la main (tâches, accès des
// mariés, programme) est considéré comme modifié.
// Le programme écrit par l'import (fiche PDF, lot 14c) fait partie de l'état
// relu : seul un programme d'avant le lot 14 est compté ici.
async function eventHasHandWork(tx: Tx, eventId: string, written: Values | null): Promise<boolean> {
  const [tasks] = await tx.select({ n: sql<number>`count(*)::int` }).from(eventTasks).where(eq(eventTasks.eventId, eventId));
  const [accesses] = await tx.select({ n: sql<number>`count(*)::int` }).from(eventClientAccesses).where(eq(eventClientAccesses.eventId, eventId));
  const [program] = written && "program" in written ? [{ n: 0 }] : await tx.select({ n: sql<number>`count(*)::int` }).from(programItems).where(eq(programItems.eventId, eventId));
  return (tasks?.n ?? 0) + (accesses?.n ?? 0) + (program?.n ?? 0) > 0;
}

async function isListItemInUse(tx: Tx, kind: string, id: string): Promise<boolean> {
  if (kind === "prospect_source") {
    const [used] = await tx.select({ id: events.id }).from(events).where(eq(events.prospectSourceId, id)).limit(1);
    return Boolean(used);
  }
  if (kind === "loss_reason") {
    const [used] = await tx.select({ id: events.id }).from(events).where(and(isNotNull(events.lossReasonId), eq(events.lossReasonId, id))).limit(1);
    return Boolean(used);
  }
  return false;
}

async function deleteElement(tx: Tx, kind: string, id: string): Promise<void> {
  switch (kind) {
    case "event":
      await tx.delete(eventActivities).where(eq(eventActivities.eventId, id));
      await tx.delete(eventVendorSlots).where(eq(eventVendorSlots.eventId, id));
      await tx.delete(eventStatusHistory).where(eq(eventStatusHistory.eventId, id));
      await tx.delete(eventClients).where(eq(eventClients.eventId, id));
      await tx.delete(events).where(and(eq(events.id, id), eq(events.isDemo, false)));
      return;
    case "task":
      await tx.delete(eventTasks).where(eq(eventTasks.id, id));
      return;
    case "event_vendor_slot":
      await tx.delete(eventVendorSlots).where(eq(eventVendorSlots.id, id));
      return;
    case "event_vendor_candidate":
      await tx.delete(eventVendorCandidateNotes).where(eq(eventVendorCandidateNotes.candidateId, id));
      await tx.delete(eventVendorCandidates).where(eq(eventVendorCandidates.id, id));
      return;
    case "prospect_source":
      await tx.delete(prospectSources).where(eq(prospectSources.id, id));
      return;
    case "loss_reason":
      await tx.delete(lossReasons).where(eq(lossReasons.id, id));
      return;
    case "default_vendor_slot":
      await tx.delete(defaultVendorSlots).where(eq(defaultVendorSlots.id, id));
      return;
  }
}

async function restoreElement(tx: Tx, organizationId: string, kind: string, id: string, previous: Values, current: Values, userId: string): Promise<void> {
  if (kind === "event") {
    await writeEventFields(tx, organizationId, id, previous, userId, current.status as EventStatus);
    return;
  }
  if (kind === "task") {
    await writeTaskFields(tx, id, previous);
    return;
  }
  if (kind === "event_vendor_slot") {
    await tx
      .update(eventVendorSlots)
      .set({
        ...("importedFields" in previous ? { importedFields: (previous.importedFields as Record<string, string> | null) ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventVendorSlots.id, id));
  }
}

// État actuel des éléments écrits par un import : null = supprimé depuis.
export async function readImportedEventsElements(organizationId: string, items: { kind: string; elementId: string }[]): Promise<(Values | null)[]> {
  return inTransaction(organizationId, async (tx) => Promise.all(items.map((item) => stateOf(tx, item.kind, item.elementId))));
}

// Éléments touchés par un import, et pour chacun si une modification à la
// main l'a changé depuis (valeurs écrites ≠ valeurs actuelles).
export async function findModifiedImportedEventsElements(
  organizationId: string,
  items: Pick<ImportUndoItem, "kind" | "elementId" | "action" | "written">[],
): Promise<boolean[]> {
  return inTransaction(organizationId, async (tx) => {
    const result: boolean[] = [];
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      if (!current) {
        result.push(false);
        continue;
      }
      let modified = modifiedSince(current, item.written);
      if (!modified && item.kind === "event" && item.action === "created") modified = await eventHasHandWork(tx, item.elementId, item.written);
      result.push(modified);
    }
    return result;
  });
}

// IMP-05 — annulation, dans l'ordre donné (l'inverse de l'écriture) : un
// élément créé est supprimé, un élément mis à jour retrouve ses valeurs
// précédentes. Un élément modifié à la main depuis n'est touché que si
// `force` (confirmation de la planner) ; un élément de liste encore utilisé
// n'est jamais supprimé.
export async function undoImportedEventsElements(
  organizationId: string,
  userId: string,
  items: ImportUndoItem[],
): Promise<ImportUndoOutcome[]> {
  return inTransaction(organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      if (!current) {
        outcomes.push("missing");
        continue;
      }
      let modified = modifiedSince(current, item.written);
      if (!modified && item.kind === "event" && item.action === "created") modified = await eventHasHandWork(tx, item.elementId, item.written);
      if (modified && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      if (item.action === "created") {
        if (await isListItemInUse(tx, item.kind, item.elementId)) {
          outcomes.push("kept_in_use");
          continue;
        }
        if (item.kind === "event") {
          await tx.delete(eventTasks).where(eq(eventTasks.eventId, item.elementId));
          await tx.delete(eventClientAccesses).where(eq(eventClientAccesses.eventId, item.elementId));
          await tx.delete(programItems).where(eq(programItems.eventId, item.elementId));
        }
        await deleteElement(tx, item.kind, item.elementId);
      } else {
        await restoreElement(tx, organizationId, item.kind, item.elementId, item.previous ?? {}, current, userId);
      }
      outcomes.push("undone");
    }
    return outcomes;
  });
}

// Événements créés par un import : pour vérifier, avant de les supprimer,
// qu'aucun autre module n'y a rattaché de données (devis, budget).
export function importedEventIds(items: { kind: string; elementId: string; action: string }[]): string[] {
  return items.filter((item) => item.kind === "event" && item.action === "created").map((item) => item.elementId);
}
