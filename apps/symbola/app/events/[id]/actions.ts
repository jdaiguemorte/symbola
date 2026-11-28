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
  setEventType,
  type EventStatus,
} from "@/modules/events/service";
import { followEventDateInSignedQuotes } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent, taskListViewer } from "@/lib/event-visibility";
import { signContractAs } from "@/lib/events/contract-signed";
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

// Lot 34a (EVT-05, D2 à D7) — statuts : la frise pose Option, Confirmé (lot 72a : « En préparation »
// retiré), Clôturé ; l'annulation demande un motif ; le report demande la nouvelle date (ou « date à
// définir ») et se confirme après avoir vu les tâches qui tomberaient dans le passé.
const MANUAL: EventStatus[] = ["option", "confirmed", "closed"];

type Access = { organizationId: string; userId: string; role: string };

async function plannerAccess(t: Awaited<ReturnType<typeof getTranslations>>): Promise<Access | { error: string }> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };
  return { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.user.role };
}

// Lot 72d (SEC-12, SEC-13 ; lot 52) : un évènement qu'une Planner ne voit pas répond, pour chaque geste de
// l'en-tête et de la frise, comme un évènement inexistant (la page le faisait déjà, pas ses actions).
async function hidden(access: Access, eventId: string): Promise<boolean> {
  return access.role === "member" && !(await canSeeEvent({ user: { id: access.userId, role: access.role, organizationId: access.organizationId } }, eventId));
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
  if (await hidden(access, eventId)) return { error: t("eventNotFound") };
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
  if (await hidden(access, eventId)) return { error: t("eventNotFound") };
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
  if (await hidden(access, eventId)) return { error: t("eventNotFound") };
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
  if (await hidden(access, eventId)) return { error: t("eventNotFound") };
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
  if (await hidden(access, eventId)) return { error: t("eventNotFound") };
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

// Lot 72d (EVT-05 ; E2, J2) — « Le contrat est signé… » : une demande passe à « Signé, en préparation » à la
// date choisie (aujourd'hui ou avant, au plus un an avant la création), sans créer de tâche.
export type ContractSignedState = { error?: string; field?: "signedOn"; success?: boolean; signedOn?: string; at?: number };

export async function markContractSignedAction(_prevState: ContractSignedState, formData: FormData): Promise<ContractSignedState> {
  const t = await getTranslations("Events");
  const tTimeline = await getTranslations("EventHeader.timeline");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const signedOn = String(formData.get("signedOn") ?? "").trim();
  const viewer = { ...(await taskListViewer({ user: { id: access.userId, role: access.role, organizationId: access.organizationId } })), organizationId: access.organizationId };
  const outcome = await signContractAs(viewer, { eventId, signedOn });
  if (!outcome.ok) {
    if (outcome.reason === "not_found" || outcome.reason === "unauthenticated") return { error: t("eventNotFound") };
    if (outcome.reason === "transition") return { error: t("statusTransitionRefused") };
    const key = outcome.reason === "future" ? "signedOnFuture" : outcome.reason === "too_early" ? "signedOnTooEarly" : "signedOnInvalid";
    return { error: tTimeline(key), field: "signedOn" };
  }
  refresh(eventId);
  return { success: true, signedOn, at: Date.now() };
}

// Lot 72d (EVT-02) — « Changer le type… » : la fenêtre courte du menu « ⋯ » (même règle qu'avant).
export type EventTypeState = { error?: string; success?: boolean; at?: number };

export async function changeEventTypeAction(_prevState: EventTypeState, formData: FormData): Promise<EventTypeState> {
  const t = await getTranslations("Events");
  const tHeader = await getTranslations("EventHeader");
  const access = await plannerAccess(t);
  if ("error" in access) return access;
  const eventId = String(formData.get("eventId") ?? "");
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (!isValidId(eventId) || (await hidden(access, eventId))) return { error: t("eventNotFound") };
  if (!isValidId(eventTypeId)) return { error: tHeader("typeRefused") };
  try {
    await setEventType(access.organizationId, eventId, eventTypeId);
  } catch (error) {
    if (error instanceof EventTypeNotFoundError) return { error: tHeader("typeRefused") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  refresh(eventId);
  return { success: true, at: Date.now() };
}
