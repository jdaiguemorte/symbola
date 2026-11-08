"use server";

// Lot 16 (ADR 0045) — rubrique « Types d'événements » des Paramètres : ajout,
// modification (nom, qui sont les clients) et suppression d'un type.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  createEventType,
  EventTypeInUseError,
  EventTypeNotFoundError,
  LastEventTypeError,
  removeEventType,
  updateEventType,
  type EventTypeAudience,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type EventTypeFormState = { error?: string; success?: boolean };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return (await isEventsModuleEnabled(auth.user.organizationId)) ? auth.user.organizationId : null;
}

function readInput(formData: FormData): { label: string; audience: EventTypeAudience } {
  return { label: String(formData.get("label") ?? ""), audience: formData.get("audience") === "couple" ? "couple" : "clients" };
}

function refresh() {
  revalidatePath("/events/parametres/types");
  revalidatePath("/events/new");
}

export async function createEventTypeAction(_prev: EventTypeFormState, formData: FormData): Promise<EventTypeFormState> {
  const t = await getTranslations("EventTypes");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await createEventType(organizationId, readInput(formData));
  } catch (error) {
    if (error instanceof RangeError) return { error: t("invalid") };
    throw error;
  }
  refresh();
  return { success: true };
}

export async function updateEventTypeAction(_prev: EventTypeFormState, formData: FormData): Promise<EventTypeFormState> {
  const t = await getTranslations("EventTypes");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (!isValidId(eventTypeId)) return { error: t("notFound") };
  try {
    await updateEventType(organizationId, eventTypeId, readInput(formData));
  } catch (error) {
    if (error instanceof RangeError) return { error: t("invalid") };
    if (error instanceof EventTypeNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh();
  return { success: true };
}

export async function removeEventTypeAction(_prev: EventTypeFormState, formData: FormData): Promise<EventTypeFormState> {
  const t = await getTranslations("EventTypes");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  const moveTo = String(formData.get("moveTo") ?? "");
  if (!isValidId(eventTypeId)) return { error: t("notFound") };
  try {
    await removeEventType(organizationId, eventTypeId, isValidId(moveTo) ? moveTo : null);
  } catch (error) {
    if (error instanceof EventTypeInUseError) return { error: t("inUse") };
    if (error instanceof LastEventTypeError) return { error: t("last") };
    if (error instanceof EventTypeNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh();
  return { success: true };
}
