// Schémas des événements internes du module appointments (lot 46, RDV-04, D7 ; ADR 0083).
// Nommage <module>.<entité>.<action> au passé (CLAUDE.md § 5).
import { z } from "zod";

// RDV-04 (D7) : un rendez-vous pris (page publique) ou saisi (équipe). L'app Prospects (lot 44) s'y
// abonnera pour créer ou rattacher le prospect. Aucune donnée personnelle : des identifiants.
export const APPOINTMENTS_APPOINTMENT_BOOKED = "appointments.appointment.booked";
export const APPOINTMENTS_APPOINTMENT_BOOKED_VERSION = 1;

export const appointmentBookedPayloadSchema = z.object({
  appointmentId: z.string().uuid(),
  typeId: z.string().uuid().nullable(),
  contactId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  hostUserId: z.string().uuid(),
  startsAt: z.string().datetime(),
  origin: z.enum(["public", "manual"]),
});

export type AppointmentBookedPayload = z.infer<typeof appointmentBookedPayloadSchema>;
