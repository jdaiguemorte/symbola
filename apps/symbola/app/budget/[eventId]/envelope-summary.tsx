"use client";

// Lot 28a (BUD-02, décision D4) — enveloppe du client, part engagée et seuil
// d'alerte ; une alerte quand l'engagé dépasse le seuil. Le seuil propre à
// l'événement se règle ici (vide : celui de l'organisation).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { BudgetAlertSettings, BudgetEnvelope } from "@symbola/contracts";
import { setEventAlertThresholdAction, type BudgetFormState } from "./actions";

export function EnvelopeSummary({
  eventId,
  envelope,
  committedCents,
  settings,
  locale,
}: {
  eventId: string;
  envelope: BudgetEnvelope | null;
  committedCents: number;
  settings: BudgetAlertSettings;
  locale: Locale;
}) {
  const t = useTranslations("Budget");
  const initialState: BudgetFormState = {};
  const [state, formAction, pending] = useActionState(setEventAlertThresholdAction, initialState);

  return (
    <section aria-labelledby="envelope-title" className="card">
      <h2 id="envelope-title">{t("envelopeTitle")}</h2>
      {envelope ? (
        <>
          <dl className="effects budget-figures">
            <div>
              <dt>{t(envelope.source === "wanted" ? "envelopeWanted" : "envelopeSimulation")}</dt>
              <dd>{formatAmount(envelope.amountCents, locale)}</dd>
            </div>
            <div>
              <dt>{t("envelopeCommitted")}</dt>
              <dd>{t("envelopeShare", { amount: formatAmount(committedCents, locale), percent: envelope.committedPercent })}</dd>
            </div>
            {/* SC-04, étape 2 : l'écart à l'enveloppe (négatif : dépassement). */}
            <div>
              <dt>{t("envelopeLeft")}</dt>
              <dd className={envelope.amountCents - committedCents < 0 ? "text-overdue" : undefined}>{formatAmount(envelope.amountCents - committedCents, locale)}</dd>
            </div>
            <div>
              <dt>{t("envelopeThreshold")}</dt>
              <dd>{t("envelopeShare", { amount: formatAmount(envelope.thresholdCents, locale), percent: envelope.thresholdPercent })}</dd>
            </div>
          </dl>
          {envelope.exceeded ? (
            <p role="alert" className="notice">
              {t("envelopeExceeded", { amount: formatAmount(committedCents - envelope.thresholdCents, locale), percent: envelope.thresholdPercent })}
            </p>
          ) : null}
        </>
      ) : (
        <p>{t("envelopeMissing")}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          {t("eventThreshold", { percent: settings.organizationPercent })}
          <input type="number" min="1" max="500" step="1" name="percent" defaultValue={settings.eventPercent ?? ""} />
        </label>
        <button type="submit" disabled={pending}>
          {t("saveThreshold")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("thresholdSaved")}</p> : null}
      </form>
    </section>
  );
}
