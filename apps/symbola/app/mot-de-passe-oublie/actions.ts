"use server";

// Lot 9 (ADR 0029) — mot de passe oublié : la réponse est toujours la même,
// que l'adresse ait un compte ou non, pour ne pas révéler les comptes.
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requestPasswordReset } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { sendMail } from "@symbola/mail";
import { checkFailures, checkRateLimit, longestWait, rateLimitMessage, recordFailure } from "@/lib/rate-limit";

export type ForgotPasswordFormState = { sent?: boolean; error?: string };

const emailSchema = z.email();

export async function forgotPasswordAction(_prevState: ForgotPasswordFormState, formData: FormData): Promise<ForgotPasswordFormState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    const t = await getTranslations("PasswordReset");
    return { error: t("invalidEmail") };
  }

  // L16-SEC-02 (ADR 0044) : un formulaire public qui envoie des e-mails, limité par
  // adresse et par compte visé (en plus d'un e-mail par compte toutes les 5 minutes).
  // Lot 24b (SEC-04) : chaque demande refusée compte ; après dix, un délai qui
  // double à chaque fois. Le message donne le plus long des deux délais.
  const backoff = await checkFailures("passwordReset", { account: parsed.data });
  const limited = await checkRateLimit("passwordReset", { account: parsed.data });
  const wait = longestWait(backoff, limited);
  if (wait !== null) {
    await recordFailure("passwordReset", { account: parsed.data });
    return { error: await rateLimitMessage(wait) };
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
