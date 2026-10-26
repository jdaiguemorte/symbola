"use server";

import { redirect } from "next/navigation";
import { confirmTotp, requireUser, setupTotp } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getSessionToken } from "@/lib/auth-context";

export async function getMfaSetupState() {
  const token = await getSessionToken();
  const { sql, db } = createAppConnection();
  try {
    const result = await requireUser(db, token);
    if (result.status !== "mfa_required") return null;

    if (!result.hasTotpSecret) {
      const { provisioningUri } = await setupTotp(db, result.userId);
      return { provisioningUri };
    }

    return { provisioningUri: null };
  } finally {
    await sql.end();
  }
}

export type MfaFormState = { error?: string };

export async function confirmMfaAction(
  _prevState: MfaFormState,
  formData: FormData,
): Promise<MfaFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const code = String(formData.get("code") ?? "");
  const { sql, db } = createAppConnection();
  let confirmed: boolean;
  try {
    confirmed = await confirmTotp(db, { sessionToken: token, token: code });
  } finally {
    await sql.end();
  }

  if (!confirmed) return { error: "Code invalide." };

  redirect("/");
}
