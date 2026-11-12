"use server";

// Lot 30a (JRJ-03, décision D4) — contacts du jour J de l'événement : ajout et retrait.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addEventDayContact, DayContactInvalidError, EventDayContactNotFoundError, EventNotFoundError, removeEventDayContact } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type DayContactFormState = { error?: string; success?: boolean };

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function addDayContactAction(_previous: DayContactFormState, formData: FormData): Promise<DayContactFormState> {
  const t = await getTranslations("DayContacts");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("notFound") };
  try {
    await addEventDayContact(organizationId, eventId, {
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
  } catch (error) {
    if (error instanceof DayContactInvalidError) return { error: t(`${error.reason}Invalid`) };
    if (error instanceof EventNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeDayContactAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(contactId)) return;
  try {
    await removeEventDayContact(organizationId, contactId);
  } catch (error) {
    if (!(error instanceof EventDayContactNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
