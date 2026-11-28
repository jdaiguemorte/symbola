"use client";

// Lot 62b (UX-12) — la fiche de l'entreprise : trois cartes (identité, adresse, coordonnées
// imprimées sur les devis et factures) en grille, et un seul « Enregistrer la fiche ». Elle réunit
// la fiche de départ (ONB-01), l'adresse structurée (FAC-10, D7) et les coordonnées des documents
// (lot 17, DEV-07), qui avaient chacune leur formulaire et leur bouton.
// Lot 74h (D7, G8, G15 ; page 30) : formulaire à champs liés, enregistré par « Enregistrer la fiche » dans
// la barre collée en bas (SettingsSaveBar), qui nomme les champs modifiés ; l'adresse et les coordonnées
// dans un même bloc ; « Activité » (métier, mariages par an) en troisième bloc.
import { useActionState, useId } from "react";
import { SettingsSaveBar } from "@/app/ui/settings-save-bar";
import type { SaveBarLabels } from "@/lib/settings/settings-header-texts";
import { useLocale, useTranslations } from "next-intl";
import { formatAmountInput, type Locale } from "@symbola/i18n";
import type { OrganizationProfile, SellerDetails } from "@/modules/hub/service";
import { saveCompanySheetAction, type CompanySheetFormState } from "./actions";

const LEGAL_FORMS = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"] as const;

// Les mots venus du serveur (espace « SettingsPattern », NFR-02) : la barre, le bloc « Activité », et le nom
// de chaque champ que la barre cite.
export type CompanySheetPattern = {
  bar: SaveBarLabels;
  fieldLabels: Record<string, string>;
  activityTitle: string;
  activityHint: string;
  annualVolume: string;
  annualVolumeUnset: string;
  volumes: { key: string; label: string }[];
};

export function CompanySheetForm({ profile, details, pattern }: { profile: OrganizationProfile; details: SellerDetails; pattern: CompanySheetPattern }) {
  const t = useTranslations("Settings");
  const locale = useLocale() as Locale;
  const [state, formAction, pending] = useActionState<CompanySheetFormState, FormData>(saveCompanySheetAction, {});
  // Une fiche refusée garde ce qui a été saisi : React remet les champs à leur valeur de départ après
  // l'envoi, et la valeur de départ devient alors la saisie rendue par l'action.
  const kept = (name: string, stored: string) => state.values?.[name] ?? stored;
  const ids = { identity: useId(), address: useId(), contact: useId(), registration: useId(), capital: useId(), country: useId(), activity: useId() };

  return (
    <form action={formAction} aria-label={t("companyProfileTitle")} className="settings-sheet">
      <section className="card" id="coordonnees-documents" aria-labelledby={ids.identity}>
        <h2 id={ids.identity}>{t("sheetIdentityTitle")}</h2>
        <div className="form-grid form-grid-3">
          <label>
            {t("legalForm")}
            <select name="legalForm" defaultValue={kept("legalForm", profile.legalForm ?? "")}>
              <option value="">{t("legalFormUnset")}</option>
              {LEGAL_FORMS.map((form) => (
                <option key={form} value={form}>
                  {t(`legalForm_${form}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("siren")}
            <input type="text" name="siren" inputMode="numeric" autoComplete="off" defaultValue={kept("siren", profile.siren ?? "")} />
          </label>
          <label>
            {t("siret")}
            <input type="text" name="siret" inputMode="numeric" autoComplete="off" defaultValue={kept("siret", details.siret ?? "")} />
          </label>
          <label>
            {t("vatNumber")}
            <input type="text" name="vatNumber" autoComplete="off" defaultValue={kept("vatNumber", details.vatNumber ?? "")} />
          </label>
          <div className="field-group">
            <label>
              {t("registration")}
              <input type="text" name="registration" maxLength={120} aria-describedby={ids.registration} defaultValue={kept("registration", details.registration ?? "")} />
            </label>
            <p id={ids.registration} className="field-hint">
              {t("registrationHint")}
            </p>
          </div>
          <div className="field-group">
            <label>
              {t("shareCapital")}
              <input type="text" name="shareCapital" inputMode="decimal" aria-describedby={ids.capital} defaultValue={kept("shareCapital", formatAmountInput(details.shareCapitalCents, locale))} />
            </label>
            <p id={ids.capital} className="field-hint">
              {t("shareCapitalHint")}
            </p>
          </div>
        </div>
      </section>

      {/* Lot 74h (C-75) : l'adresse et les coordonnées dans un même bloc, comme sur l'en-tête des documents.
          Lot 41 (FAC-10, D7) : adresse structurée, exigée par la facture électronique. */}
      <section className="card" aria-labelledby={ids.address}>
        <h2 id={ids.address}>{t("sheetAddressTitle")}</h2>
        <p className="field-hint" id={ids.contact}>
          {t("documentDetailsHint")}
        </p>
        <div className="form-grid">
          <label className="span-all">
            {t("address")}
            <input type="text" name="address" autoComplete="address-line1" defaultValue={kept("address", profile.address ?? "")} />
          </label>
          <div className="field-row span-all">
            <label className="field-fit">
              {t("postalCode")}
              <input className="field-code" type="text" name="postalCode" autoComplete="postal-code" maxLength={16} defaultValue={kept("postalCode", profile.postalCode ?? "")} />
            </label>
            <label>
              {t("city")}
              <input type="text" name="city" autoComplete="address-level2" maxLength={120} defaultValue={kept("city", profile.city ?? "")} />
            </label>
            <label className="field-fit">
              {t("countryCode")}
              <input className="field-short" type="text" name="countryCode" maxLength={2} aria-describedby={ids.country} defaultValue={kept("countryCode", profile.countryCode ?? "FR")} />
            </label>
          </div>
          <p id={ids.country} className="field-hint span-all">
            {t("addressStructuredHint")}
          </p>
          {/* Lot 17 (DEV-07) : coordonnées imprimées sur les devis et factures. */}
          <label>
            {t("contactEmail")}
            <input type="email" name="contactEmail" autoComplete="email" defaultValue={kept("contactEmail", details.contactEmail ?? "")} />
          </label>
          <label>
            {t("contactPhone")}
            <input type="tel" name="contactPhone" autoComplete="tel" defaultValue={kept("contactPhone", details.contactPhone ?? "")} />
          </label>
          <label>
            {t("website")}
            <input type="text" name="website" inputMode="url" autoComplete="url" defaultValue={kept("website", details.website ?? "")} />
          </label>
        </div>
      </section>

      {/* Lot 74h (G15, L74-D5) : l'activité, réponses de l'assistant de démarrage ; « Mariages par an » n'y
          est plus demandé et se change ici. */}
      <section className="card" aria-labelledby={ids.activity}>
        <h2 id={ids.activity}>{pattern.activityTitle}</h2>
        <p className="field-hint">{pattern.activityHint}</p>
        <div className="form-grid form-grid-3">
          <label>
            {t("metier")}
            <select name="metier" defaultValue={kept("metier", profile.metier ?? "")}>
              <option value="">{t("metierUnset")}</option>
              <option value="wedding_planner">{t("metierWeddingPlanner")}</option>
              <option value="autre">{t("metierAutre")}</option>
            </select>
          </label>
          <label>
            {t("metierPrecision")}
            <input type="text" name="metierPrecision" defaultValue={kept("metierPrecision", profile.metierPrecision ?? "")} />
          </label>
          <label>
            {pattern.annualVolume}
            <select name="annualEventVolume" defaultValue={kept("annualEventVolume", profile.annualEventVolume ?? "")}>
              <option value="">{pattern.annualVolumeUnset}</option>
              {pattern.volumes.map((volume) => (
                <option key={volume.key} value={volume.key}>
                  {volume.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <SettingsSaveBar
        formKey="company-sheet"
        fieldLabels={pattern.fieldLabels}
        labels={pattern.bar}
        submitLabel={t("sheetSave")}
        pending={pending}
        submission={state}
        saved={state.success === true}
        error={state.error}
        locale={locale}
      />
    </form>
  );
}
