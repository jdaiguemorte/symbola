import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ProfileForm } from "./profile-form";
import { VatRegimeForm } from "./vat-regime-form";

export default async function SettingsPage() {
  const auth = await requirePlanner();

  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const db = appDatabase();
  const profile = await getOrganizationProfile(db, auth.user.organizationId);

  return (
    <main>
      {/* Lot 16 (HUB-20) : le titre est la rubrique ouverte ; le menu des rubriques est la structure. */}
      <h1>{tMenu("company")}</h1>
      <ScreenHelp title={tHelp("settings.title")} body={tHelp("settings.body")} />
      <h2>{t("companyProfileTitle")}</h2>
      <ProfileForm profile={profile} />

      <h2>{t("vatRegimeTitle")}</h2>
      <VatRegimeForm currentRegime={profile.vatRegime} />
    </main>
  );
}
