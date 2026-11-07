import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("PasswordReset");
  const tHelp = await getTranslations("Help");
  return (
    <main>
      <h1>{t("forgotTitle")}</h1>
      <ScreenHelp title={tHelp("forgotPassword.title")} body={tHelp("forgotPassword.body")} />
      <p>{t("forgotIntro")}</p>
      <ForgotPasswordForm />
      <p>
        <a href="/login">{t("backToLogin")}</a>
      </p>
    </main>
  );
}
