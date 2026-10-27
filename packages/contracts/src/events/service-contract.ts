// Interface du service.ts d'events (SOC-06) — pensée comme le futur
// contrat HTTP /v1/events si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/events/service.contract.test.ts).
export type EventStatus = "prospect" | "quote_sent" | "confirmed" | "done" | "lost";

export type EventClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  position: number;
};

export type EventClientInput = {
  firstName: string;
  lastName?: string | null;
};

export type EventSummary = {
  id: string;
  status: EventStatus;
  eventDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  clients: EventClient[];
};

export type EventDetail = EventSummary & {
  prospectSourceId: string | null;
  lossReasonId: string | null;
  lossReasonNote: string | null;
};

export type ListEventsInput = {
  organizationId: string;
  statusIn?: EventStatus[] | undefined;
  year?: number | undefined;
  search?: string | undefined;
};

export type CreateProspectInput = {
  organizationId: string;
  createdByUserId: string;
  clients: EventClientInput[];
  prospectSourceId: string;
  eventDate?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
};

export type CreateProspectResult = {
  id: string;
};

export type ChangeEventStatusInput = {
  organizationId: string;
  eventId: string;
  changedByUserId: string;
  toStatus: EventStatus;
  lossReasonId?: string | null;
  lossReasonNote?: string | null;
};

export type ProspectSource = {
  id: string;
  label: string;
};

export type LossReason = {
  id: string;
  label: string;
  isFreeText: boolean;
};

export interface EventsServiceContract {
  listEvents(input: ListEventsInput): Promise<EventSummary[]>;
  getEvent(organizationId: string, eventId: string): Promise<EventDetail | null>;
  createProspect(input: CreateProspectInput): Promise<CreateProspectResult>;
  changeEventStatus(input: ChangeEventStatusInput): Promise<void>;
  listProspectSources(organizationId: string): Promise<ProspectSource[]>;
  createProspectSource(organizationId: string, label: string): Promise<ProspectSource>;
  listLossReasons(organizationId: string): Promise<LossReason[]>;
  createLossReason(organizationId: string, label: string, isFreeText: boolean): Promise<LossReason>;
}
