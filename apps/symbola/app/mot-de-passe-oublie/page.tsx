import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("PasswordReset");
  const tHelp = await getTranslations("Help");
  return (
    <main>
      <h1>{t("forgotTitle")}</h1>
      <HelpButton title={tHelp("forgotPassword.title")} body={tHelp("forgotPassword.body")} />
      <p>{t("forgotIntro")}</p>
      <ForgotPasswordForm />
      <p>
        <a href="/login">{t("backToLogin")}</a>
      </p>
    </main>
  );
}
