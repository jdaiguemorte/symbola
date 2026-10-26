"use server";

import { cookies } from "next/headers";
import { createAppConnection } from "@symbola/db/client";
import { setUserLanguage } from "@symbola/auth";
import { getAuthContext } from "@/lib/auth-context";
import { LOCALE_COOKIE } from "../../middleware";

export type ProfileFormState = { success?: boolean };

export async function setLanguageAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return {};

  const language = formData.get("language") === "en" ? "en" : "fr";

  const { sql, db } = createAppConnection();
  try {
    await setUserLanguage(db, auth.user.id, language);
  } finally {
    await sql.end();
  }

  (await cookies()).set(LOCALE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  return { success: true };
}
