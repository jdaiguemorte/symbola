"use client";

// Lot 31a (FAC-01, décision D2 ; SC-02 étape 5) — options d'un devis envoyé, cochées par le
// client sur son portail : le prix de chacune, le total une fois choisi ; figé dès que la
// signature commence. Dans l'aperçu « vu par » de la planner, rien ne s'enregistre.
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import type { ClientQuoteOptions } from "@/modules/quotes/service";
import { chooseLinkQuoteOptionsAction, type QuoteOptionsState } from "./actions";

export function ClientQuoteOptionsForm({ quote, preview = false }: { quote: ClientQuoteOptions; preview?: boolean }) {
  const t = useTranslations("ClientSpace");
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState(chooseLinkQuoteOptionsAction, {} as QuoteOptionsState);
  const price = (cents: number) => (quote.vatApplicable ? t("optionPriceTtc", { amount: formatAmount(cents, locale) }) : t("optionPrice", { amount: formatAmount(cents, locale) }));
  return (
    <form action={preview ? undefined : action} aria-label={t("optionsForQuote", { number: quote.number })}>
      <input type="hidden" name="quoteId" value={quote.quoteId} />
      <fieldset disabled={quote.locked || preview}>
        <legend>{t("optionsForQuote", { number: quote.number })}</legend>
        {quote.options.map((option) => (
          <label key={option.lineId}>
            <input type="checkbox" name="optionLineIds" value={option.lineId} defaultChecked={option.chosen} />
            {option.label} — {price(option.amountCents)}
          </label>
        ))}
      </fieldset>
      <p>{t("optionsTotal", { amount: formatAmount(quote.totalTtcCents, locale) })}</p>
      {quote.advanceKind ? <p>{t(quote.advanceKind === "earnest" ? "advanceEarnest" : "advanceDeposit")}</p> : null}
      {quote.choice ? <p className="muted">{t("optionsChosenOn", { name: quote.choice.chosenBy, date: formatDateTime(new Date(quote.choice.chosenAt), locale) })}</p> : null}
      {quote.locked ? (
        <p className="muted">{t("optionsLocked")}</p>
      ) : (
        <button type="submit" disabled={pending || preview}>
          {t("saveOptions")}
        </button>
      )}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("optionsSaved")}</p> : null}
    </form>
  );
}
