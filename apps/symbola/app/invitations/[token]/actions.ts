"use server";

import { createAppConnection } from "@symbola/db/client";
import { acceptInvitation } from "@/modules/hub/service";

export type AcceptInvitationFormState = { error?: string; success?: boolean };

export async function acceptInvitationAction(
  _prevState: AcceptInvitationFormState,
  formData: FormData,
): Promise<AcceptInvitationFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { error: "Le mot de passe est obligatoire." };
  }

  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await acceptInvitation(db, { token, password });
  } finally {
    await sql.end();
  }

  if (result.outcome === "invalid_or_expired") {
    return { error: "Ce lien d'invitation est invalide ou a expiré." };
  }
  if (result.outcome === "already_accepted") {
    return { error: "Cette invitation a déjà été utilisée." };
  }

  return { success: true };
}
