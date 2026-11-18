"use server";

// Lot 49 (EVT-04 premier pas, D2) — temps forts de l'évènement (cérémonie, dîner, brunch) : ajout,
// modification, retrait, depuis la synthèse de la fiche. Le RSVP du module Invités demande la
// présence par temps fort.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addKeyMoment, KeyMomentInvalidError, KeyMomentNotFoundError, removeKeyMoment, updateKeyMoment } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type KeyMomentFormState = { error?: string; success?: boolean };

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

function input(formData: FormData) {
  const placeId = String(formData.get("placeId") ?? "");
  return {
    name: String(formData.get("name") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    placeId: isValidId(placeId) ? placeId : null,
  };
}

async function failure(error: unknown): Promise<KeyMomentFormState> {
  const t = await getTranslations("Events");
  if (error instanceof KeyMomentInvalidError) return { error: t(`keyMomentInvalid.${error.problem}`) };
  if (error instanceof KeyMomentNotFoundError) return { error: t("eventNotFound") };
  throw error;
}

export async function addKeyMomentAction(_prev: KeyMomentFormState, formData: FormData): Promise<KeyMomentFormState> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  if (!organizationId || !isValidId(eventId)) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await addKeyMoment(organizationId, eventId, input(formData));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updateKeyMomentAction(_prev: KeyMomentFormState, formData: FormData): Promise<KeyMomentFormState> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const keyMomentId = String(formData.get("keyMomentId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(keyMomentId)) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await updateKeyMoment(organizationId, eventId, keyMomentId, input(formData));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeKeyMomentAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const keyMomentId = String(formData.get("keyMomentId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(keyMomentId)) return;
  // Lot 51 (EVT-04) : un temps fort qui porte des séquences reste (son bouton n'est pas montré).
  await removeKeyMoment(organizationId, eventId, keyMomentId).catch((error: unknown) => {
    if (!(error instanceof KeyMomentNotFoundError) && !(error instanceof KeyMomentInvalidError)) throw error;
  });
  revalidatePath(`/events/${eventId}`);
}
