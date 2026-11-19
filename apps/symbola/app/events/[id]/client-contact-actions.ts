"use server";

// Lot 14 (décisions I et K) — coordonnées des clients de l'événement et
// budget souhaité, depuis la fiche. Session, organisation et module vérifiés.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import { EventNotesForbiddenError, saveEventNotes } from "@/modules/events/service";
import { ClientEmailTakenError, EventNotFoundError, getEventIdentityState, InvalidClientContactError, setEventIdentity, setEventVenue, setEventWantedBudget, updateEventClientContact } from "@/modules/events/service";
import { runAutosave, versionOf, type AutosaveState } from "@/lib/autosave-server";
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

// Lot 39b (UX-09 ; D7, D8 ; ADR 0074) — l'identité de l'évènement (invités, style, notes) s'enregistre
// toute seule ; une modification faite entre-temps est fusionnée ou montrée en conflit.
const IDENTITY_FIELDS = ["guestsEstimated", "guestsConfirmed", "style", "notes"] as const;

class IdentityCountError extends Error {}

export async function autosaveEventIdentityAction(_previous: AutosaveState, formData: FormData): Promise<AutosaveState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { status: "error", message: t("unauthenticated"), at: Date.now() };
  const organizationId = auth.user.organizationId;
  const eventId = field(formData, "id");
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) return { status: "error", message: t("eventNotFound"), at: Date.now() };
  const count = (raw: string): number | null => {
    const value = raw.trim();
    if (!value) return null;
    if (!/^\d{1,6}$/.test(value)) throw new IdentityCountError();
    return Number(value);
  };
  return runAutosave({
    organizationId,
    userId: auth.user.id,
    formData,
    fields: IDENTITY_FIELDS,
    read: async () => {
      const state = await getEventIdentityState(organizationId, eventId);
      if (!state) return null;
      return {
        values: { guestsEstimated: state.guestsEstimated?.toString() ?? "", guestsConfirmed: state.guestsConfirmed?.toString() ?? "", style: state.style ?? "", notes: state.notes ?? "" },
        version: versionOf(state.updatedAt),
        updatedBy: state.updatedBy,
      };
    },
    write: async (values) => {
      await setEventIdentity(organizationId, eventId, {
        guestsEstimated: count(values.guestsEstimated ?? ""),
        guestsConfirmed: count(values.guestsConfirmed ?? ""),
        style: (values.style ?? "").slice(0, 2001),
        notes: (values.notes ?? "").slice(0, 10_001),
      });
    },
    knownError: async (error) => {
      if (error instanceof IdentityCountError) return t("guestsInvalid");
      if (error instanceof RangeError) return t("identityInvalid");
      if (error instanceof EventNotFoundError) return t("eventNotFound");
      return null;
    },
    notFound: t("eventNotFound"),
  });
}

// Lot 48a (DAT-08 ; D5, ADR 0093) — notes de l'évènement, en clair ou confidentielles (chiffrées).
export async function saveEventNotesAction(_prev: ClientContactFormState, formData: FormData): Promise<ClientContactFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  const access = await authorize(t);
  if ("error" in access || auth.status !== "authenticated") return { error: "error" in access ? access.error : t("eventNotFound") };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  try {
    await saveEventNotes(access.organizationId, eventId, { notes: String(formData.get("notes") ?? "").slice(0, 10_001), confidential: formData.get("confidential") === "on" }, { userId: auth.user.id, role: auth.user.role });
  } catch (error) {
    if (error instanceof EventNotesForbiddenError) return { error: t("eventNotesForbidden") };
    if (error instanceof RangeError) return { error: t("identityInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
