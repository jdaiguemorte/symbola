"use server";

// Lot 29b (JRJ-04, décision D8) — documents de l'événement : renommer, supprimer
// (le fichier et son choix pour le jour J partent avec la ligne). L'envoi passe par
// la route dédiée documents/route.ts.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { EventDocumentNotFoundError, EventDocumentRejectedError, removeEventDocument, renameEventDocument } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type EventDocumentFormState = { error?: string; success?: boolean };

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function renameEventDocumentAction(_previous: EventDocumentFormState, formData: FormData): Promise<EventDocumentFormState> {
  const t = await getTranslations("EventDocuments");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const eventId = String(formData.get("eventId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!isValidId(eventId) || !isValidId(documentId)) return { error: t("notFound") };
  try {
    await renameEventDocument(organizationId, documentId, String(formData.get("label") ?? ""));
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) return { error: t("labelInvalid") };
    if (error instanceof EventDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeEventDocumentAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!organizationId || !isValidId(eventId) || !isValidId(documentId)) return;
  try {
    await removeEventDocument(organizationId, documentId);
  } catch (error) {
    if (!(error instanceof EventDocumentNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
