"use server";

// Lot 46 (RDV-02, RDV-03 ; D5 ; ADR 0083) — réservation sur la page publique, sans compte. Entrée
// validée par Zod ; piège à robots (ignoré sans le dire) ; limitation de débit par adresse IP et par
// adresse e-mail ; au plus trois rendez-vous à venir par adresse et par organisation. La réponse ne
// dit jamais si une adresse est connue : le plafond atteint reçoit le même message qu'un débit
// dépassé. Rien de personnel dans les journaux.
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { isHoneypotFilled } from "@/lib/honeypot";
import { AppointmentInvalidError, bookAppointment, manageUrl, resolvePublicBookingPage } from "@/modules/appointments/service";

export type BookingState =
  | { step: "form"; error?: "invalid" | "name" | "email" | "phone" | "answer" | "slot"; values?: Record<string, string> }
  | { step: "booked"; startsAt: string; manageUrl: string | null }
  | { step: "taken"; alternatives: string[]; values: Record<string, string> }
  | { step: "refused" }
  | { step: "unavailable" };

const schema = z.object({
  slug: z.string().max(80),
  typeId: z.uuid(),
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  phone: z.string().trim().max(40),
});

function valuesOf(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, entry] of formData.entries()) if (typeof entry === "string" && key !== "startsAt" && !key.startsWith("$")) values[key] = entry.slice(0, 500);
  return values;
}

export async function bookAppointmentAction(_previous: BookingState, formData: FormData): Promise<BookingState> {
  if (isHoneypotFilled(formData)) return { step: "booked", startsAt: String(formData.get("startsAt") ?? ""), manageUrl: null };
  const values = valuesOf(formData);
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    typeId: formData.get("typeId"),
    startsAt: formData.get("startsAt"),
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { step: "form", error: field === "name" || field === "email" || field === "phone" ? field : field === "startsAt" ? "slot" : "invalid", values };
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const page = await resolvePublicBookingPage(parsed.data.slug, locale);
  if (!page || !page.types.some((type) => type.id === parsed.data.typeId)) return { step: "unavailable" };
  const ip = await checkRateLimit("appointmentBooking", { account: parsed.data.email });
  if (!ip.allowed) return { step: "refused" };
  const answers: Record<string, string> = {};
  for (const [key, entry] of formData.entries()) if (key.startsWith("q_") && typeof entry === "string") answers[key.slice(2)] = entry;
  try {
    const result = await bookAppointment({
      organizationId: page.organizationId,
      typeId: parsed.data.typeId,
      startsAt: new Date(parsed.data.startsAt),
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      answers,
      locale,
    });
    if (result.outcome === "booked") return { step: "booked", startsAt: result.appointment.startsAt, manageUrl: manageUrl(result.manageToken) };
    if (result.outcome === "taken") return { step: "taken", alternatives: result.alternatives.map((slot) => slot.toISOString()), values };
    if (result.outcome === "limit") return { step: "refused" };
    return { step: "unavailable" };
  } catch (error) {
    if (error instanceof AppointmentInvalidError) {
      const field = error.field.startsWith("answer") ? "answer" : error.field;
      return { step: "form", error: field === "name" || field === "email" || field === "phone" || field === "answer" ? field : "invalid", values };
    }
    throw error;
  }
}
