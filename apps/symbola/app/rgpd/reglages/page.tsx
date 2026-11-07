import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { getPrivacySettings, type PrivacySettings } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { PrivacySettingsForm } from "./settings-form";

// RGPD-04/05 — réglages RGPD de l'organisation : seuil d'alerte des demandes
// et durées de conservation (modèle de départ du cahier des charges, à faire
// valider par un juriste).
export default async function PrivacySettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const { sql, db } = createAppConnection();
  let settings: PrivacySettings;
  try {
    settings = await getPrivacySettings(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }
  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <ScreenHelp title={tHelp("privacySettings.title")} body={tHelp("privacySettings.body")} />
      <p>{t("settingsIntro")}</p>
      <PrivacySettingsForm settings={settings} />
      <p>
        <Link href="/rgpd/demandes">{t("requestsLink")}</Link>
      </p>
    </main>
  );
}
