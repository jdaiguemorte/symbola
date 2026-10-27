"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { QuoteSettings } from "@/modules/quotes/service";
import { updateQuoteSettingsAction, type QuoteSettingsFormState } from "./actions";

// Mentions de facturation : le modèle de départ pré-remplit le champ tant
// que l'organisation n'a rien enregistré (à relire par le comptable).
export function QuoteSettingsForm({ settings, defaultMentions }: { settings: QuoteSettings; defaultMentions: string }) {
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
        aria-describedby="invoice-mentions-hint"
        defaultValue={settings.invoiceMentions ?? defaultMentions}
      />
      <p id="invoice-mentions-hint">{t("invoiceMentionsHint")}</p>
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
      <button type="submit" disabled={pending}>
        {t("saveSettings")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
    </form>
  );
}
