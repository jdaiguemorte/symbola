// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import {
  findEventById,
  findEvents,
  findLossReasons,
  findProspectSources,
  insertLossReason,
  insertProspect,
  insertProspectSource,
  updateEventStatus,
  type EventClientRow,
  type EventRow,
} from "./repository";
import type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  EventClient,
  EventDetail,
  EventsServiceContract,
  EventSummary,
  ListEventsInput,
  LossReason,
  ProspectSource,
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

const _contractCheck: EventsServiceContract = {
  listEvents,
  getEvent,
  createProspect,
  changeEventStatus,
  listProspectSources,
  createProspectSource,
  listLossReasons,
  createLossReason,
};
void _contractCheck;
