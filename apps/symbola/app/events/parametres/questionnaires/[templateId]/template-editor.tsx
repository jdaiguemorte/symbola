"use client";

// Lot 45 (HUB-21, POR-07, CRM-09 ; D7, D8) — l'éditeur d'un modèle : nom, type d'évènement, questions
// (texte court ou long, choix unique ou multiple, date, nombre, montant ; pas de fichier), chacune
// pouvant alimenter un champ de l'évènement. Enregistrer des questions changées fait une version ; les
// questionnaires déjà envoyés gardent la leur. Une question sur la santé, la religion ou les opinions
// reçoit un avertissement (DPO) : ces données passent par le module Invités, avec accord.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { QuestionEventField, QuestionNature, QuestionnaireQuestion } from "@symbola/contracts";
import { saveQuestionnaireAction, type TemplateActionState } from "../actions";

type Draft = { key: string | null; label: string; help: string; nature: QuestionNature; choices: string; eventField: QuestionEventField | "" };

const NATURES: QuestionNature[] = ["short_text", "long_text", "single_choice", "multiple_choice", "date", "number", "amount"];

function fold(text: string): string {
  return text.toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function TemplateEditor(props: {
  templateId: string;
  name: string;
  eventTypeId: string | null;
  eventTypes: { id: string; label: string }[];
  questions: QuestionnaireQuestion[];
  fieldNatures: Record<QuestionEventField, QuestionNature[]>;
  sensitiveWords: string[];
}) {
  const t = useTranslations("QuestionnaireTemplates");
  const [name, setName] = useState(props.name);
  const [eventTypeId, setEventTypeId] = useState(props.eventTypeId ?? "");
  const [questions, setQuestions] = useState<Draft[]>(props.questions.map((question) => ({ key: question.key, label: question.label, help: question.help ?? "", nature: question.nature, choices: question.choices.join("\n"), eventField: question.eventField ?? "" })));
  const [state, setState] = useState<TemplateActionState>({});
  const [pending, startTransition] = useTransition();
  const update = (index: number, patch: Partial<Draft>) => setQuestions((current) => current.map((question, position) => (position === index ? { ...question, ...patch } : question)));
  const move = (index: number, delta: number) =>
    setQuestions((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  const fields = Object.keys(props.fieldNatures) as QuestionEventField[];
  const sensitive = (draft: Draft) => props.sensitiveWords.some((word) => fold(`${draft.label} ${draft.help}`).includes(fold(word)));

  return (
    <form
      className="stack questionnaire-editor"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () =>
          setState(
            await saveQuestionnaireAction(props.templateId, {
              name,
              eventTypeId: eventTypeId || null,
              questions: questions.map((question) => ({
                key: question.key,
                label: question.label,
                help: question.help || null,
                nature: question.nature,
                choices: question.choices.split("\n").map((choice) => choice.trim()).filter(Boolean),
                eventField: question.eventField || null,
              })),
            }),
          ),
        );
      }}
    >
      <label htmlFor="template-name">{t("name")}</label>
      <input id="template-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
      <label htmlFor="template-type">{t("eventType")}</label>
      <select id="template-type" value={eventTypeId} onChange={(event) => setEventTypeId(event.target.value)}>
        <option value="">{t("allEvents")}</option>
        {props.eventTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
      <ol className="stack questionnaire-editor-list">
        {questions.map((question, index) => {
          const id = `question-${index}`;
          const choiceNature = question.nature === "single_choice" || question.nature === "multiple_choice";
          return (
            <li key={question.key ?? `new-${index}`} className="card stack">
              <fieldset className="stack">
                <legend>{t("questionNumber", { number: index + 1 })}</legend>
                <label htmlFor={`${id}-label`}>{t("questionLabel")}</label>
                <input id={`${id}-label`} value={question.label} onChange={(event) => update(index, { label: event.target.value })} maxLength={300} required />
                {sensitive(question) ? <p role="alert">{t("sensitiveWarning")}</p> : null}
                <label htmlFor={`${id}-help`}>{t("questionHelp")}</label>
                <input id={`${id}-help`} value={question.help} onChange={(event) => update(index, { help: event.target.value })} maxLength={500} />
                <label htmlFor={`${id}-nature`}>{t("questionNature")}</label>
                <select
                  id={`${id}-nature`}
                  value={question.nature}
                  onChange={(event) => {
                    const nature = event.target.value as QuestionNature;
                    update(index, { nature, eventField: question.eventField && props.fieldNatures[question.eventField].includes(nature) ? question.eventField : "" });
                  }}
                >
                  {NATURES.map((nature) => (
                    <option key={nature} value={nature}>
                      {t(`nature.${nature}`)}
                    </option>
                  ))}
                </select>
                {choiceNature ? (
                  <>
                    <label htmlFor={`${id}-choices`}>{t("questionChoices")}</label>
                    <textarea id={`${id}-choices`} value={question.choices} onChange={(event) => update(index, { choices: event.target.value })} rows={4} />
                  </>
                ) : null}
                <label htmlFor={`${id}-field`}>{t("questionField")}</label>
                <select id={`${id}-field`} value={question.eventField} onChange={(event) => update(index, { eventField: event.target.value as QuestionEventField | "" })}>
                  <option value="">{t("noField")}</option>
                  {fields
                    .filter((field) => props.fieldNatures[field].includes(question.nature))
                    .map((field) => (
                      <option key={field} value={field}>
                        {t(`field.${field}`)}
                      </option>
                    ))}
                </select>
                <div className="row-wrap">
                  <button type="button" className="button-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("moveUp", { number: index + 1 })}>
                    {t("up")}
                  </button>
                  <button type="button" className="button-ghost" onClick={() => move(index, 1)} disabled={index === questions.length - 1} aria-label={t("moveDown", { number: index + 1 })}>
                    {t("down")}
                  </button>
                  <button type="button" className="button-ghost" onClick={() => setQuestions((current) => current.filter((_, position) => position !== index))} disabled={questions.length === 1}>
                    {t("removeQuestion")}
                  </button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <button type="button" className="button-ghost" onClick={() => setQuestions((current) => [...current, { key: null, label: "", help: "", nature: "short_text", choices: "", eventField: "" }])}>
        {t("addQuestion")}
      </button>
      <p className="meta">{t("versionHint")}</p>
      <button type="submit" className="primary" disabled={pending}>
        {t("save")}
      </button>
      {state.ok ? <p role="status">{state.ok}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
