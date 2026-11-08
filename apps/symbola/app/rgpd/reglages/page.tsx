import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { getPrivacySettings, type PrivacySettings } from "@/modules/hub/service";
import { requireOwner } from "@/lib/guards";
import { PrivacySettingsForm } from "./settings-form";

// RGPD-04/05 — réglages RGPD de l'organisation : seuil d'alerte des demandes
// et durées de conservation (modèle de départ du cahier des charges, à faire
// valider par un juriste).
export default async function PrivacySettingsPage() {
  const auth = await requireOwner();
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const db = appDatabase();
  const settings: PrivacySettings = await getPrivacySettings(db, auth.user.organizationId);
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
