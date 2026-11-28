// Lot 74g (G1, G2) — « Mentions et logo des documents » : l'onglet « Mentions » de l'ancien « Entreprise
// et TVA », à sa propre adresse, formulaires inchangés (le patron du réglage vient au lot 74h). Les ancres
// « #informations-professionnel » et « #logo » restent celles que citent les devis.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { LogoForm } from "@/app/logo/logo-form";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails, isModuleEnabled } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ProfessionalMentionsForm } from "../professional-mentions-form";

export default async function CompanyMentionsPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const [profile, details, quotes] = await Promise.all([getOrganizationProfile(db, organizationId), getSellerDetails(db, organizationId), isModuleEnabled(db, organizationId, "quotes")]);
  const logoVersion = profile.logoKey?.split("/").pop() ?? null;

  return (
    <main>
      <h1>{tMenu("rubrics.companyMentions.label")}</h1>
      <ScreenHelp title={tHelp("companyMentions.title")} body={tHelp("companyMentions.body")} />
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
