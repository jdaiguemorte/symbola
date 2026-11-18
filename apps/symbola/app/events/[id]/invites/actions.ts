"use server";

// Lot 49 (INV-01 à INV-04, INV-07, RGP-08 ; D3, D4, D9 à D13 ; partie G) — actions de l'onglet
// Invités de la fiche : activation (titulaire), réglages des réponses, foyers, réponses notées,
// liens (copie et QR code), invitations après l'écran de contrôle, import, report de la purge.
// Chaque action relit la session, l'organisation et les modules (guestsAccess) ; le service relit
// l'évènement dans l'organisation (RLS).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { RecipientsReview } from "@symbola/contracts";
import { RecipientsNotConfirmedError } from "@/modules/hub/service";
import {
  confirmImpactAssessment,
  GuestSettingsInvalidError,
  HouseholdInvalidError,
  issueGuestLink,
  postponeGuestPurge,
  recordHouseholdAnswers,
  removeHousehold,
  revokeGuestLinks,
  saveGuestEventSettings,
  saveHousehold,
  sendGuestInvitations,
  undoGuestImport,
} from "@/modules/guests/service";
import { invitationWords } from "@/lib/guest-tasks";
import { isValidId } from "../../module-access";
import { guestsAccess } from "./access";
import { guestErrorKey, parseHousehold } from "./form-schemas";
import { runImport, type ImportState } from "./import-runner";

export type { ImportState } from "./import-runner";

export type GuestFormState = { error?: string; success?: boolean };

async function failure(error: unknown): Promise<GuestFormState> {
  const key = guestErrorKey(error);
  if (!key) throw error;
  const t = await getTranslations("Guests.errors");
  return { error: t.has(key) ? t(key) : t("generic") };
}

async function denied(): Promise<GuestFormState> {
  const t = await getTranslations("Guests.errors");
  return { error: t("denied") };
}

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// Partie G : la titulaire confirme avoir complété l'analyse d'impact « socle ».
export async function confirmImpactAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await guestsAccess();
  if (!access || !access.owner) return denied();
  if (formData.get("confirmed") !== "on") {
    const t = await getTranslations("Guests.errors");
    return { error: t("confirmRequired") };
  }
  await confirmImpactAssessment(access.organizationId, access.userId);
  revalidatePath("/events", "layout");
  return { success: true };
}

const settingsSchema = z.object({
  responsesCloseOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  askDiet: z.boolean(),
  askAccommodation: z.boolean(),
  askTransport: z.boolean(),
  reminderDays: z.array(z.coerce.number().int().min(1).max(90)).max(3),
});

export async function saveGuestSettingsAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return denied();
  const parsed = settingsSchema.safeParse({
    responsesCloseOn: String(formData.get("responsesCloseOn") ?? ""),
    askDiet: formData.get("askDiet") === "on",
    askAccommodation: formData.get("askAccommodation") === "on",
    askTransport: formData.get("askTransport") === "on",
    reminderDays: formData.getAll("reminderDays").map(String).filter((value) => value.trim() !== ""),
  });
  if (!parsed.success) return failure(new GuestSettingsInvalidError("reminders"));
  try {
    await saveGuestEventSettings(access.organizationId, eventId, { ...parsed.data, responsesCloseOn: parsed.data.responsesCloseOn || null });
  } catch (error) {
    return failure(error);
  }
  refresh(eventId);
  return { success: true };
}

export async function saveHouseholdAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  const householdId = String(formData.get("householdId") ?? "");
  const input = parseHousehold(formData.get("household"));
  if (!isValidId(eventId) || !input || (householdId && !isValidId(householdId))) return failure(new HouseholdInvalidError("person_name_missing"));
  try {
    await saveHousehold(access.organizationId, eventId, householdId || null, input);
  } catch (error) {
    return failure(error);
  }
  refresh(eventId);
  return { success: true };
}

export async function removeHouseholdAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const householdId = String(formData.get("householdId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(householdId)) return;
  try {
    await removeHousehold(access.organizationId, eventId, householdId);
  } catch (error) {
    if (!guestErrorKey(error)) throw error;
  }
  refresh(eventId);
}

// Réponse reçue autrement (téléphone, carton) : la planner la note.
export async function recordAnswersAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  const householdId = String(formData.get("householdId") ?? "");
  if (!isValidId(eventId) || !isValidId(householdId)) return denied();
  const presence = [...formData.entries()].flatMap(([name, value]) => {
    const match = /^presence:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(name);
    if (!match || (value !== "yes" && value !== "no")) return [];
    return [{ guestId: match[1]!, keyMomentId: match[2]!, attending: value === "yes" }];
  });
  try {
    await recordHouseholdAnswers(access.organizationId, eventId, householdId, presence, "planner");
  } catch (error) {
    return failure(error);
  }
  refresh(eventId);
  return { success: true };
}

export type GuestLinkState = { error?: string; url?: string; qrCodeDataUrl?: string };

// D4 : un lien à copier et son QR code ; montré une fois (seule l'empreinte reste).
export async function issueGuestLinkAction(_prev: GuestLinkState, formData: FormData): Promise<GuestLinkState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  if (!isValidId(eventId) || !isValidId(guestId)) return denied();
  try {
    return await issueGuestLink(access.organizationId, eventId, guestId);
  } catch (error) {
    return failure(error);
  }
}

export async function revokeGuestLinksAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(guestId)) return;
  await revokeGuestLinks(access.organizationId, eventId, guestId).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(eventId);
}

export type InvitationState = GuestFormState & { review?: RecipientsReview; sent?: number; notSent?: number };

// D4 + MSG-02 : l'envoi passe toujours l'écran de contrôle (nombre, liste, calendrier des relances).
export async function sendInvitationsAction(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return denied();
  const confirmed = formData.get("confirmedRecipients");
  try {
    const result = await sendGuestInvitations({ organizationId: access.organizationId, eventId, confirmedRecipients: typeof confirmed === "string" ? confirmed : null, words: invitationWords() });
    refresh(eventId);
    return { success: true, sent: result.sent, notSent: result.notSent };
  } catch (error) {
    if (error instanceof RecipientsNotConfirmedError) return { review: error.review };
    return failure(error);
  }
}

// INV-02 : aperçu (rien n'est écrit), puis application des lignes gardées. Le fichier est renvoyé à
// chaque étape ; il n'est jamais gardé.
export async function importGuestsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const access = await guestsAccess();
  if (!access) return denied();
  return runImport(access.organizationId, String(formData.get("eventId") ?? ""), formData, "planner");
}

export async function undoGuestImportAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const importId = String(formData.get("importId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(importId)) return;
  await undoGuestImport(access.organizationId, eventId, importId).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(eventId);
}

// RGP-08, D9 : un seul report, motivé, de 90 jours au plus (titulaire ou membre de l'équipe).
export async function postponePurgeAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return denied();
  try {
    await postponeGuestPurge(access.organizationId, eventId, { until: String(formData.get("until") ?? ""), reason: String(formData.get("reason") ?? "") });
  } catch (error) {
    return failure(error);
  }
  refresh(eventId);
  return { success: true };
}
