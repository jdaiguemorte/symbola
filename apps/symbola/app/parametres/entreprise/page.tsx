// Lot 74g (G1, G2) — « Fiche de l'entreprise » : l'onglet « Fiche » de l'ancien « Entreprise et TVA »,
// à sa propre adresse, formulaires inchangés (le patron du réglage vient au lot 74h). Les ancres
// « #profil-entreprise », « #coordonnees-documents », « #tva » et « #tva-debits » restent celles que
// citent les devis quand une mention manque.
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { CompanySheetForm } from "../company-sheet-form";
import { VatRegimeForm } from "../vat-regime-form";
import { VatOnDebitsForm } from "../vat-on-debits-form";

export default async function CompanySheetPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const [profile, details] = await Promise.all([getOrganizationProfile(db, organizationId), getSellerDetails(db, organizationId)]);

  return (
    <main>
      <h1>{tMenu("rubrics.companySheet.label")}</h1>
      <ScreenHelp title={tHelp("settings.title")} body={tHelp("settings.body")} />
      <div id="profil-entreprise">
        <CompanySheetForm profile={profile} details={details} />
      </div>
      {/* La TVA dans sa carte, en formulaires en ligne. Lot 41 (JUR-02, D10) : option pour la TVA sur les
          débits, datée (assujetti seulement). */}
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
    </main>
  );
}
