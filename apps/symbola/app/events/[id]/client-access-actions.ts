"use server";

// EVT-06 — invitation et retrait des accès des mariés, depuis la fiche.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ClientAlreadyInvitedError,
  ClientEmailUnavailableError,
  EventNotFoundError,
  inviteEventClient,
  revokeEventClientAccess,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ClientAccessFormState = { error?: string; success?: boolean; linked?: boolean };

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { userId: auth.user.id, organizationId: auth.user.organizationId } as const;
}

export async function inviteClientAction(_prevState: ClientAccessFormState, formData: FormData): Promise<ClientAccessFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };

  try {
    const result = await inviteEventClient({
      organizationId: access.organizationId,
      eventId,
      email: String(formData.get("email") ?? ""),
      invitedByUserId: access.userId,
      locale: (await getLocale()) === "en" ? "en" : "fr",
    });
    revalidatePath(`/events/${eventId}`);
    return { success: true, linked: result.invitationToken === null };
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof ClientEmailUnavailableError) return { error: t("clientEmailUnavailable") };
    if (error instanceof ClientAlreadyInvitedError) return { error: t("clientAlreadyInvited") };
    if (error instanceof RangeError) return { error: t("invalidEmail") };
    throw error;
  }
}

export async function revokeClientAccessAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const accessId = String(formData.get("accessId") ?? "");
  if (!isValidId(eventId) || !isValidId(accessId)) return;
  await revokeEventClientAccess(access.organizationId, accessId);
  revalidatePath(`/events/${eventId}`);
}
