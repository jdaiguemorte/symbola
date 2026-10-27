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
