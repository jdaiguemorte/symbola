"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { changeEventStatus, listLossReasons, type EventStatus } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";

export type ChangeStatusFormState = { error?: string };

const VALID_STATUSES: EventStatus[] = ["prospect", "quote_sent", "confirmed", "done", "lost"];

export async function changeEventStatusAction(
  _prevState: ChangeStatusFormState,
  formData: FormData,
): Promise<ChangeStatusFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: "unauthenticated" };
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Events");

  const eventId = String(formData.get("eventId") ?? "");
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
  return {};
}
