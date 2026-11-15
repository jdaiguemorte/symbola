"use server";

// Lot 14 (décisions I et K) — coordonnées des clients de l'événement et
// budget souhaité, depuis la fiche. Session, organisation et module vérifiés.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import { ClientEmailTakenError, EventNotFoundError, InvalidClientContactError, setEventIdentity, setEventVenue, setEventWantedBudget, updateEventClientContact } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ClientContactFormState = { error?: string; success?: boolean };

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").slice(0, 300);

export async function updateClientContactAction(_prev: ClientContactFormState, formData: FormData): Promise<ClientContactFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = field(formData, "eventId");
  const clientId = field(formData, "clientId");
  if (!isValidId(eventId) || !isValidId(clientId)) return { error: t("eventNotFound") };
  try {
    await updateEventClientContact({
      organizationId: access.organizationId,
      eventId,
      clientId,
      contact: {
        email: field(formData, "email"),
        phone: field(formData, "phone"),
        addressLine: field(formData, "addressLine"),
        postalCode: field(formData, "postalCode"),
        city: field(formData, "city"),
      },
    });
  } catch (error) {
    if (error instanceof InvalidClientContactError) return { error: t("clientContactInvalidEmail") };
    // Lot 36a (DAT-12) : l'adresse est celle d'un autre contact de l'organisation.
    if (error instanceof ClientEmailTakenError) return { error: (await getTranslations("Contacts"))("emailTaken") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function setWantedBudgetAction(_prev: ClientContactFormState, formData: FormData): Promise<ClientContactFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const raw = field(formData, "wantedBudget").trim();
  const cents = raw === "" ? null : parseAmountToCents(raw);
  if (cents === undefined || (cents !== null && cents < 0)) return { error: t("wantedBudgetInvalid") };
  try {
    await setEventWantedBudget(access.organizationId, eventId, cents);
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 31b (FAC-04, DOC-02) — lieu de l'événement (nom, ville), repris par la variable
// {evenement.lieu} du contrat.
export async function setVenueAction(_prev: ClientContactFormState, formData: FormData): Promise<ClientContactFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  try {
    await setEventVenue(access.organizationId, eventId, { venueName: field(formData, "venueName"), venueCity: field(formData, "venueCity") });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof RangeError) return { error: t("venueInvalid") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 34b (EVT-03, D11) — fiche d'identité : invités estimés et confirmés, style, notes.
export async function setEventIdentityAction(_prev: ClientContactFormState, formData: FormData): Promise<ClientContactFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const count = (name: string): number | null | "invalid" => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    return /^\d{1,6}$/.test(raw) ? Number(raw) : "invalid";
  };
  const guestsEstimated = count("guestsEstimated");
  const guestsConfirmed = count("guestsConfirmed");
  if (guestsEstimated === "invalid" || guestsConfirmed === "invalid") return { error: t("guestsInvalid") };
  try {
    await setEventIdentity(access.organizationId, eventId, {
      guestsEstimated,
      guestsConfirmed,
      style: String(formData.get("style") ?? "").slice(0, 2001),
      notes: String(formData.get("notes") ?? "").slice(0, 10_001),
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("identityInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
