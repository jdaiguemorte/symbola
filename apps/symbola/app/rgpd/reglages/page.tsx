import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { getLinkPrivacyNotice, getPrivacySettings, linkPrivacyNoticeTemplate, type PrivacySettings } from "@/modules/hub/service";
import { requireOwner } from "@/lib/guards";
import { LinkNoticeForm, PrivacySettingsForm } from "./settings-form";
import { PrivacyTabs } from "../privacy-tabs";

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
  const notice = await getLinkPrivacyNotice(db, auth.user.organizationId);
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <ScreenHelp title={tHelp("privacySettings.title")} body={tHelp("privacySettings.body")} />
      {/* Lot 18 (RGPD-07, décision A) : onglets de Données personnelles. */}
      <PrivacyTabs />
      <p>{t("settingsIntro")}</p>
      <PrivacySettingsForm settings={settings} />
      {/* Lot 26a (RGP-03) : mention d'information des pages à lien personnel. */}
      <LinkNoticeForm text={notice ?? linkPrivacyNoticeTemplate(locale)} custom={notice !== null} />
    </main>
  );
}
