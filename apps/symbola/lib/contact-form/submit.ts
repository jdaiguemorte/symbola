// Lot 44 (CRM-01 ; D4, D6 ; ADR 0084) — l'envoi du formulaire de contact public, gardé sans captcha
// visible : piège à robots, délai minimal de remplissage (heure d'ouverture scellée), limitation de débit
// par adresse IP et par organisation. Un envoi refusé par la garde reçoit la même réponse qu'un envoi
// réussi : le robot n'apprend rien. Seul un champ mal rempli est signalé, pour que la personne le
// corrige. Rien n'est envoyé à un service extérieur ; rien de personnel dans les journaux (SEC-20).
import { isHoneypotFilled } from "@/lib/honeypot";
import { consumeRateLimits } from "@symbola/db/rate-limit";
import { appDatabase } from "@symbola/db/client";
import { clientIpFrom, rateLimitRules } from "@/lib/rate-limit";
import { ContactSubmissionInvalidError, isFormTimingValid, resolvePublicContactForm, submitContactForm, type RawContactSubmission, type SubmitOptions } from "@/modules/events/service";

export const CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "eventDate", "period", "place", "budget", "guests", "eventTypeId", "sourceId", "message"] as const;

export type ContactFormState =
  | { step: "form"; error?: "name" | "contact" | "email" | "phone" | "date" | "guests" | "budget" | "message" | "period" | "place"; values?: Record<string, string> }
  | { step: "sent" }
  | { step: "unavailable" };

const SENT: ContactFormState = { step: "sent" };

function valuesOf(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of CONTACT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value.slice(0, field === "message" ? 5000 : 400);
  }
  return values;
}

export async function handleContactSubmission(formData: FormData, context: { headers: Headers; locale: "fr" | "en"; now?: Date; submit?: SubmitOptions }): Promise<ContactFormState> {
  const now = context.now ?? new Date();
  const slug = String(formData.get("slug") ?? "");
  const form = await resolvePublicContactForm(slug, context.locale);
  if (!form) return { step: "unavailable" };
  // Garde : piège rempli, envoi trop rapide ou horodatage falsifié, débit dépassé → « envoyé ».
  if (isHoneypotFilled(formData)) return SENT;
  if (!isFormTimingValid(form, String(formData.get("opened") ?? ""), now)) return SENT;
  const rules = [...rateLimitRules("contactForm", { ip: clientIpFrom(context.headers), account: null }), ...rateLimitRules("contactFormOrganization", { ip: null, account: form.organizationId })];
  const decision = await consumeRateLimits(appDatabase(), rules, now);
  if (!decision.allowed) return SENT;
  const values = valuesOf(formData);
  try {
    // Créé, mis de côté (« à vérifier ») ou ignoré (formulaire fermé entre-temps) : même réponse.
    await submitContactForm(form, values as RawContactSubmission, { ...context.submit, now });
    return SENT;
  } catch (error) {
    if (error instanceof ContactSubmissionInvalidError) return { step: "form", error: error.field, values };
    throw error;
  }
}
