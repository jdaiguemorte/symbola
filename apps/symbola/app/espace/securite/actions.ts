"use server";

// EVT-06 — double authentification proposée au marié, jamais imposée.
import { getTranslations } from "next-intl/server";
import { confirmTotp, setupTotp } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getClientAuthContext, getSessionToken } from "@/lib/auth-context";

export type ClientMfaFormState = { provisioningUri?: string; error?: string; enabled?: boolean };

export async function startClientMfaAction(_prevState: ClientMfaFormState, _formData: FormData): Promise<ClientMfaFormState> {
  const t = await getTranslations("ClientSpace");
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated") return { error: t("unauthenticated") };
  if (auth.user.mfaEnabled) return { enabled: true };
  const { sql, db } = createAppConnection();
  try {
    const { provisioningUri } = await setupTotp(db, auth.user.id);
    return { provisioningUri };
  } finally {
    await sql.end();
  }
}

export async function confirmClientMfaAction(prevState: ClientMfaFormState, formData: FormData): Promise<ClientMfaFormState> {
  const t = await getTranslations("ClientSpace");
  const auth = await getClientAuthContext();
  const sessionToken = await getSessionToken();
  if (auth.status !== "authenticated" || !sessionToken) return { error: t("unauthenticated") };
  const { sql, db } = createAppConnection();
  try {
    const confirmed = await confirmTotp(db, { sessionToken, token: String(formData.get("code") ?? "") });
    return confirmed ? { enabled: true } : { ...prevState, error: t("mfaInvalidCode") };
  } finally {
    await sql.end();
  }
}
