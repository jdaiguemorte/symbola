"use client";

// Lot 62d (UX-12, DESIGN.md « un seul bouton principal ») — la prochaine action du devis quand elle
// tient en un clic (envoyer le brouillon, créer une nouvelle version) : le bouton est dans l'en-tête,
// sur chaque rubrique ; son retour (refus, mentions manquantes nommées) s'affiche juste dessous.
import Link from "next/link";
import { createContext, useActionState, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MissingMentionsList } from "../missing-mentions";
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

export function NextActionFeedback({ label, successMessage }: { label: string; successMessage: string }) {
  const t = useTranslations("Quotes");
  const { state } = useNextAction();
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
