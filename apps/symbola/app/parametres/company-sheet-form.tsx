"use client";

// Lot 62b (UX-12) — la fiche de l'entreprise : trois cartes (identité, adresse, coordonnées
// imprimées sur les devis et factures) en grille, et un seul « Enregistrer la fiche ». Elle réunit
// la fiche de départ (ONB-01), l'adresse structurée (FAC-10, D7) et les coordonnées des documents
// (lot 17, DEV-07), qui avaient chacune leur formulaire et leur bouton.
import { useActionState, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmountInput, type Locale } from "@symbola/i18n";
import type { OrganizationProfile, SellerDetails } from "@/modules/hub/service";
import { saveCompanySheetAction, type CompanySheetFormState } from "./actions";

const LEGAL_FORMS = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"] as const;

export function CompanySheetForm({ profile, details }: { profile: OrganizationProfile; details: SellerDetails }) {
  const t = useTranslations("Settings");
  const locale = useLocale() as Locale;
  const [state, formAction, pending] = useActionState<CompanySheetFormState, FormData>(saveCompanySheetAction, {});
  // Une fiche refusée garde ce qui a été saisi : React remet les champs à leur valeur de départ après
  // l'envoi, et la valeur de départ devient alors la saisie rendue par l'action.
  const kept = (name: string, stored: string) => state.values?.[name] ?? stored;
  const ids = { identity: useId(), address: useId(), contact: useId(), registration: useId(), capital: useId(), country: useId() };

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

      {/* Adresse et coordonnées côte à côte quand la place le permet. */}
      <div className="sheet-pair">
      {/* Lot 41 (FAC-10, D7) : adresse structurée, exigée par la facture électronique. */}
      <section className="card" aria-labelledby={ids.address}>
        <h2 id={ids.address}>{t("sheetAddressTitle")}</h2>
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
        </div>
      </section>

      {/* Lot 17 (DEV-07) : coordonnées imprimées sur les devis et factures. */}
      <section className="card" aria-labelledby={ids.contact}>
        <h2 id={ids.contact}>{t("sheetContactTitle")}</h2>
        <p className="field-hint">{t("documentDetailsHint")}</p>
        <div className="sheet-stack">
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
      </div>

      <div className="form-foot">
        <button type="submit" disabled={pending}>
          {t("sheetSave")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("profileSaved")}</p> : null}
      </div>
    </form>
  );
}
