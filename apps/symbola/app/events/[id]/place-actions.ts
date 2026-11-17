"use server";

// Lot 12 (L12-EVT-15) — lieux de l'événement : ajout et retrait. Lot 34b (EVT-03, D10) : chaque lieu
// porte adresse, ville, horaires et contact ; le premier de la liste est le lieu de réception.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addEventPlace, EventPlaceEventNotFoundError, EventPlaceNotFoundError, makeEventReceptionPlace, removeEventPlace, updateEventPlace } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type PlaceFormState = { error?: string; success?: boolean };

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function addPlaceAction(_prev: PlaceFormState, formData: FormData): Promise<PlaceFormState> {
  const t = await getTranslations("Events");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const vendorId = String(formData.get("vendorId") ?? "");
  try {
    await addEventPlace(organizationId, eventId, {
      label: String(formData.get("label") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      vendorId: isValidId(vendorId) ? vendorId : null,
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("placeLabelRequired") };
    if (error instanceof EventPlaceEventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updatePlaceAction(_prev: PlaceFormState, formData: FormData): Promise<PlaceFormState> {
  const t = await getTranslations("Events");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  if (!isValidId(eventId) || !isValidId(placeId)) return { error: t("placeNotFound") };
  const field = (name: string) => String(formData.get(name) ?? "");
  try {
    await updateEventPlace(organizationId, eventId, placeId, {
      label: field("label"),
      address: field("address"),
      city: field("city"),
      startTime: field("startTime"),
      endTime: field("endTime"),
      contactName: field("contactName"),
      contactPhone: field("contactPhone"),
      contactEmail: field("contactEmail"),
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("placeDetailsInvalid") };
    if (error instanceof EventPlaceNotFoundError) return { error: t("placeNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function makeReceptionPlaceAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(placeId)) return;
  try {
    await makeEventReceptionPlace(organizationId, eventId, placeId);
  } catch (error) {
    if (!(error instanceof EventPlaceNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

export async function removePlaceAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(placeId)) return;
  await removeEventPlace(organizationId, eventId, placeId);
  await offerUndo({ kind: "place", id: placeId });
  revalidatePath(`/events/${eventId}`);
}
