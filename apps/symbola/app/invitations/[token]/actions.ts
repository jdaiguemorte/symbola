"use server";

import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { acceptInvitation } from "@/modules/hub/service";

export type AcceptInvitationFormState = { error?: string; success?: boolean };

export async function acceptInvitationAction(
  _prevState: AcceptInvitationFormState,
  formData: FormData,
): Promise<AcceptInvitationFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const t = await getTranslations("Invitation");

  if (!password) {
    return { error: t("missingPassword") };
  }

  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await acceptInvitation(db, { token, password });
  } finally {
    await sql.end();
  }

  if (result.outcome === "invalid_or_expired") {
    return { error: t("invalidOrExpired") };
  }
  if (result.outcome === "already_accepted") {
    return { error: t("alreadyAccepted") };
  }

  return { success: true };
}
