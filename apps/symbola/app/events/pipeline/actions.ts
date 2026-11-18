"use server";

// Lot 44 (CRM-02 ; D9 ; ADR 0084) — déplacer une carte du pipeline, la gagner ou la perdre, traiter
// une demande « à vérifier ». Contrôlé côté serveur à chaque appel : session, organisation, module
// Évènements ouvert ; l'évènement et l'étape doivent être de l'organisation (RLS). Un membre de
// l'équipe déplace les cartes comme il modifie un évènement.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  acceptProspectRequest,
  discardProspectRequest,
  EventNotFoundError,
  EventStatusTransitionError,
  LossReasonRequiredError,
  losePipelineCard,
  movePipelineCard,
  PipelineMoveRefusedError,
  ProspectRequestNotFoundError,
  winPipelineCard,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

type Access = { organizationId: string; userId: string };

async function plannerAccess(): Promise<Access | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

function refresh(eventId?: string): void {
  revalidatePath("/events/pipeline");
  revalidatePath("/events");
  revalidatePath("/");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

export async function moveCardAction(eventId: string, stageId: string): Promise<boolean> {
  const access = await plannerAccess();
  if (!access || !isValidId(eventId) || !isValidId(stageId)) return false;
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    await movePipelineCard({ organizationId: access.organizationId, eventId, stageId, userId: access.userId, locale });
  } catch (error) {
    if (error instanceof PipelineMoveRefusedError) return false;
    throw error;
  }
  refresh(eventId);
  return true;
}

export type ExitResult = { ok: true } | { ok: false; error: string };

export async function winCardAction(eventId: string): Promise<ExitResult> {
  const t = await getTranslations("Pipeline");
  const access = await plannerAccess();
  if (!access || !isValidId(eventId)) return { ok: false, error: t("refused") };
  try {
    await winPipelineCard({ organizationId: access.organizationId, eventId, userId: access.userId });
  } catch (error) {
    if (error instanceof EventNotFoundError || error instanceof EventStatusTransitionError) return { ok: false, error: t("refused") };
    throw error;
  }
  refresh(eventId);
  return { ok: true };
}

export async function loseCardAction(eventId: string, lossReasonId: string, lossReasonNote: string): Promise<ExitResult> {
  const t = await getTranslations("Pipeline");
  const access = await plannerAccess();
  if (!access || !isValidId(eventId)) return { ok: false, error: t("refused") };
  try {
    await losePipelineCard({ organizationId: access.organizationId, eventId, userId: access.userId, lossReasonId: isValidId(lossReasonId) ? lossReasonId : null, lossReasonNote: lossReasonNote.slice(0, 1000) });
  } catch (error) {
    if (error instanceof LossReasonRequiredError) return { ok: false, error: t(error.field === "reason" ? "lossReasonRequired" : "lossNoteRequired") };
    if (error instanceof EventNotFoundError || error instanceof EventStatusTransitionError) return { ok: false, error: t("refused") };
    throw error;
  }
  refresh(eventId);
  return { ok: true };
}

// Demandes « à vérifier » (D4) : accepter crée le prospect, effacer la supprime.
export async function acceptRequestAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const requestId = String(formData.get("requestId") ?? "");
  if (!access || !isValidId(requestId)) return;
  try {
    await acceptProspectRequest(access.organizationId, requestId);
  } catch (error) {
    if (!(error instanceof ProspectRequestNotFoundError)) throw error;
  }
  refresh();
}

export async function discardRequestAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const requestId = String(formData.get("requestId") ?? "");
  if (!access || !isValidId(requestId)) return;
  try {
    await discardProspectRequest(access.organizationId, requestId);
  } catch (error) {
    if (!(error instanceof ProspectRequestNotFoundError)) throw error;
  }
  refresh();
}
