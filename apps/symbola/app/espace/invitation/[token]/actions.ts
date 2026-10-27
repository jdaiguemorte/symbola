"use server";

// EVT-06 — création du compte d'un marié depuis le lien d'invitation.
import { getTranslations } from "next-intl/server";
import {
  acceptEventClientInvitation,
  ClientEmailUnavailableError,
  ClientPasswordTooShortError,
} from "@/modules/events/service";

export type ClientInvitationFormState = { error?: string; success?: boolean };

export async function acceptClientInvitationAction(
  _prevState: ClientInvitationFormState,
  formData: FormData,
): Promise<ClientInvitationFormState> {
  const t = await getTranslations("ClientSpace");
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("passwordConfirmation") ?? "")) return { error: t("passwordMismatch") };

  try {
    const result = await acceptEventClientInvitation(token, password);
    if (result.outcome === "invalid_or_expired") return { error: t("invitationInvalid") };
    if (result.outcome === "already_accepted") return { error: t("invitationAlreadyAccepted") };
    return { success: true };
  } catch (error) {
    if (error instanceof ClientPasswordTooShortError) return { error: t("passwordTooShort") };
    if (error instanceof ClientEmailUnavailableError) return { error: t("invitationInvalid") };
    throw error;
  }
}
