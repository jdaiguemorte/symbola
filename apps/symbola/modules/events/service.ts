// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import {
  deleteDefaultVendorSlot,
  deleteEventVendorSlot,
  findDefaultVendorSlots,
  findEventById,
  findEvents,
  findEventVendorSlots,
  findLossReasons,
  findProspectSources,
  insertDefaultVendorSlots,
  insertEventVendorSlot,
  insertLossReason,
  insertProspect,
  insertProspectSource,
  updateEventStatus,
  updateEventVendorSlotRow,
  type DefaultVendorSlotRow,
  type EventClientRow,
  type EventRow,
  type EventVendorSlotRow,
} from "./repository";
import type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  DefaultVendorSlot,
  EventClient,
  EventDetail,
  EventsServiceContract,
  EventSummary,
  EventVendorSlot,
  ListEventsInput,
  LossReason,
  ProspectSource,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
} from "@symbola/contracts";

export { eventsPrivacy } from "./privacy";

export type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  EventClient,
  EventClientInput,
  EventDetail,
  EventStatus,
  EventSummary,
  ListEventsInput,
  LossReason,
  ProspectSource,
  DefaultVendorSlot,
  EventVendorSlot,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
} from "@symbola/contracts";

function toEventClient(row: EventClientRow): EventClient {
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, position: row.position };
}

function toEventSummary(event: EventRow, clients: EventClientRow[]): EventSummary {
  return {
    id: event.id,
    status: event.status,
    eventDate: event.eventDate,
    venueName: event.venueName,
    venueCity: event.venueCity,
    clients: clients.map(toEventClient),
  };
}

function toEventDetail(event: EventRow, clients: EventClientRow[]): EventDetail {
  return {
    ...toEventSummary(event, clients),
    prospectSourceId: event.prospectSourceId,
    lossReasonId: event.lossReasonId,
    lossReasonNote: event.lossReasonNote,
  };
}

export async function listEvents(input: ListEventsInput): Promise<EventSummary[]> {
  const rows = await findEvents(input.organizationId, {
    statusIn: input.statusIn,
    year: input.year,
    search: input.search,
    prospectSourceId: input.prospectSourceId,
  });
  return rows.map(({ event, clients }) => toEventSummary(event, clients));
}

export async function getEvent(organizationId: string, eventId: string): Promise<EventDetail | null> {
  const result = await findEventById(organizationId, eventId);
  if (!result) return null;
  return toEventDetail(result.event, result.clients);
}

export async function createProspect(input: CreateProspectInput): Promise<CreateProspectResult> {
  const event = await insertProspect({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    clients: input.clients,
    prospectSourceId: input.prospectSourceId,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueCity: input.venueCity,
  });
  return { id: event.id };
}

export async function changeEventStatus(input: ChangeEventStatusInput): Promise<void> {
  await updateEventStatus(input);
}

export async function listProspectSources(organizationId: string): Promise<ProspectSource[]> {
  const rows = await findProspectSources(organizationId);
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

export async function createProspectSource(organizationId: string, label: string): Promise<ProspectSource> {
  const row = await insertProspectSource(organizationId, label);
  return { id: row.id, label: row.label };
}

export async function listLossReasons(organizationId: string): Promise<LossReason[]> {
  const rows = await findLossReasons(organizationId);
  return rows.map((row) => ({ id: row.id, label: row.label, isFreeText: row.isFreeText }));
}

export async function createLossReason(
  organizationId: string,
  label: string,
  isFreeText: boolean,
): Promise<LossReason> {
  const row = await insertLossReason(organizationId, label, isFreeText);
  return { id: row.id, label: row.label, isFreeText: row.isFreeText };
}

// EVT-03 — postes prestataires.

export class VendorNameRequiredError extends Error {
  constructor() {
    super("le nom du prestataire est obligatoire pour un poste réservé");
    this.name = "VendorNameRequiredError";
  }
}

// Identifiant inconnu ou appartenant à une autre organisation (masqué
// par la RLS) : l'appelant affiche « introuvable » plutôt qu'une erreur.
export class EventNotFoundError extends Error {
  constructor() {
    super("événement introuvable");
    this.name = "EventNotFoundError";
  }
}

export class VendorSlotNotFoundError extends Error {
  constructor() {
    super("poste introuvable");
    this.name = "VendorSlotNotFoundError";
  }
}

export const VENDOR_SLOT_STATUSES: VendorSlotStatus[] = [
  "to_find",
  "quote_requested",
  "quote_received",
  "booked",
  "not_required",
];

function toDefaultVendorSlot(row: DefaultVendorSlotRow): DefaultVendorSlot {
  return { id: row.id, label: row.label, position: row.position };
}

function toEventVendorSlot(row: EventVendorSlotRow): EventVendorSlot {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    status: row.status,
    vendorName: row.vendorName,
    amountCents: row.amountCents,
    currency: "EUR",
    position: row.position,
  };
}

// Barre d'avancement de la fiche : postes réservés sur postes requis (un
// poste « Non requis » ne compte pas).
export function summarizeVendorSlots(slots: Pick<EventVendorSlot, "status">[]): VendorSlotProgress {
  const required = slots.filter((slot) => slot.status !== "not_required");
  return { booked: required.filter((slot) => slot.status === "booked").length, required: required.length };
}

export async function listDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlot[]> {
  return (await findDefaultVendorSlots(organizationId)).map(toDefaultVendorSlot);
}

export async function addDefaultVendorSlots(organizationId: string, labels: string[]): Promise<DefaultVendorSlot[]> {
  return (await insertDefaultVendorSlots(organizationId, labels)).map(toDefaultVendorSlot);
}

export async function removeDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void> {
  await deleteDefaultVendorSlot(organizationId, defaultVendorSlotId);
}

export async function listEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlot[]> {
  return (await findEventVendorSlots(organizationId, eventId)).map(toEventVendorSlot);
}

export async function addEventVendorSlot(organizationId: string, eventId: string, label: string): Promise<EventVendorSlot> {
  const row = await insertEventVendorSlot(organizationId, eventId, label.trim());
  if (!row) throw new EventNotFoundError();
  return toEventVendorSlot(row);
}

export async function updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<EventVendorSlot> {
  const vendorName = typeof input.vendorName === "string" ? input.vendorName.trim() || null : input.vendorName;
  if (input.status === "booked" && !vendorName) throw new VendorNameRequiredError();
  if (input.amountCents !== undefined && input.amountCents !== null) {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
      throw new RangeError("le montant doit être un nombre entier positif de centimes");
    }
  }
  const row = await updateEventVendorSlotRow({ ...input, vendorName });
  if (!row) throw new VendorSlotNotFoundError();
  return toEventVendorSlot(row);
}

export async function removeEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void> {
  await deleteEventVendorSlot(organizationId, vendorSlotId);
}

const _contractCheck: EventsServiceContract = {
  listEvents,
  getEvent,
  createProspect,
  changeEventStatus,
  listProspectSources,
  createProspectSource,
  listLossReasons,
  createLossReason,
  listDefaultVendorSlots,
  addDefaultVendorSlots,
  removeDefaultVendorSlot,
  listEventVendorSlots,
  addEventVendorSlot,
  updateEventVendorSlot,
  removeEventVendorSlot,
};
void _contractCheck;
