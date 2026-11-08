"use server";

// Lot 9 (ADR 0029) — mot de passe oublié : la réponse est toujours la même,
// que l'adresse ait un compte ou non, pour ne pas révéler les comptes.
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requestPasswordReset } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { sendMail } from "@symbola/mail";

export type ForgotPasswordFormState = { sent?: boolean; error?: string };

const emailSchema = z.email();

export async function forgotPasswordAction(_prevState: ForgotPasswordFormState, formData: FormData): Promise<ForgotPasswordFormState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    const t = await getTranslations("PasswordReset");
    return { error: t("invalidEmail") };
  }

  const db = appDatabase();
  const request = await requestPasswordReset(db, parsed.data);

  if (request) {
    const locale = request.language ?? ((await getLocale()) === "en" ? "en" : "fr");
    const t = await getTranslations({ locale, namespace: "PasswordReset" });
    const link = `${parseEnv(process.env).APP_PUBLIC_URL}/mot-de-passe/${request.token}`;
    try {
      await sendMail({ to: request.email, subject: t("mailSubject"), text: t("mailBody", { link }) });
    } catch (error) {
      // Journal sans donnée personnelle : la réponse reste identique.
      console.error("mot de passe oublié : envoi de l'e-mail impossible", error instanceof Error ? error.name : "erreur");
    }
  }
  return { sent: true };
}
