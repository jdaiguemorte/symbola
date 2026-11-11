import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { LogoForm } from "@/app/logo/logo-form";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails, isModuleEnabled } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { DocumentDetailsForm } from "./document-details-form";
import { ProfileForm } from "./profile-form";
import { VatRegimeForm } from "./vat-regime-form";

export default async function SettingsPage() {
  const auth = await requirePlanner();

  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const [profile, details, quotes] = await Promise.all([
    getOrganizationProfile(db, organizationId),
    getSellerDetails(db, organizationId),
    isModuleEnabled(db, organizationId, "quotes"),
  ]);
  const logoVersion = profile.logoKey?.split("/").pop() ?? null;

  return (
    <main>
      {/* Lot 16 (L16-HUB-20) : le titre est la rubrique ouverte ; le menu des rubriques est la structure. */}
      <h1>{tMenu("company")}</h1>
      <ScreenHelp title={tHelp("settings.title")} body={tHelp("settings.body")} />
      <h2>{t("companyProfileTitle")}</h2>
      <ProfileForm profile={profile} />

      <h2>{t("vatRegimeTitle")}</h2>
      <VatRegimeForm currentRegime={profile.vatRegime} />

      {/* Lot 17 (DEV-07, DEV-08, décision A) : coordonnées et logo des documents. */}
      <h2>{t("documentDetailsTitle")}</h2>
      <p className="meta">{t("documentDetailsHint")}</p>
      <DocumentDetailsForm details={details} />

      <h2>{t("logoTitle")}</h2>
      <LogoForm version={logoVersion} />
      {quotes ? (
        <p>
          {t("documentsSettingsHint")} <Link href="/devis/parametres/documents">{t("documentsSettingsLink")}</Link>
        </p>
      ) : null}
    </main>
  );
}
