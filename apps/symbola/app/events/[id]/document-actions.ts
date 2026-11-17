"use server";

// Lot 29b (JRJ-04, décision D8) — documents de l'événement : renommer, supprimer
// (le fichier et son choix pour le jour J partent avec la ligne). L'envoi passe par
// la route dédiée documents/route.ts.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  createEventDocumentFolder,
  createEventDocumentLink,
  DOCUMENT_LINK_MAX_DAYS,
  DOCUMENT_LINK_MIN_DAYS,
  EventDocumentNotFoundError,
  EventDocumentRejectedError,
  EventNotFoundError,
  moveEventDocument,
  removeEventDocument,
  removeEventDocumentFolder,
  renameEventDocument,
  renameEventDocumentFolder,
  revokeEventDocumentLink,
  setEventDocumentSharing,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type EventDocumentFormState = { error?: string; success?: boolean };
// Lot 37a (DOC-04, D7) : l'adresse d'un lien de partage n'est montrée qu'une fois, à sa création.
export type DocumentLinkFormState = EventDocumentFormState & { url?: string; expiresAt?: string };

async function planner(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

async function organization(): Promise<string | null> {
  return (await planner())?.organizationId ?? null;
}

function ids(formData: FormData, ...names: string[]): string[] | null {
  const values = names.map((name) => String(formData.get(name) ?? ""));
  return values.every((value) => isValidId(value)) ? values : null;
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
    await offerUndo({ kind: "document", id: documentId });
  } catch (error) {
    if (!(error instanceof EventDocumentNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

// Lot 37a (DOC-01, D3) — dossiers d'un niveau, nommés par l'équipe.
export async function createDocumentFolderAction(_previous: EventDocumentFormState, formData: FormData): Promise<EventDocumentFormState> {
  const t = await getTranslations("EventDocuments");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const [eventId] = ids(formData, "eventId") ?? [];
  if (!eventId) return { error: t("notFound") };
  try {
    await createEventDocumentFolder(organizationId, eventId, String(formData.get("name") ?? ""));
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) return { error: t("folderNameInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function renameDocumentFolderAction(_previous: EventDocumentFormState, formData: FormData): Promise<EventDocumentFormState> {
  const t = await getTranslations("EventDocuments");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const [eventId, folderId] = ids(formData, "eventId", "folderId") ?? [];
  if (!eventId || !folderId) return { error: t("notFound") };
  try {
    await renameEventDocumentFolder(organizationId, folderId, String(formData.get("name") ?? ""));
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) return { error: t("folderNameInvalid") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeDocumentFolderAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const [eventId, folderId] = ids(formData, "eventId", "folderId") ?? [];
  if (!organizationId || !eventId || !folderId) return;
  try {
    await removeEventDocumentFolder(organizationId, folderId);
  } catch (error) {
    if (!(error instanceof EventDocumentRejectedError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

// Ranger un document : un dossier de l'évènement, ou « Divers » (valeur vide).
export async function moveDocumentAction(_previous: EventDocumentFormState, formData: FormData): Promise<EventDocumentFormState> {
  const t = await getTranslations("EventDocuments");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const [eventId, documentId] = ids(formData, "eventId", "documentId") ?? [];
  if (!eventId || !documentId) return { error: t("notFound") };
  const folder = String(formData.get("folderId") ?? "");
  try {
    await moveEventDocument(organizationId, documentId, folder === "" ? null : folder);
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) return { error: t("folderInvalid") };
    if (error instanceof EventDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 37a (POR-10, D6) — partage, à la main, avec les clients et les prestataires de l'évènement.
export async function setDocumentSharingAction(_previous: EventDocumentFormState, formData: FormData): Promise<EventDocumentFormState> {
  const t = await getTranslations("EventDocuments");
  const organizationId = await organization();
  if (!organizationId) return { error: t("unauthorized") };
  const [eventId, documentId] = ids(formData, "eventId", "documentId") ?? [];
  if (!eventId || !documentId) return { error: t("notFound") };
  try {
    await setEventDocumentSharing(organizationId, documentId, { clients: formData.get("clients") === "on", vendors: formData.get("vendors") === "on" });
  } catch (error) {
    if (error instanceof EventDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 37a (DOC-04, D7) — lien de partage d'un document, de 1 à 30 jours.
export async function createDocumentLinkAction(_previous: DocumentLinkFormState, formData: FormData): Promise<DocumentLinkFormState> {
  const t = await getTranslations("EventDocuments");
  const current = await planner();
  if (!current) return { error: t("unauthorized") };
  const [eventId, documentId] = ids(formData, "eventId", "documentId") ?? [];
  if (!eventId || !documentId) return { error: t("notFound") };
  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < DOCUMENT_LINK_MIN_DAYS || days > DOCUMENT_LINK_MAX_DAYS) return { error: t("linkDaysInvalid", { min: DOCUMENT_LINK_MIN_DAYS, max: DOCUMENT_LINK_MAX_DAYS }) };
  try {
    const { link, url } = await createEventDocumentLink({ organizationId: current.organizationId, documentId, days, createdByUserId: current.userId });
    revalidatePath(`/events/${eventId}`);
    return { success: true, url, expiresAt: link.expiresAt };
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) return { error: t("linkDaysInvalid", { min: DOCUMENT_LINK_MIN_DAYS, max: DOCUMENT_LINK_MAX_DAYS }) };
    if (error instanceof EventDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
}

export async function revokeDocumentLinkAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const [eventId, linkId] = ids(formData, "eventId", "linkId") ?? [];
  if (!organizationId || !eventId || !linkId) return;
  try {
    await revokeEventDocumentLink(organizationId, linkId);
  } catch (error) {
    if (!(error instanceof EventDocumentNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
