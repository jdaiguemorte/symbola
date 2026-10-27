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

// EVT-03 : un poste prestataire passe à Réservé, ou le montant d'un poste
// déjà réservé change. Le futur module Budget s'y abonne pour alimenter le
// « réel » de la ligne correspondante et garde la dernière valeur reçue
// pour chaque vendorSlotId. Le nom
// du prestataire n'y figure pas : il peut désigner une personne et le
// journal des événements n'est pas un registre de données personnelles.
export const EVT_VENDOR_SLOT_BOOKED = "events.vendor_slot.booked";
export const EVT_VENDOR_SLOT_BOOKED_VERSION = 1;

export const vendorSlotBookedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  vendorSlotId: z.string().uuid(),
  label: z.string().min(1),
  amountCents: z.number().int().nonnegative().nullable(),
  currency: z.literal("EUR"),
  bookedByUserId: z.string().uuid(),
});

export type VendorSlotBookedPayload = z.infer<typeof vendorSlotBookedPayloadSchema>;
