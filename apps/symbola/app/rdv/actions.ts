"use server";

// Lot 46 (RDV-03 ; D10 ; ADR 0053, ADR 0082) — ce que permet le lien de gestion d'un rendez-vous, sans
// compte : le voir, reporter sur un créneau libre du même type, annuler (motif facultatif choisi dans
// une liste). Le jeton arrive en POST, n'est écrit nulle part ; débit limité par adresse IP et par
// organisation (SEC-04). Un lien non valable, quel qu'en soit le motif, reçoit la même réponse.
import { z } from "zod";
import { APPOINTMENT_CANCEL_REASONS, type AppointmentCancelReason } from "@symbola/contracts";
import { checkRateLimit } from "@/lib/rate-limit";
import { cancelByToken, describeManagedAppointment, rescheduleByToken, slotsForManagedAppointment } from "@/modules/appointments/service";

export type ManagedView = {
  typeName: string;
  organizationName: string;
  startsAt: string;
  endsAt: string;
  locationKind: "place" | "video" | "phone";
  location: string | null;
  status: "booked" | "cancelled";
  canReschedule: boolean;
};

export type ManageOutcome = { outcome: "valid"; view: ManagedView } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };

const tokenSchema = z.string().max(200);

async function limited(token: string): Promise<{ minutes: number } | null> {
  const organizationId = token.split(".")[0] ?? "";
  const decision = await checkRateLimit("appointmentManage", { account: z.uuid().safeParse(organizationId).success ? organizationId : null });
  return decision.allowed ? null : { minutes: Math.max(1, Math.ceil(decision.retryAfterSeconds / 60)) };
}

async function viewOf(token: string): Promise<ManagedView | null> {
  const managed = await describeManagedAppointment(token);
  if (!managed) return null;
  const { appointment } = managed;
  return {
    typeName: appointment.typeName,
    organizationName: managed.organizationName,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    locationKind: appointment.locationKind,
    location: appointment.location,
    status: appointment.status,
    canReschedule: managed.canReschedule,
  };
}

export async function describeAppointmentLinkAction(token: unknown): Promise<ManageOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const wait = await limited(parsed.data);
  if (wait) return { outcome: "retry", minutes: wait.minutes };
  const view = await viewOf(parsed.data);
  return view ? { outcome: "valid", view } : { outcome: "invalid" };
}

export async function appointmentLinkSlotsAction(token: unknown): Promise<{ slots: string[] } | { outcome: "invalid" } | { outcome: "retry"; minutes: number }> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const wait = await limited(parsed.data);
  if (wait) return { outcome: "retry", minutes: wait.minutes };
  const slots = await slotsForManagedAppointment(parsed.data);
  return slots ? { slots: slots.map((slot) => slot.toISOString()) } : { outcome: "invalid" };
}

export async function rescheduleAppointmentAction(token: unknown, startsAt: unknown): Promise<ManageOutcome | { outcome: "taken"; alternatives: string[] }> {
  const parsed = z.object({ token: tokenSchema, startsAt: z.iso.datetime() }).safeParse({ token, startsAt });
  if (!parsed.success) return { outcome: "invalid" };
  const wait = await limited(parsed.data.token);
  if (wait) return { outcome: "retry", minutes: wait.minutes };
  const result = await rescheduleByToken(parsed.data.token, new Date(parsed.data.startsAt));
  if (result.outcome === "taken") return { outcome: "taken", alternatives: result.alternatives.map((slot) => slot.toISOString()) };
  if (result.outcome === "invalid") return { outcome: "invalid" };
  const view = await viewOf(parsed.data.token);
  return view ? { outcome: "valid", view } : { outcome: "invalid" };
}

export async function cancelAppointmentByLinkAction(token: unknown, reason: unknown): Promise<ManageOutcome> {
  const parsed = z.object({ token: tokenSchema, reason: z.union([z.enum(APPOINTMENT_CANCEL_REASONS), z.literal("")]) }).safeParse({ token, reason });
  if (!parsed.success) return { outcome: "invalid" };
  const wait = await limited(parsed.data.token);
  if (wait) return { outcome: "retry", minutes: wait.minutes };
  await cancelByToken(parsed.data.token, parsed.data.reason === "" ? null : (parsed.data.reason as AppointmentCancelReason));
  const view = await viewOf(parsed.data.token);
  return view ? { outcome: "valid", view } : { outcome: "invalid" };
}
