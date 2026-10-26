"use server";

import { redirect } from "next/navigation";
import { login } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { setSessionCookie } from "@/lib/auth-context";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await login(db, email, password);
  } finally {
    await sql.end();
  }

  if (result.outcome === "invalid_credentials") {
    return { error: "Identifiants invalides." };
  }

  await setSessionCookie(result.sessionToken);
  redirect(result.requiresMfa ? "/mfa" : "/");
}
