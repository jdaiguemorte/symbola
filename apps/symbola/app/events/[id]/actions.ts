"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  cancelEvent,
  changeEventStatus,
  confirmPostponement,
  EventDateRequiredError,
  EventNotFoundError,
  EventStatusTransitionError,
  EventTypeNotFoundError,
  listLossReasons,
  postponeEvent,
  reactivateEvent,
  setEventTimeZone,
  setEventType,
  type EventStatus,
} from "@/modules/events/service";
import { followEventDateInSignedQuotes } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ChangeStatusFormState = { error?: string; success?: boolean };

// Lot 16 (ADR 0045) — le type de l'événement, et avec lui le vocabulaire de ses
// écrans (« les mariés » ou « le client »).
export async function setEventTypeAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return;
  const eventId = String(formData.get("eventId") ?? "");
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (!isValidId(eventId) || !isValidId(eventTypeId)) return;
  try {
    await setEventType(organizationId, eventId, eventTypeId);
  } catch (error) {
    if (error instanceof EventTypeNotFoundError || error instanceof EventNotFoundError) return;
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

// Lot 34a (EVT-05, D2 à D7) — statuts : la frise pose Option, Confirmé, En préparation,
// Clôturé ; l'annulation demande un motif ; le report demande la nouvelle date (ou « date à
// définir ») et se confirme après avoir vu les tâches qui tomberaient dans le passé.
const MANUAL: EventStatus[] = ["option", "confirmed", "in_preparation", "closed"];

type Access = { organizationId: string; userId: string };

async function plannerAccess(t: Awaited<ReturnType<typeof getTranslations>>): Promise<Access | { error: string }> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

function refresh(eventId: string): void {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

async function guarded(t: Awaited<ReturnType<typeof getTranslations>>, work: () => Promise<void>): Promise<ChangeStatusFormState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof EventStatusTransitionError) return { error: t("statusTransitionRefused") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventDateRequiredError) return { error: t("postponeDateRequired") };
    throw error;
  }
  return { success: true };
}

export async function changeEventStatusAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const toStatus = String(formData.get("toStatus") ?? "") as EventStatus;
  if (!MANUAL.includes(toStatus)) return { error: t("invalidStatus") };
  const result = await guarded(t, () => changeEventStatus({ organizationId: access.organizationId, eventId, changedByUserId: access.userId, toStatus }));
  refresh(eventId);
  return result;
}

// D6 : l'annulation demande un motif (motifs de perte ou d'annulation) ; les données restent.
export async function cancelEventAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const lossReasonId = String(formData.get("lossReasonId") ?? "").trim() || null;
  const lossReasonNote = String(formData.get("lossReasonNote") ?? "").trim().slice(0, 1000) || null;
  if (!lossReasonId) return { error: t("missingLossReason") };
  const reason = (await listLossReasons(access.organizationId)).find((candidate) => candidate.id === lossReasonId);
  if (!reason) return { error: t("missingLossReason") };
  if (reason.isFreeText && !lossReasonNote) return { error: t("missingLossReasonNote") };
  const result = await guarded(t, () => cancelEvent({ organizationId: access.organizationId, eventId, changedByUserId: access.userId, lossReasonId, lossReasonNote }));
  refresh(eventId);
  return result;
}

export async function reactivateEventAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const result = await guarded(t, () => reactivateEvent({ organizationId: access.organizationId, eventId, changedByUserId: access.userId }));
  refresh(eventId);
  return result;
}

// D4 : la nouvelle date, ou « date à définir » ; les échéances attendent la confirmation.
export async function postponeEventAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const undecided = formData.get("undecided") === "1";
  const newDate = undecided ? null : String(formData.get("newDate") ?? "").trim();
  if (newDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { error: t("postponeDateRequired") };
  const result = await guarded(t, () => postponeEvent({ organizationId: access.organizationId, eventId, changedByUserId: access.userId, newDate }));
  refresh(eventId);
  return result;
}

// D4, D7 : confirmer le report recalcule les échéances relatives ; le devis signé suit, sauf si la
// planner décoche « Décaler aussi les échéances du devis signé ».
export async function confirmPostponementAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const shiftQuote = formData.get("shiftQuote") === "1";
  let dates: { previousDate: string | null; eventDate: string } | null = null;
  const result = await guarded(t, async () => {
    dates = await confirmPostponement({ organizationId: access.organizationId, eventId, changedByUserId: access.userId });
  });
  const confirmed = dates as { previousDate: string | null; eventDate: string } | null;
  if (result.success && shiftQuote && confirmed?.previousDate) {
    await followEventDateInSignedQuotes({ organizationId: access.organizationId, eventId, userId: access.userId, fromDate: confirmed.previousDate, toDate: confirmed.eventDate });
  }
  refresh(eventId);
  return result;
}

// ARC-17, D9 : fuseau de l'évènement.
export async function setEventTimeZoneAction(_prevState: ChangeStatusFormState, formData: FormData): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  try {
    await setEventTimeZone(access.organizationId, eventId, String(formData.get("timeZone") ?? ""));
  } catch (error) {
    if (error instanceof RangeError) return { error: t("timeZoneInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}
