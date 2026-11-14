"use client";

// Lot 33b (HUB-09, PAR-01 ; D9) — une question du questionnaire d'accueil, avec sa réponse
// proposée déjà choisie. « Continuer » enregistre ce qui est choisi ; « Passer » garde la réponse
// proposée. Rien n'est obligatoire sans valeur par défaut (PAR-01).
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Metier } from "@/modules/hub/service";
import { answerQuestionAction, type QuestionFormState } from "./actions";

export type ChoiceOption = { key: string; label: string };

export type QuestionProps =
  | { step: 1; metier: Metier; precision: string | null }
  | { step: 2; options: ChoiceOption[]; chosen: string[] }
  | { step: 3; regime: "franchise" | "assujetti" }
  | { step: 4; options: ChoiceOption[]; chosen: string }
  | { step: 5; options: ChoiceOption[]; chosen: string[] };

export function QuestionForm(props: QuestionProps) {
  const t = useTranslations("Onboarding");
  const tSetup = useTranslations("Setup");
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(answerQuestionAction, {});
  const [metier, setMetier] = useState<Metier>(props.step === 1 ? props.metier : "wedding_planner");
  const legend = t(`questions.${props.step}.title`);

  return (
    <form action={action} className="stack question-form">
      <input type="hidden" name="step" value={props.step} />
      {props.step === 1 ? (
        <fieldset className="choice-cards">
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
      {props.step === 2 || props.step === 5 ? (
        <fieldset className="choice-list">
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
        <fieldset className="choice-cards">
          <legend className="sr-only">{legend}</legend>
          {(["franchise", "assujetti"] as const).map((value) => (
            <label key={value} className="choice-card">
              <input type="radio" name="vatRegime" value={value} defaultChecked={props.regime === value} />
              <span>
                <strong>{tSetup(`vat.${value}.title`)}</strong>
                <span className="muted">{tSetup(`vat.${value}.body`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {props.step === 4 ? (
        <fieldset className="choice-list">
          <legend className="sr-only">{legend}</legend>
          {props.options.map((option) => (
            <label key={option.key} className="choice-item">
              <input type="radio" name="volume" value={option.key} defaultChecked={props.chosen === option.key} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      <div className="question-actions">
        <button type="submit" name="intent" value="continue" className="primary-button" disabled={pending}>
          {props.step === 5 ? t("finish") : t("continue")}
        </button>
        <button type="submit" name="intent" value="skip" className="button-ghost" disabled={pending}>
          {t("skip")}
        </button>
      </div>
      <p className="muted">{t("skipHint")}</p>
    </form>
  );
}
