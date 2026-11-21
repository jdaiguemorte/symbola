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
    <form action={formAction}>
      <label htmlFor="validityDays">{t("validityDays")}</label>
      <input id="validityDays" type="number" name="validityDays" min={1} max={365} required defaultValue={settings.validityDays} />
      <label htmlFor="upcomingHorizonDays">{t("upcomingHorizonDays")}</label>
      <input
        id="upcomingHorizonDays"
        type="number"
        name="upcomingHorizonDays"
        min={1}
        max={730}
        required
        defaultValue={settings.upcomingHorizonDays}
      />
      <label htmlFor="invoicePaymentTermDays">{t("invoicePaymentTermDays")}</label>
      <input
        id="invoicePaymentTermDays"
        type="number"
        name="invoicePaymentTermDays"
        min={0}
        max={120}
        required
        defaultValue={settings.invoicePaymentTermDays}
      />
      <label htmlFor="invoiceMentions">{t("invoiceMentions")}</label>
      <textarea
        id="invoiceMentions"
        name="invoiceMentions"
        rows={4}
        maxLength={2000}
        aria-describedby={previousStarterText ? "invoice-mentions-hint invoice-mentions-previous" : "invoice-mentions-hint"}
        defaultValue={settings.invoiceMentions ?? defaultMentions}
      />
      <p id="invoice-mentions-hint">{t("invoiceMentionsHint")}</p>
      {previousStarterText ? (
        <p id="invoice-mentions-previous" role="note">
          {t("invoiceMentionsPrevious")}
        </p>
      ) : null}
      <label htmlFor="invoiceMentionsProfessional">{t("invoiceMentionsProfessional")}</label>
      <textarea
        id="invoiceMentionsProfessional"
        name="invoiceMentionsProfessional"
        rows={4}
        maxLength={2000}
        aria-describedby="invoice-mentions-professional-hint"
        defaultValue={settings.invoiceMentionsProfessional ?? defaultProfessionalMentions}
      />
      <p id="invoice-mentions-professional-hint">{t("invoiceMentionsProfessionalHint")}</p>
      <label htmlFor="latePenaltyRate">{t("latePenaltyRate")}</label>
      <select id="latePenaltyRate" name="latePenaltyRate" aria-describedby="late-penalty-rate-hint" defaultValue={settings.latePenaltyRate ?? ""}>
        <option value="">{t("latePenaltyRateUnset")}</option>
        {rates.map((rate) => (
          <option key={rate.key} value={rate.key}>
            {rate.label}
          </option>
        ))}
      </select>
      <p id="late-penalty-rate-hint">{t("latePenaltyRateHint")}</p>
      {/* Lot 41 (JUR-12, D11, réponse 7 de l'avocat) : délai et escompte d'un professionnel, dans les bornes légales. */}
      <label htmlFor="professionalPaymentTermDays">{t("professionalPaymentTermDays")}</label>
      <input
        id="professionalPaymentTermDays"
        type="number"
        min={0}
        max={professionalBounds.maxDaysAfterIssue}
        name="professionalPaymentTermDays"
        required
        aria-describedby="professional-term-hint"
        defaultValue={settings.professionalPaymentTermDays ?? 30}
      />
      <label>
        <input type="checkbox" name="professionalPaymentTermEndOfMonth" defaultChecked={settings.professionalPaymentTermEndOfMonth ?? false} aria-describedby="professional-term-hint" />
        {t("professionalPaymentTermEndOfMonth")}
      </label>
      <p id="professional-term-hint">{t("professionalPaymentTermHint", { afterIssue: professionalBounds.maxDaysAfterIssue, endOfMonth: professionalBounds.maxDaysEndOfMonth })}</p>
      <label htmlFor="professionalDiscountTerms">{t("professionalDiscountTerms")}</label>
      <input
        id="professionalDiscountTerms"
        type="text"
        name="professionalDiscountTerms"
        maxLength={500}
        aria-describedby="professional-discount-hint"
        defaultValue={settings.professionalDiscountTerms ?? defaultDiscountTerms}
      />
      <p id="professional-discount-hint">{t("professionalDiscountTermsHint")}</p>
      {/* Lot 31a (JUR-08, D5) : acompte ou arrhes proposé pour chaque nouveau devis. */}
      <label htmlFor="advanceKindDefault">{t("advanceKindDefault")}</label>
      <select id="advanceKindDefault" name="advanceKindDefault" aria-describedby="advance-default-hint" defaultValue={settings.advanceKindDefault ?? ""}>
        <option value="">{t("advanceUnset")}</option>
        <option value="deposit">{t("advanceDeposit")}</option>
        <option value="earnest">{t("advanceEarnest")}</option>
      </select>
      <p id="advance-default-hint">{t("advanceKindDefaultHint")}</p>
      <p id="prefix-hint">{t("prefixHint")}</p>
      <label htmlFor="quotePrefix">{t("quotePrefix")}</label>
      <input id="quotePrefix" type="text" name="quotePrefix" required aria-describedby="prefix-hint" defaultValue={settings.quotePrefix} />
      <label htmlFor="invoicePrefix">{t("invoicePrefix")}</label>
      <input id="invoicePrefix" type="text" name="invoicePrefix" required aria-describedby="prefix-hint" defaultValue={settings.invoicePrefix} />
      <label htmlFor="creditNotePrefix">{t("creditNotePrefix")}</label>
      <input
        id="creditNotePrefix"
        type="text"
        name="creditNotePrefix"
        required
        aria-describedby="prefix-hint"
        defaultValue={settings.creditNotePrefix}
      />
      {/* Lot 31c (D21) : série à part des reçus d'arrhes. */}
      <label htmlFor="receiptPrefix">{t("receiptPrefix")}</label>
      <input id="receiptPrefix" type="text" name="receiptPrefix" required aria-describedby="prefix-hint" defaultValue={settings.receiptPrefix ?? "R"} />
      <button type="submit" disabled={pending}>
        {t("saveSettings")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
    </form>
  );
}
