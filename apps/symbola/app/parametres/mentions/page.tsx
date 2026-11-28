// Lot 74g (G1, G2) — « Mentions et logo des documents » : l'onglet « Mentions » de l'ancien « Entreprise
// et TVA », à sa propre adresse, formulaires inchangés (le patron du réglage vient au lot 74h). Les ancres
// « #informations-professionnel » et « #logo » restent celles que citent les devis.
// Lot 74h (D7, G8 ; page 30) : au patron d'un écran de réglage. L'en-tête commun ; le logo en ligne à part
// (il s'enregistre seul, dès qu'il est envoyé) ; les mentions en formulaire lié, avec sa barre en bas.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { LogoForm } from "@/app/logo/logo-form";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails, isModuleEnabled } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { SettingsHeader } from "@/app/ui/settings-header";
import { saveBarLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
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
  const tPattern = await getTranslations("SettingsPattern");
  const submitLabel = t("professionalMentionsSave");
  const [bar, scope] = await Promise.all([saveBarLabels(), settingsScopeLine({ scope: "agency", editors: "team", saving: "bar", isOwner: auth.user.role === "owner", submitLabel })]);
  const fieldLabels = Object.fromEntries(["insurer", "insurancePolicy", "insuranceCoverage", "mediatorName", "mediatorUrl", "generalTerms"].map((name) => [name, t(name)]));

  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.companyMentions.label")} hint={tPattern("headers.companyMentions")} scope={scope} />
      <ScreenHelp title={tHelp("companyMentions.title")} body={tHelp("companyMentions.body")} />
      {/* Lot 31a (JUR-09, D4) : assurance, médiateur et conditions générales, repris sur les devis. */}
      <section className="card" aria-labelledby="informations-professionnel">
        <h2 id="informations-professionnel">{t("professionalMentionsTitle")}</h2>
        <p className="field-hint">{t("professionalMentionsHint")}</p>
        <ProfessionalMentionsForm details={details} pattern={{ bar, fieldLabels }} />
      </section>
      {/* Lot 17 (DEV-07, DEV-08, décision A) : logo des documents, en ligne à part (il s'enregistre seul). */}
      <section className="card company-logo" aria-labelledby="logo">
        <h2 id="logo">{t("logoTitle")}</h2>
        <p className="field-hint">{tPattern("company.logoLine")}</p>
        <LogoForm version={logoVersion} secondary />
        {quotes ? (
          <p className="field-hint">
            {t("documentsSettingsHint")} <Link href="/devis/parametres/documents">{t("documentsSettingsLink")}</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
