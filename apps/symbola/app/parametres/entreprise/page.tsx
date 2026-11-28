// Lot 74g (G1, G2) — « Fiche de l'entreprise » : l'onglet « Fiche » de l'ancien « Entreprise et TVA »,
// à sa propre adresse. Les ancres « #profil-entreprise », « #coordonnees-documents », « #tva » et
// « #tva-debits » restent celles que citent les devis quand une mention manque.
// Lot 74h (D7, G8, G15 ; page 30) : au patron d'un écran de réglage. L'en-tête commun ; vide, la fiche dit en
// tête ce qui manque avant le premier devis ; formulaire à champs liés (identité, adresse et coordonnées,
// activité avec « Mariages par an ») et sa barre d'enregistrement ; la TVA en ligne à part, datée, avec sa
// fenêtre (régime et TVA sur les débits). Toute l'équipe la change, comme avant (requirePlanner).
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { starterOnboarding } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { EditDialog } from "@/app/ui/edit-dialog";
import { SettingsHeader } from "@/app/ui/settings-header";
import { saveBarLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
import { CompanySheetForm } from "../company-sheet-form";
import { VatRegimeForm } from "../vat-regime-form";
import { VatOnDebitsForm } from "../vat-on-debits-form";

// Les champs que la barre nomme quand ils changent, dans l'ordre de la fiche.
const SHEET_FIELDS = ["legalForm", "siren", "siret", "vatNumber", "registration", "shareCapital", "address", "postalCode", "city", "countryCode", "contactEmail", "contactPhone", "website", "metier", "metierPrecision"] as const;

export default async function CompanySheetPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const tPattern = await getTranslations("SettingsPattern");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const format = await getFormatter();
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const [profile, details, bar] = await Promise.all([getOrganizationProfile(db, organizationId), getSellerDetails(db, organizationId), saveBarLabels()]);
  const submitLabel = t("sheetSave");
  const scope = await settingsScopeLine({ scope: "agency", editors: "team", saving: "bar", isOwner: auth.user.role === "owner", submitLabel });
  const fieldLabels: Record<string, string> = Object.fromEntries(SHEET_FIELDS.map((name) => [name, t(name)]));
  fieldLabels.annualEventVolume = tPattern("company.annualVolume");

  // Vide : ce qui manque avant le premier devis (l'adresse et le SIRET, imprimés sur chaque document).
  const missing = [
    !profile.address?.trim() || !profile.postalCode?.trim() || !profile.city?.trim() ? t("address") : null,
    !details.siret?.trim() ? t("siret") : null,
  ].filter((label): label is string => label !== null);
  const notice = missing.length > 0 ? <p className="notice" role="note">{tPattern("company.missing", { fields: missing.join(", ") })}</p> : undefined;

  const regime = profile.vatRegime === "franchise" ? t("vatRegimeFranchise") : profile.vatRegime === "assujetti" ? t("vatRegimeAssujetti") : t("vatRegimeUnset");
  const vatOnDebits =
    profile.vatRegime === "assujetti" && profile.vatOnDebits === true
      ? ` · ${t("vatOnDebitsTitle")}${profile.vatOnDebitsFrom ? ` (${format.dateTime(new Date(`${profile.vatOnDebitsFrom}T12:00:00Z`), { dateStyle: "long", timeZone: "Europe/Paris" })})` : ""}`
      : "";

  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.companySheet.label")} hint={tPattern("headers.companySheet")} scope={scope} notice={notice} />
      <ScreenHelp title={tHelp("settings.title")} body={tHelp("settings.body")} />
      {/* La TVA en ligne à part : elle se date, et se change dans sa fenêtre. Lot 41 (JUR-02, D10) : option
          pour la TVA sur les débits, datée (assujetti seulement). */}
      <section className="card" aria-labelledby="tva">
        <div className="setting-line">
          <div className="setting-line-text">
            <h2 id="tva">{t("vatCardTitle")}</h2>
            <p>{tPattern("company.vatLine", { regime: `${t("currentRegime")} : ${regime}${vatOnDebits}` })}</p>
          </div>
          <div className="setting-line-control">
            <EditDialog title={tPattern("company.vatDialog")} trigger={{ label: tPattern("company.vatChange") }}>
              <VatRegimeForm currentRegime={profile.vatRegime} />
              <h3 id="tva-debits">{t("vatOnDebitsTitle")}</h3>
              <p className="field-hint">{t("vatOnDebitsHint")}</p>
              {profile.vatRegime === "assujetti" ? <VatOnDebitsForm value={profile.vatOnDebits} from={profile.vatOnDebitsFrom} /> : <p>{t("vatOnDebitsFranchise")}</p>}
            </EditDialog>
          </div>
        </div>
      </section>
      <div id="profil-entreprise">
        <CompanySheetForm
          profile={profile}
          details={details}
          pattern={{
            bar,
            fieldLabels,
            activityTitle: tPattern("company.activityTitle"),
            activityHint: tPattern("company.activityHint"),
            annualVolume: tPattern("company.annualVolume"),
            annualVolumeUnset: tPattern("company.annualVolumeUnset"),
            volumes: starterOnboarding(locale).volumes,
          }}
        />
      </div>
    </main>
  );
}
