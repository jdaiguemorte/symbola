"use server";

// Lot 55 (MSG-03 ; D3 ; ADR 0102) — sujets de discussion d'un évènement : créer un sujet, choisir ses
// prestataires. Contrôles côté serveur : session de l'équipe, évènement visible, module Évènements ;
// la RLS borne le sujet à l'organisation. Les messages passent par les routes partage/ et interne/
// (pièces jointes).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent } from "@/lib/event-visibility";
import { createMessageTopic, EventArchivedError, MessageInputError, MessageNotFoundError, setMessageTopicVendors } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export type MessageTopicFormState = { error?: string; success?: boolean };

async function team(eventId: string): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || !isValidId(eventId)) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  if (!(await canSeeEvent({ user: { id: auth.user.id, role: auth.user.role, organizationId: auth.user.organizationId } }, eventId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function createMessageTopicAction(_previous: MessageTopicFormState, formData: FormData): Promise<MessageTopicFormState> {
  const t = await getTranslations("Messages");
  const eventId = String(formData.get("eventId") ?? "");
  const access = await team(eventId);
  if (!access) return { error: t("errors.notFound") };
  let topicId: string;
  try {
    topicId = (await createMessageTopic({ organizationId: access.organizationId, eventId, name: String(formData.get("name") ?? "") })).id;
  } catch (error) {
    if (error instanceof MessageInputError) return { error: t("errors.name") };
    if (error instanceof EventArchivedError) return { error: t("errors.archived") };
    throw error;
  }
  revalidatePath(`/events/${eventId}/messages`);
  redirect(`/events/${eventId}/messages/${topicId}`);
}

export async function setTopicVendorsAction(_previous: MessageTopicFormState, formData: FormData): Promise<MessageTopicFormState> {
  const t = await getTranslations("Messages");
  const eventId = String(formData.get("eventId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const access = await team(eventId);
  if (!access || !isValidId(topicId)) return { error: t("errors.notFound") };
  const vendorLinkIds = formData.getAll("vendorLinkIds").map(String).filter(isValidId);
  try {
    await setMessageTopicVendors({ organizationId: access.organizationId, eventId, topicId, vendorLinkIds });
  } catch (error) {
    if (error instanceof MessageNotFoundError) return { error: t("errors.notFound") };
    if (error instanceof EventArchivedError) return { error: t("errors.archived") };
    throw error;
  }
  revalidatePath(`/events/${eventId}/messages/${topicId}`);
  return { success: true };
}
