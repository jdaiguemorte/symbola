"use client";

// Lot 33b (HUB-09, PAR-01 ; D9), refait au lot 74a (HUB-09, UX-04, UX-14 ; C-68, M13, B1, B4, B5) — une question
// de l'assistant de démarrage. Un seul bouton, « Continuer », collé en bas sur téléphone et sur un écran bas ;
// sans réponse, « Choisissez une réponse » s'écrit sous la question (forme du lot 70b) et rien ne passe. Le
// métier et les types sont proposés d'avance ; aux questions de fait, rien n'est coché la première fois.
import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Metier } from "@/modules/hub/service";
import type { OngoingAnswer, VatAnswer } from "@/lib/onboarding/questionnaire";
import { FieldError } from "@/app/ui/field-error";
import { answerQuestionAction, type QuestionFormState } from "./actions";

export type ChoiceOption = { key: string; label: string };

export type QuestionProps =
  | { step: 1; metier: Metier; precision: string | null }
  | { step: 2; options: ChoiceOption[]; chosen: string[] }
  | { step: 3; metier: Metier; chosen: OngoingAnswer | null }
  | { step: 4; options: ChoiceOption[]; chosen: string[] }
  | { step: 5; chosen: VatAnswer | null };

const ERROR_ID = "question-error";

export function QuestionForm(props: QuestionProps & { previous: string | null }) {
  const t = useTranslations("Onboarding");
  const tSetup = useTranslations("Setup");
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(answerQuestionAction, {});
  const [metier, setMetier] = useState<Metier>(props.step === 1 ? props.metier : "wedding_planner");
  const legend = t(`questions.${props.step}.title`, { metier: props.step === 3 ? props.metier : "wedding_planner" });
  const invalid = Boolean(state.fieldError);
  // La légende lue avec la question et, en cas d'oubli, le message dessous (WCAG 3.3.1).
  const fieldset = { "aria-describedby": invalid ? `question-hint ${ERROR_ID}` : "question-hint", "aria-invalid": invalid || undefined } as const;

  return (
    <form action={action} className="stack question-form" noValidate>
      <input type="hidden" name="step" value={props.step} />
      {props.step === 1 ? (
        <fieldset className="choice-cards" {...fieldset}>
          <legend className="sr-only">{legend}</legend>
          {(["wedding_planner", "event_agency", "autre"] as const).map((value) => (
            <label key={value} className="choice-card">
              <input type="radio" name="metier" value={value} checked={metier === value} onChange={() => setMetier(value)} />
              <span>
                <strong>{tSetup(`metier.${value}.title`)}</strong>
                <span className="muted">{tSetup(`metier.${value}.body`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {props.step === 1 && metier === "autre" ? (
        <label>
          {tSetup("metierPrecision")}
          <input type="text" name="metierPrecision" maxLength={120} defaultValue={props.precision ?? ""} />
        </label>
      ) : null}
      {props.step === 2 || props.step === 4 ? (
        <fieldset className="choice-list" {...fieldset}>
          <legend className="sr-only">{legend}</legend>
          {props.options.map((option) => (
            <label key={option.key} className="choice-item">
              <input type="checkbox" name={props.step === 2 ? "eventTypes" : "tools"} value={option.key} defaultChecked={props.chosen.includes(option.key)} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {props.step === 3 ? (
        <fieldset className="choice-cards choice-cards-two" {...fieldset}>
          <legend className="sr-only">{legend}</legend>
          {(["yes", "no"] as const).map((value) => (
            <label key={value} className="choice-card">
              <input type="radio" name="ongoing" value={value} defaultChecked={props.chosen === value} />
              <span>
                <strong>{t(`ongoingAnswers.${value}.title`, { metier: props.metier })}</strong>
                <span className="muted">{t(`ongoingAnswers.${value}.body`, { metier: props.metier })}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {props.step === 5 ? (
        <fieldset className="choice-cards" {...fieldset}>
          <legend className="sr-only">{legend}</legend>
          {(["no", "yes", "unknown"] as const).map((value) => (
            <label key={value} className="choice-card">
              <input type="radio" name="vat" value={value} defaultChecked={props.chosen === value} />
              <span>
                <strong>{t(`vatAnswers.${value}.title`)}</strong>
                <span className="muted">{t(`vatAnswers.${value}.body`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <FieldError id={ERROR_ID} message={state.fieldError} />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <div className="question-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {t("continue")}
        </button>
        {props.previous ? (
          <Link href={props.previous} className="onboarding-previous onboarding-previous-bottom">
            {t("back")}
          </Link>
        ) : null}
      </div>
      <p className="muted">{t("editLater")}</p>
    </form>
  );
}
