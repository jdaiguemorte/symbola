// Schémas des événements internes du module events (SOC-06, Lot 2).
// Nommage <module>.<entité>.<action> au passé (CLAUDE.md §5).
import { z } from "zod";

export const EVT_EVENT_CREATED = "events.event.created";
export const EVT_EVENT_CREATED_VERSION = 1;

export const eventCreatedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["prospect", "quote_sent", "confirmed", "done", "lost"]),
});

export type EventCreatedPayload = z.infer<typeof eventCreatedPayloadSchema>;

export const EVT_EVENT_STATUS_CHANGED = "events.event.status_changed";
export const EVT_EVENT_STATUS_CHANGED_VERSION = 1;

export const eventStatusChangedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  fromStatus: z.enum(["prospect", "quote_sent", "confirmed", "done", "lost"]).nullable(),
  toStatus: z.enum(["prospect", "quote_sent", "confirmed", "done", "lost"]),
  changedByUserId: z.string().uuid(),
});

export type EventStatusChangedPayload = z.infer<typeof eventStatusChangedPayloadSchema>;

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
