import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { parseEnv } from "@symbola/env";
import { requireSignedIn } from "@/lib/guards";
import { SignOutEverywhereForm } from "../sign-out-everywhere-form";
import { LanguageForm } from "./language-form";

export default async function ProfilePage() {
  const auth = await requireSignedIn();

  const t = await getTranslations("Profile");
  const tHelp = await getTranslations("Help");
  // Lot 33 (ADR 0067) : mot de passe, clés d'accès et double authentification dans le centre de
  // compte du fournisseur d'identité.
  const accountCenter = `${parseEnv(process.env).LOGTO_ENDPOINT.replace(/\/+$/, "")}/account/security`;

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("profile.title")} body={tHelp("profile.body")} />
      <LanguageForm currentLanguage={auth.user.language ?? "fr"} />
      <section aria-labelledby="profile-security-title">
        <h2 id="profile-security-title">{t("securityTitle")}</h2>
        <p>{t("securityBody")}</p>
        <p>
          <a href={accountCenter}>{t("securityLink")}</a>
        </p>
      </section>
      {/* Lot 24b (SEC-06) : déconnexion à distance. */}
      <SignOutEverywhereForm />
    </main>
  );
}
