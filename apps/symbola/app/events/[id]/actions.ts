"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { changeEventStatus, listLossReasons, type EventStatus } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ChangeStatusFormState = { error?: string; success?: boolean };

const VALID_STATUSES: EventStatus[] = ["prospect", "quote_sent", "confirmed", "done", "lost"];

export async function changeEventStatusAction(
  _prevState: ChangeStatusFormState,
  formData: FormData,
): Promise<ChangeStatusFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };

  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const toStatus = String(formData.get("toStatus") ?? "");
  if (!VALID_STATUSES.includes(toStatus as EventStatus)) return { error: t("invalidStatus") };

  const lossReasonId = String(formData.get("lossReasonId") ?? "").trim() || null;
  const lossReasonNote = String(formData.get("lossReasonNote") ?? "").trim() || null;

  if (toStatus === "lost") {
    if (!lossReasonId) return { error: t("missingLossReason") };
    const reasons = await listLossReasons(organizationId);
    const reason = reasons.find((candidate) => candidate.id === lossReasonId);
    if (!reason) return { error: t("missingLossReason") };
    if (reason.isFreeText && !lossReasonNote) return { error: t("missingLossReasonNote") };
  }

  await changeEventStatus({
    organizationId,
    eventId,
    changedByUserId: auth.user.id,
    toStatus: toStatus as EventStatus,
    lossReasonId: toStatus === "lost" ? lossReasonId : null,
    lossReasonNote: toStatus === "lost" ? lossReasonNote : null,
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return { success: true };
}
