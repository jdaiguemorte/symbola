"use client";

// Lot 45 (POR-07, CRM-09 ; D7 ; ADR 0090) — répondre à un questionnaire : une question par écran sur
// téléphone (« Précédente », « Suivante »), toutes à la suite sur ordinateur. Chaque réponse est
// enregistrée dès qu'elle est donnée (quitter la page ne perd rien) ; la personne reprend à la première
// question sans réponse. Une question dont la réponse est déjà connue est proposée pré-remplie, à
// confirmer ; une question déjà répondue ailleurs n'est pas reposée.
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { PortalQuestion, QuestionnaireAnswerValue } from "@symbola/contracts";
import { finishQuestionnaireAction, saveAnswerAction } from "../actions";

type Status = { kind: "saved" | "error"; text: string } | null;

function initialText(value: QuestionnaireAnswerValue | null, nature: string): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.join("\n");
  if (nature === "amount" && typeof value === "number") return (value / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");
  return String(value);
}

function QuestionInput({ question, value, onChange, onCommit }: { question: PortalQuestion; value: string; onChange: (value: string) => void; onCommit: (value: string | string[] | null) => void }) {
  const id = `answer-${question.key}`;
  switch (question.nature) {
    case "long_text":
      return <textarea id={id} value={value} rows={5} maxLength={5000} onChange={(event) => onChange(event.target.value)} onBlur={() => onCommit(value || null)} />;
    case "single_choice":
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="stack">
          {question.choices.map((choice) => (
            <label key={choice} className="checkbox">
              <input type="radio" name={id} checked={value === choice} onChange={() => (onChange(choice), onCommit(choice))} />
              {choice}
            </label>
          ))}
        </div>
      );
    case "multiple_choice": {
      const chosen = value ? value.split("\n") : [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="stack">
          {question.choices.map((choice) => (
            <label key={choice} className="checkbox">
              <input
                type="checkbox"
                checked={chosen.includes(choice)}
                onChange={(event) => {
                  const next = event.target.checked ? [...chosen, choice] : chosen.filter((item) => item !== choice);
                  onChange(next.join("\n"));
                  onCommit(next.length > 0 ? next : null);
                }}
              />
              {choice}
            </label>
          ))}
        </div>
      );
    }
    case "date":
      return <input id={id} type="date" value={value} onChange={(event) => (onChange(event.target.value), onCommit(event.target.value || null))} />;
    case "number":
      return <input id={id} type="number" inputMode="numeric" min={0} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => onCommit(value || null)} />;
    case "amount":
      return <input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => onCommit(value || null)} />;
    default:
      return <input id={id} value={value} maxLength={300} onChange={(event) => onChange(event.target.value)} onBlur={() => onCommit(value || null)} />;
  }
}

export function QuestionnaireAnswerer({ questionnaireId, questions, finished }: { questionnaireId: string; questions: PortalQuestion[]; finished: boolean }) {
  const t = useTranslations("PortalQuestionnaires");
  const asked = useMemo(() => questions.filter((question) => !question.answeredElsewhere), [questions]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(asked.map((question) => [question.key, initialText(question.answer ?? question.suggestion, question.nature)])));
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(() => Object.fromEntries(asked.map((question) => [question.key, question.answer !== null])));
  const [step, setStep] = useState(() => Math.max(0, asked.findIndex((question) => question.answer === null)));
  const [status, setStatus] = useState<Status>(null);
  const [done, setDone] = useState(finished);
  const [pending, startTransition] = useTransition();

  const commit = (key: string, value: string | string[] | null) =>
    startTransition(async () => {
      const result = await saveAnswerAction({ questionnaireId, key, value });
      if (result.ok) {
        setConfirmed((current) => ({ ...current, [key]: value !== null }));
        setStatus({ kind: "saved", text: t("saved") });
      } else setStatus({ kind: "error", text: result.error });
    });

  if (done) return <p role="status">{t("thanks")}</p>;
  const remaining = asked.filter((question) => !confirmed[question.key]).length;

  return (
    <div className="stack questionnaire-answerer">
      {questions.some((question) => question.answeredElsewhere) ? <p className="meta">{t("alreadyAnswered", { count: questions.filter((question) => question.answeredElsewhere).length })}</p> : null}
      <p className="meta questionnaire-step-count" aria-live="polite">
        {t("stepOf", { step: Math.min(step + 1, asked.length), total: asked.length })}
      </p>
      {asked.map((question, index) => {
        const value = values[question.key] ?? "";
        return (
          <fieldset key={question.key} className="questionnaire-question card stack" data-current={index === step ? "true" : "false"}>
            <legend id={`answer-${question.key}-label`}>
              <label htmlFor={`answer-${question.key}`}>{question.label}</label>
            </legend>
            {question.help ? <p className="meta">{question.help}</p> : null}
            <QuestionInput question={question} value={value} onChange={(next) => setValues((current) => ({ ...current, [question.key]: next }))} onCommit={(next) => commit(question.key, next)} />
            {question.suggestion !== null && !confirmed[question.key] ? (
              <p className="meta">
                {t("suggested")}{" "}
                <button type="button" className="button-ghost" onClick={() => commit(question.key, question.nature === "multiple_choice" ? value.split("\n") : value || null)}>
                  {t("confirm")}
                </button>
              </p>
            ) : null}
          </fieldset>
        );
      })}
      <div className="row-wrap questionnaire-nav">
        <button type="button" className="button-ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
          {t("previous")}
        </button>
        <button type="button" className="button-ghost" onClick={() => setStep((current) => Math.min(asked.length - 1, current + 1))} disabled={step >= asked.length - 1}>
          {t("next")}
        </button>
      </div>
      <p className="meta">{remaining > 0 ? t("remaining", { count: remaining }) : t("complete")}</p>
      <button
        type="button"
        className="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await finishQuestionnaireAction(questionnaireId);
            if (result.ok) setDone(true);
            else setStatus({ kind: "error", text: result.error });
          })
        }
      >
        {t("finish")}
      </button>
      {status ? <p role={status.kind === "error" ? "alert" : "status"}>{status.text}</p> : null}
    </div>
  );
}
