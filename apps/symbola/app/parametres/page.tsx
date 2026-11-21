import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { LogoForm } from "@/app/logo/logo-form";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails, isModuleEnabled } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { CompanySheetForm } from "./company-sheet-form";
import { ProfessionalMentionsForm } from "./professional-mentions-form";
import { VatRegimeForm } from "./vat-regime-form";
import { VatOnDebitsForm } from "./vat-on-debits-form";

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
      {/* Lot 62b (UX-12) : identité, adresse et coordonnées imprimées, un seul « Enregistrer la fiche ». */}
      <div id="profil-entreprise">
        <CompanySheetForm profile={profile} details={details} />
      </div>

      {/* Lot 62b : la TVA dans sa carte, en formulaires en ligne. Lot 41 (JUR-02, D10) : option pour la
          TVA sur les débits, datée (assujetti seulement). */}
      <section className="card" aria-labelledby="tva">
        <h2 id="tva">{t("vatCardTitle")}</h2>
        <p>
          {t("currentRegime")} :{" "}
          <strong>{profile.vatRegime === "franchise" ? t("vatRegimeFranchise") : profile.vatRegime === "assujetti" ? t("vatRegimeAssujetti") : t("vatRegimeUnset")}</strong>
        </p>
        <VatRegimeForm currentRegime={profile.vatRegime} />
        <h3 id="tva-debits">{t("vatOnDebitsTitle")}</h3>
        <p className="field-hint">{t("vatOnDebitsHint")}</p>
        {profile.vatRegime === "assujetti" ? <VatOnDebitsForm value={profile.vatOnDebits} from={profile.vatOnDebitsFrom} /> : <p>{t("vatOnDebitsFranchise")}</p>}
      </section>

      {/* Lot 31a (JUR-09, D4) : assurance, médiateur et conditions générales, repris sur les devis. */}
      <section className="card" aria-labelledby="informations-professionnel">
        <h2 id="informations-professionnel">{t("professionalMentionsTitle")}</h2>
        <p className="field-hint">{t("professionalMentionsHint")}</p>
        <ProfessionalMentionsForm details={details} />
      </section>

      {/* Lot 17 (DEV-07, DEV-08, décision A) : logo des documents. */}
      <section className="card company-logo" aria-labelledby="logo">
        <h2 id="logo">{t("logoTitle")}</h2>
        <LogoForm version={logoVersion} />
        {quotes ? (
          <p className="field-hint">
            {t("documentsSettingsHint")} <Link href="/devis/parametres/documents">{t("documentsSettingsLink")}</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
