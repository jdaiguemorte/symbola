"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { QuoteSettings } from "@/modules/quotes/service";
import { updateQuoteSettingsAction, type QuoteSettingsFormState } from "./actions";

// Mentions de facturation : le modèle de départ pré-remplit le champ tant
// que l'organisation n'a rien enregistré (à relire par le comptable).
// Lot 31c (D18, réponse 1 de l'expert-comptable) : deux textes, celui des particuliers et des
// non-professionnels, celui des professionnels ; le taux des pénalités face à un professionnel se
// choisit dans la liste (données), sans valeur proposée ; l'ancien texte de départ est signalé.
// Lot 62b (UX-12) : formulaire en grille, par cartes (délais, conditions de paiement, clients
// professionnels, numérotation) ; les nombres de jours et les préfixes sont des champs courts ; un
// seul « Enregistrer les paramètres ». Les noms des champs ne changent pas.
export function QuoteSettingsForm({
  settings,
  defaultMentions,
  defaultProfessionalMentions,
  rates,
  previousStarterText,
  professionalBounds,
  defaultDiscountTerms,
}: {
  // Lot 41 (JUR-12, D11) : bornes légales des données, escompte de départ (« Néant »).
  professionalBounds: { maxDaysAfterIssue: number; maxDaysEndOfMonth: number };
  defaultDiscountTerms: string;
  settings: QuoteSettings;
  defaultMentions: string;
  defaultProfessionalMentions: string;
  rates: { key: string; label: string }[];
  previousStarterText: boolean;
}) {
  const t = useTranslations("Quotes");
  const initialState: QuoteSettingsFormState = {};
  const [state, formAction, pending] = useActionState(updateQuoteSettingsAction, initialState);

  return (
    <form action={formAction} className="settings-sheet" aria-label={t("settingsTitle")}>
      <section className="card" aria-labelledby="quote-settings-delays">
        <h2 id="quote-settings-delays">{t("settingsDelaysTitle")}</h2>
        <div className="form-grid form-grid-3">
          <label htmlFor="validityDays">
            {t("validityDays")}
            <input id="validityDays" className="field-short" type="number" name="validityDays" min={1} max={365} required defaultValue={settings.validityDays} />
          </label>
          <label htmlFor="invoicePaymentTermDays">
            {t("invoicePaymentTermDays")}
            <input id="invoicePaymentTermDays" className="field-short" type="number" name="invoicePaymentTermDays" min={0} max={120} required defaultValue={settings.invoicePaymentTermDays} />
          </label>
          <label htmlFor="upcomingHorizonDays">
            {t("upcomingHorizonDays")}
            <input id="upcomingHorizonDays" className="field-short" type="number" name="upcomingHorizonDays" min={1} max={730} required defaultValue={settings.upcomingHorizonDays} />
          </label>
          {/* Lot 31a (JUR-08, D5) : acompte ou arrhes proposé pour chaque nouveau devis. */}
          <div className="field-group span-all">
            <label htmlFor="advanceKindDefault">
              {t("advanceKindDefault")}
              <select id="advanceKindDefault" className="field-choice" name="advanceKindDefault" aria-describedby="advance-default-hint" defaultValue={settings.advanceKindDefault ?? ""}>
                <option value="">{t("advanceUnset")}</option>
                <option value="deposit">{t("advanceDeposit")}</option>
                <option value="earnest">{t("advanceEarnest")}</option>
              </select>
            </label>
            <p id="advance-default-hint" className="field-hint">
              {t("advanceKindDefaultHint")}
            </p>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="quote-settings-terms">
        <h2 id="quote-settings-terms">{t("settingsTermsTitle")}</h2>
        <div className="form-grid">
          <div className="field-group">
            <label htmlFor="invoiceMentions">
              {t("invoiceMentions")}
              <textarea
                id="invoiceMentions"
                name="invoiceMentions"
                rows={5}
                maxLength={2000}
                aria-describedby={previousStarterText ? "invoice-mentions-hint invoice-mentions-previous" : "invoice-mentions-hint"}
                defaultValue={settings.invoiceMentions ?? defaultMentions}
              />
            </label>
            <p id="invoice-mentions-hint" className="field-hint">
              {t("invoiceMentionsHint")}
            </p>
            {previousStarterText ? (
              <p id="invoice-mentions-previous" role="note">
                {t("invoiceMentionsPrevious")}
              </p>
            ) : null}
          </div>
          <div className="field-group">
            <label htmlFor="invoiceMentionsProfessional">
              {t("invoiceMentionsProfessional")}
              <textarea
                id="invoiceMentionsProfessional"
                name="invoiceMentionsProfessional"
                rows={5}
                maxLength={2000}
                aria-describedby="invoice-mentions-professional-hint"
                defaultValue={settings.invoiceMentionsProfessional ?? defaultProfessionalMentions}
              />
            </label>
            <p id="invoice-mentions-professional-hint" className="field-hint">
              {t("invoiceMentionsProfessionalHint")}
            </p>
          </div>
        </div>
      </section>

      {/* Lot 41 (JUR-12, D11, réponse 7 de l'avocat) : délai et escompte d'un professionnel, dans les bornes légales. */}
      <section className="card" aria-labelledby="quote-settings-professional">
        <h2 id="quote-settings-professional">{t("settingsProfessionalTitle")}</h2>
        <div className="form-grid">
          <div className="field-group">
            <div className="field-row">
              <label htmlFor="professionalPaymentTermDays" className="field-fit">
                {t("professionalPaymentTermDays")}
                <input
                  id="professionalPaymentTermDays"
                  className="field-short"
                  type="number"
                  min={0}
                  max={professionalBounds.maxDaysAfterIssue}
                  name="professionalPaymentTermDays"
                  required
                  aria-describedby="professional-term-hint"
                  defaultValue={settings.professionalPaymentTermDays ?? 30}
                />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="professionalPaymentTermEndOfMonth" defaultChecked={settings.professionalPaymentTermEndOfMonth ?? false} aria-describedby="professional-term-hint" />
                {t("professionalPaymentTermEndOfMonth")}
              </label>
            </div>
            <p id="professional-term-hint" className="field-hint">
              {t("professionalPaymentTermHint", { afterIssue: professionalBounds.maxDaysAfterIssue, endOfMonth: professionalBounds.maxDaysEndOfMonth })}
            </p>
          </div>
          <div className="field-group">
            <label htmlFor="latePenaltyRate">
              {t("latePenaltyRate")}
              <select id="latePenaltyRate" name="latePenaltyRate" aria-describedby="late-penalty-rate-hint" defaultValue={settings.latePenaltyRate ?? ""}>
                <option value="">{t("latePenaltyRateUnset")}</option>
                {rates.map((rate) => (
                  <option key={rate.key} value={rate.key}>
                    {rate.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="late-penalty-rate-hint" className="field-hint">
              {t("latePenaltyRateHint")}
            </p>
          </div>
          <div className="field-group span-all">
            <label htmlFor="professionalDiscountTerms">
              {t("professionalDiscountTerms")}
              <input
                id="professionalDiscountTerms"
                type="text"
                name="professionalDiscountTerms"
                maxLength={500}
                aria-describedby="professional-discount-hint"
                defaultValue={settings.professionalDiscountTerms ?? defaultDiscountTerms}
              />
            </label>
            <p id="professional-discount-hint" className="field-hint">
              {t("professionalDiscountTermsHint")}
            </p>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="quote-settings-numbering">
        <h2 id="quote-settings-numbering">{t("settingsNumberingTitle")}</h2>
        <p id="prefix-hint" className="field-hint">
          {t("prefixHint")}
        </p>
        <div className="field-row">
          <label htmlFor="quotePrefix" className="field-fit">
            {t("quotePrefix")}
            <input id="quotePrefix" className="field-code" type="text" name="quotePrefix" required aria-describedby="prefix-hint" defaultValue={settings.quotePrefix} />
          </label>
          <label htmlFor="invoicePrefix" className="field-fit">
            {t("invoicePrefix")}
            <input id="invoicePrefix" className="field-code" type="text" name="invoicePrefix" required aria-describedby="prefix-hint" defaultValue={settings.invoicePrefix} />
          </label>
          <label htmlFor="creditNotePrefix" className="field-fit">
            {t("creditNotePrefix")}
            <input id="creditNotePrefix" className="field-code" type="text" name="creditNotePrefix" required aria-describedby="prefix-hint" defaultValue={settings.creditNotePrefix} />
          </label>
          {/* Lot 31c (D21) : série à part des reçus d'arrhes. */}
          <label htmlFor="receiptPrefix" className="field-fit">
            {t("receiptPrefix")}
            <input id="receiptPrefix" className="field-code" type="text" name="receiptPrefix" required aria-describedby="prefix-hint" defaultValue={settings.receiptPrefix ?? "R"} />
          </label>
        </div>
      </section>

      <div className="form-foot">
        <button type="submit" disabled={pending}>
          {t("saveSettings")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
      </div>
    </form>
  );
}
