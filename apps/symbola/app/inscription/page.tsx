// Lot 33 (HUB-01, HUB-02, PAR-01 étape 1) — inscription libre (décision Q5 a) : l'adresse e-mail
// suffit ; le lien reçu crée le compte, son organisation et son adhésion de Propriétaire, puis
// ouvre le démarrage.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkRequestForm } from "@/app/login/link-request-form";
import { ScreenHelp } from "@/app/screen-help";

export default async function SignupPage() {
  const t = await getTranslations("Signup");
  const tHelp = await getTranslations("Help");
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("signup.title")} body={tHelp("signup.body")} />
      <p>{t("intro")}</p>
      <LinkRequestForm namespace="Signup" />
      <p>
        {t("loginPrompt")} <Link href="/login">{t("loginLink")}</Link>
      </p>
    </main>
  );
}
