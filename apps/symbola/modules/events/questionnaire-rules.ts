// Lot 45 (POR-07, CRM-09, HUB-21 ; D7, D8 ; ADR 0090) — règles pures des questionnaires : une
// question (texte court ou long, choix unique ou multiple, date, nombre, montant ; pas de fichier, D8),
// le champ de l'évènement qu'elle alimente, la validation d'une réponse, la vue de la personne
// (question déjà connue proposée pré-remplie, question déjà répondue ailleurs non reposée) et le
// préremplissage de l'évènement (un champ vide se remplit, un écart est montré à la planner).
import { randomUUID } from "node:crypto";
import {
  QUESTION_CHOICES_MAX,
  QUESTION_EVENT_FIELDS,
  QUESTION_NATURES,
  QUESTIONS_MAX,
  type PortalQuestion,
  type QuestionEventField,
  type QuestionNature,
  type QuestionnaireAnswerValue,
  type QuestionnaireQuestion,
} from "@symbola/contracts";

export const QUESTION_LABEL_MAX = 300;
export const QUESTION_HELP_MAX = 500;
export const CHOICE_MAX = 120;
export const SHORT_ANSWER_MAX = 300;
export const LONG_ANSWER_MAX = 5000;
export const GUESTS_MAX = 100_000;
// 20 millions d'euros : le budget souhaité de l'évènement est un entier de 32 bits, en centimes.
export const AMOUNT_MAX_CENTS = 2_000_000_000;

// La nature qu'un champ de l'évènement attend.
const FIELD_NATURES: Record<QuestionEventField, QuestionNature[]> = {
  event_date: ["date"],
  guests: ["number"],
  budget: ["amount"],
  venue: ["short_text", "long_text"],
  city: ["short_text"],
  style: ["short_text", "long_text", "single_choice"],
  event_type: ["single_choice", "short_text"],
};

export function naturesForField(field: QuestionEventField): QuestionNature[] {
  return FIELD_NATURES[field];
}

export class QuestionInvalidError extends Error {
  constructor(readonly reason: "label" | "help" | "nature" | "choices" | "field" | "too_many" | "empty") {
    super(`question invalide : ${reason}`);
    this.name = "QuestionInvalidError";
  }
}

export type QuestionInput = { key?: string | null; label: string; help?: string | null; nature: string; choices?: string[]; eventField?: string | null };

export function newQuestionKey(): string {
  return `q-${randomUUID().slice(0, 8)}`;
}

export function cleanQuestion(input: QuestionInput): QuestionnaireQuestion {
  const label = input.label.replace(/\s+/g, " ").trim();
  if (!label || label.length > QUESTION_LABEL_MAX) throw new QuestionInvalidError("label");
  const help = input.help?.trim() || null;
  if (help && help.length > QUESTION_HELP_MAX) throw new QuestionInvalidError("help");
  if (!(QUESTION_NATURES as readonly string[]).includes(input.nature)) throw new QuestionInvalidError("nature");
  const nature = input.nature as QuestionNature;
  const withChoices = nature === "single_choice" || nature === "multiple_choice";
  const choices = withChoices ? [...new Set((input.choices ?? []).map((choice) => choice.replace(/\s+/g, " ").trim()).filter(Boolean))] : [];
  if (withChoices && (choices.length < 2 || choices.length > QUESTION_CHOICES_MAX || choices.some((choice) => choice.length > CHOICE_MAX))) throw new QuestionInvalidError("choices");
  const field = input.eventField || null;
  if (field && !(QUESTION_EVENT_FIELDS as readonly string[]).includes(field)) throw new QuestionInvalidError("field");
  if (field && !FIELD_NATURES[field as QuestionEventField].includes(nature)) throw new QuestionInvalidError("field");
  const key = input.key && /^[a-z0-9_-]{1,60}$/.test(input.key) ? input.key : newQuestionKey();
  return { key, label, help, nature, choices, eventField: (field as QuestionEventField | null) ?? null };
}

export function cleanQuestions(inputs: QuestionInput[]): QuestionnaireQuestion[] {
  if (inputs.length === 0) throw new QuestionInvalidError("empty");
  if (inputs.length > QUESTIONS_MAX) throw new QuestionInvalidError("too_many");
  const questions = inputs.map(cleanQuestion);
  const seen = new Set<string>();
  return questions.map((question) => {
    const key = seen.has(question.key) ? newQuestionKey() : question.key;
    seen.add(key);
    return { ...question, key };
  });
}

// DPO — une question qui parle de santé, de religion ou d'opinions reçoit un avertissement (renvoi au
// module Invités, qui recueille l'accord) ; les mots viennent des données de départ.
export function isSensitiveQuestion(label: string, sensitiveWords: string[]): boolean {
  const text = label.toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
  return sensitiveWords.some((word) => text.includes(word.toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "")));
}

// —— Réponses ———————————————————————————————————————————————————————————————————————————

export class AnswerInvalidError extends Error {
  constructor(readonly reason: "empty" | "too_long" | "choice" | "date" | "number" | "amount") {
    super(`réponse invalide : ${reason}`);
    this.name = "AnswerInvalidError";
  }
}

// Un montant saisi en euros (« 12 000 », « 12 000,50 ») ramené en centimes.
export function parseAmountCents(raw: string): number | null {
  const text = raw.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [euros, cents = ""] = text.split(".");
  const value = Number(euros) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(value) && value <= AMOUNT_MAX_CENTS ? value : null;
}

function validDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// La réponse saisie, contrôlée selon la nature de la question ; null : réponse effacée.
export function cleanAnswer(question: QuestionnaireQuestion, raw: string | string[] | null): QuestionnaireAnswerValue | null {
  const values = (Array.isArray(raw) ? raw : raw === null ? [] : [raw]).map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return null;
  const first = values[0]!;
  switch (question.nature) {
    case "short_text":
      if (first.length > SHORT_ANSWER_MAX) throw new AnswerInvalidError("too_long");
      return first.replace(/\s+/g, " ");
    case "long_text":
      if (first.length > LONG_ANSWER_MAX) throw new AnswerInvalidError("too_long");
      return first.replace(/\r\n/g, "\n");
    case "single_choice":
      if (!question.choices.includes(first)) throw new AnswerInvalidError("choice");
      return first;
    case "multiple_choice": {
      const chosen = question.choices.filter((choice) => values.includes(choice));
      if (chosen.length !== new Set(values).size) throw new AnswerInvalidError("choice");
      return chosen;
    }
    case "date":
      if (!validDate(first)) throw new AnswerInvalidError("date");
      return first;
    case "number": {
      if (!/^\d+$/.test(first) || Number(first) > GUESTS_MAX) throw new AnswerInvalidError("number");
      return Number(first);
    }
    case "amount": {
      const cents = parseAmountCents(first);
      if (cents === null) throw new AnswerInvalidError("amount");
      return cents;
    }
  }
}

// —— Champs de l'évènement et préremplissage (CRM-09, D7) ————————————————————————————————

export type EventFieldValues = Record<QuestionEventField, QuestionnaireAnswerValue | null>;

function sameValue(a: QuestionnaireAnswerValue, b: QuestionnaireAnswerValue): boolean {
  if (typeof a === "string" && typeof b === "string") return a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");
  return JSON.stringify(a) === JSON.stringify(b);
}

export type KnownAnswer = { key: string; eventField: QuestionEventField | null; value: QuestionnaireAnswerValue };

// POR-07, CRM-09 — la vue de la personne : sa réponse ; sinon, une question déjà répondue dans un autre
// questionnaire de l'évènement (même question ou même champ) n'est pas reposée ; une question liée à
// un champ déjà rempli est proposée pré-remplie, à confirmer.
export function portalQuestions(questions: QuestionnaireQuestion[], own: Map<string, QuestionnaireAnswerValue>, elsewhere: KnownAnswer[], event: EventFieldValues): PortalQuestion[] {
  return questions.map((question) => {
    const answer = own.get(question.key) ?? null;
    if (answer !== null) return { ...question, answer, suggestion: null, answeredElsewhere: false };
    const answeredElsewhere = elsewhere.some((known) => known.key === question.key || (question.eventField !== null && known.eventField === question.eventField));
    const current = question.eventField ? event[question.eventField] : null;
    const suggestion = !answeredElsewhere && current !== null && fitsNature(question, current) ? current : null;
    return { ...question, answer: null, suggestion, answeredElsewhere };
  });
}

// Une valeur de la fiche ne se propose que si elle a la forme de la question (un style libre n'est
// pas proposé à une question à choix qui ne le contient pas).
function fitsNature(question: QuestionnaireQuestion, value: QuestionnaireAnswerValue): boolean {
  if (question.nature === "single_choice") return typeof value === "string" && question.choices.includes(value);
  if (question.nature === "number" || question.nature === "amount") return typeof value === "number";
  return typeof value === "string";
}

// Le questionnaire est-il complet ? Une question répondue ailleurs compte comme répondue.
export function unansweredCount(view: PortalQuestion[]): number {
  return view.filter((question) => question.answer === null && !question.answeredElsewhere).length;
}

export type PrefillAnswer = { key: string; label: string; eventField: QuestionEventField; value: QuestionnaireAnswerValue; resolution: "filled" | "applied" | "kept" | null };

export type PrefillPlan = {
  // Champs vides à remplir avec la réponse.
  fill: { key: string; eventField: QuestionEventField; value: QuestionnaireAnswerValue }[];
  // Réponses égales à la fiche : rien à faire, réglées d'office.
  same: string[];
  // Écarts à montrer à la planner (D7).
  differences: { key: string; label: string; eventField: QuestionEventField; answer: QuestionnaireAnswerValue; current: QuestionnaireAnswerValue }[];
};

export function prefillPlan(answers: PrefillAnswer[], event: EventFieldValues): PrefillPlan {
  const plan: PrefillPlan = { fill: [], same: [], differences: [] };
  const filledFields = new Set<QuestionEventField>();
  for (const answer of answers) {
    if (answer.resolution !== null) continue;
    const current = event[answer.eventField];
    if (current === null || current === "") {
      // Deux réponses pour un même champ vide : la première remplit, la seconde devient un écart.
      if (!filledFields.has(answer.eventField)) {
        plan.fill.push({ key: answer.key, eventField: answer.eventField, value: answer.value });
        filledFields.add(answer.eventField);
        continue;
      }
    }
    const reference = current ?? plan.fill.find((fill) => fill.eventField === answer.eventField)?.value ?? null;
    if (reference === null || sameValue(reference, answer.value)) plan.same.push(answer.key);
    else plan.differences.push({ key: answer.key, label: answer.label, eventField: answer.eventField, answer: answer.value, current: reference });
  }
  return plan;
}
