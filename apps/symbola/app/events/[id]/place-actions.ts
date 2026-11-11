"use server";

// Lot 12 (L12-EVT-15) — lieux de l'événement : ajout et retrait.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addEventPlace, EventPlaceEventNotFoundError, removeEventPlace } from "@/modules/events/service";
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

export async function removePlaceAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(placeId)) return;
  await removeEventPlace(organizationId, eventId, placeId);
  revalidatePath(`/events/${eventId}`);
}
