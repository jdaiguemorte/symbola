"use client";

// Lot 62d (UX-12, DESIGN.md « un seul bouton principal ») — la prochaine action du devis quand elle
// tient en un clic (envoyer le brouillon, créer une nouvelle version) : le bouton est dans l'en-tête,
// sur chaque rubrique ; son retour (refus, mentions manquantes nommées) s'affiche juste dessous.
import Link from "next/link";
import { createContext, useActionState, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MissingMentionsList } from "../missing-mentions";
import { FieldError } from "@/app/ui/field-error";
import { reviseQuoteAction, sendQuoteAction, type QuoteFormState } from "./actions";

type NextActionState = { state: QuoteFormState; formAction: (formData: FormData) => void; pending: boolean };

const NextActionContext = createContext<NextActionState | null>(null);

function useNextAction(): NextActionState {
  const context = useContext(NextActionContext);
  if (!context) throw new Error("NextActionProvider manquant");
  return context;
}

export function NextActionProvider({ action, children }: { action: "send" | "revise"; children: ReactNode }) {
  const initial: QuoteFormState = {};
  const [state, formAction, pending] = useActionState(action === "send" ? sendQuoteAction : reviseQuoteAction, initial);
  return <NextActionContext.Provider value={{ state, formAction, pending }}>{children}</NextActionContext.Provider>;
}

export function NextActionButton({ quoteId, label }: { quoteId: string; label: string }) {
  const { formAction, pending } = useNextAction();
  return (
    <form action={formAction} aria-label={label} className="quote-next-action">
      <input type="hidden" name="quoteId" value={quoteId} />
      <button type="submit" className="button-primary" disabled={pending}>
        {label}
      </button>
    </form>
  );
}

export function NextActionFeedback({ label, successMessage, quoteId }: { label: string; successMessage: string; quoteId?: string }) {
  const t = useTranslations("Quotes");
  const { state } = useNextAction();
  if (state.vatQuestion && quoteId) return <VatQuestion quoteId={quoteId} />;
  if (!state.error && !state.success) return null;
  return (
    <div role="group" aria-label={label} className="quote-next-feedback">
      {state.error ? (
        <p role="alert">
          {state.error}
          {state.vatRegimeRequired ? (
            <>
              {" "}
              <Link href="/parametres">{t("completeVatRegime")}</Link>
            </>
          ) : null}
        </p>
      ) : null}
      {state.missingMentions && state.missingMentions.length > 0 ? <MissingMentionsList fields={state.missingMentions} /> : null}
      {state.success ? <p role="status">{successMessage}</p> : null}
    </div>
  );
}

// Lot 74a (HUB-09 ; B5, L74-D4) — « Je ne sais pas encore » à la question de la TVA de l'assistant : avant le
// premier envoi, la même question, sans « Je ne sais pas encore ». La réponse donnée, l'envoi reprend.
function VatQuestion({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  const tOnboarding = useTranslations("Onboarding");
  const { state, formAction, pending } = useNextAction();
  return (
    <form action={formAction} aria-labelledby="quote-vat-question-title" className="quote-next-feedback stack">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="vatQuestion" value="1" />
      <fieldset className="choice-list" aria-describedby={state.error ? "quote-vat-question-error" : undefined}>
        <legend id="quote-vat-question-title">{t("vatQuestionTitle")}</legend>
        <p className="field-hint">{t("vatQuestionHint")}</p>
        {(["no", "yes"] as const).map((answer) => (
          <label key={answer} className="choice-card">
            <input type="radio" name="vatAnswer" value={answer} />
            <span>
              <strong>{tOnboarding(`vatAnswers.${answer}.title`)}</strong>
              <span className="muted">{tOnboarding(`vatAnswers.${answer}.body`)}</span>
            </span>
          </label>
        ))}
        {state.error ? <FieldError id="quote-vat-question-error" message={state.error} /> : null}
      </fieldset>
      <button type="submit" className="button-primary" disabled={pending}>
        {t("vatQuestionSubmit")}
      </button>
    </form>
  );
}
