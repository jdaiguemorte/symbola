// Schémas des événements internes du module events (SOC-06, Lot 2).
// Nommage <module>.<entité>.<action> au passé (CLAUDE.md §5).
import { z } from "zod";

// Lot 34a (EVT-05, ADR 0055, D2) — statuts stockés du cycle de vie ; « Jour J » s'affiche de
// lui-même et n'est jamais publié. Version 2 des deux événements ; un événement de version 1 reste
// lisible, ses statuts traduits par la correspondance de D2.
export const EVENT_STATUSES = ["option", "confirmed", "in_preparation", "closed", "postponed", "cancelled"] as const;
export const EVENT_STATUSES_V1 = ["prospect", "quote_sent", "confirmed", "done", "lost"] as const;
type EventStatusValue = (typeof EVENT_STATUSES)[number];
type EventStatusV1 = (typeof EVENT_STATUSES_V1)[number];

const V1_TO_V2: Record<EventStatusV1, EventStatusValue> = {
  prospect: "option",
  quote_sent: "option",
  confirmed: "confirmed",
  done: "closed",
  lost: "cancelled",
};

export function eventStatusFromV1(status: EventStatusV1): EventStatusValue {
  return V1_TO_V2[status];
}

export const EVT_EVENT_CREATED = "events.event.created";
export const EVT_EVENT_CREATED_VERSION = 2;

export const eventCreatedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(EVENT_STATUSES),
});

export type EventCreatedPayload = z.infer<typeof eventCreatedPayloadSchema>;

// Version 1 (avant le lot 34a), pour relire le journal.
export const eventCreatedPayloadV1Schema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(EVENT_STATUSES_V1),
});

export const EVT_EVENT_STATUS_CHANGED = "events.event.status_changed";
export const EVT_EVENT_STATUS_CHANGED_VERSION = 2;

export const eventStatusChangedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  fromStatus: z.enum(EVENT_STATUSES).nullable(),
  toStatus: z.enum(EVENT_STATUSES),
  changedByUserId: z.string().uuid(),
});

export type EventStatusChangedPayload = z.infer<typeof eventStatusChangedPayloadSchema>;

export const eventStatusChangedPayloadV1Schema = z.object({
  eventId: z.string().uuid(),
  fromStatus: z.enum(EVENT_STATUSES_V1).nullable(),
  toStatus: z.enum(EVENT_STATUSES_V1),
  changedByUserId: z.string().uuid(),
});

// Lit un événement de l'une ou l'autre version, en statuts de la version 2.
export function readEventStatusChanged(version: number, payload: unknown): EventStatusChangedPayload {
  if (version >= 2) return eventStatusChangedPayloadSchema.parse(payload);
  const v1 = eventStatusChangedPayloadV1Schema.parse(payload);
  return { ...v1, fromStatus: v1.fromStatus === null ? null : eventStatusFromV1(v1.fromStatus), toStatus: eventStatusFromV1(v1.toStatus) };
}

// PRD-EVT-03, puis lot 28a/28b (PRE-02) : un prestataire rattaché à un poste
// devient « Retenu », ou le devis d'un prestataire retenu change. Le module
// Budget engage les lignes de ce prestataire (son devis). Le nom
// du prestataire n'y figure pas : il peut désigner une personne et le
// journal des événements n'est pas un registre de données personnelles.
export const EVT_VENDOR_SLOT_BOOKED = "events.vendor_slot.booked";
// Version 2 (lot 28b, PRE-02) : candidateId, facultatif, désigne le prestataire
// retenu (plusieurs par poste) ; un événement de version 1 reste lisible.
export const EVT_VENDOR_SLOT_BOOKED_VERSION = 2;

export const vendorSlotBookedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  vendorSlotId: z.string().uuid(),
  label: z.string().min(1),
  amountCents: z.number().int().nonnegative().nullable(),
  candidateId: z.string().uuid().optional(),
  currency: z.literal("EUR"),
  bookedByUserId: z.string().uuid(),
});

export type VendorSlotBookedPayload = z.infer<typeof vendorSlotBookedPayloadSchema>;
