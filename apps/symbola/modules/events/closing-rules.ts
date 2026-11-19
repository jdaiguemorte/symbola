// Lot 58 (PAR-09 ; D4 ; ADR 0097) — règles pures de la clôture d'un évènement, sans base : la liste de
// clôture et l'état de chaque étape, les leçons, les frais propres de la planner et le temps passé.
// Le temps passé est déclaratif et facultatif : son étape n'est jamais « à faire », elle reste
// « facultative » tant qu'il n'est pas saisi (aucun rappel, aucune case rouge).
export const CLOSING_STEPS = ["balance_invoice", "vendor_payments", "commissions", "evaluations", "time_spent", "lessons", "review_request"] as const;
export type ClosingStep = (typeof CLOSING_STEPS)[number];
export type ClosingStepStatus = "done" | "todo" | "optional" | "unavailable";

// Les faits lus aux modules (null : module non souscrit, l'étape est « indisponible », ARC-07).
export type ClosingFacts = {
  balanceToInvoice: number | null;
  vendorPaymentsLeft: number | null;
  commissionsToInvoice: number | null;
  vendorsToEvaluate: number | null;
  timeSpentMinutes: number | null;
  lessons: number;
  reviewRequested: boolean;
  // Étapes cochées à la main par la planner (« fait ailleurs »).
  checked: readonly ClosingStep[];
};

export type ClosingItem = { step: ClosingStep; status: ClosingStepStatus; count: number | null };

function counted(step: ClosingStep, count: number | null, checked: readonly ClosingStep[]): ClosingItem {
  if (count === null) return { step, status: "unavailable", count: null };
  return { step, status: count === 0 || checked.includes(step) ? "done" : "todo", count };
}

export function closingChecklist(facts: ClosingFacts): ClosingItem[] {
  return [
    counted("balance_invoice", facts.balanceToInvoice, facts.checked),
    counted("vendor_payments", facts.vendorPaymentsLeft, facts.checked),
    counted("commissions", facts.commissionsToInvoice, facts.checked),
    counted("evaluations", facts.vendorsToEvaluate, facts.checked),
    { step: "time_spent", status: facts.timeSpentMinutes === null ? "optional" : "done", count: null },
    { step: "lessons", status: facts.lessons > 0 || facts.checked.includes("lessons") ? "done" : "todo", count: facts.lessons },
    { step: "review_request", status: facts.reviewRequested || facts.checked.includes("review_request") ? "done" : "todo", count: null },
  ];
}

// La clôture se valide quand rien n'est « à faire » (le temps passé n'en fait jamais partie).
export function closingComplete(items: ClosingItem[]): boolean {
  return items.every((item) => item.status !== "todo");
}

export class ClosingInputError extends Error {
  constructor(readonly field: "lessons" | "expenses" | "time_spent" | "steps") {
    super(`clôture : ${field} invalide`);
    this.name = "ClosingInputError";
  }
}

export const LESSON_MAX_LENGTH = 500;
export const EXPENSE_LABEL_MAX_LENGTH = 120;
export const EXPENSE_MAX_CENTS = 100_000_000;
export const TIME_SPENT_MAX_MINUTES = 6_000 * 60;

export function cleanLessons(lessons: readonly string[], limit: number): string[] {
  const cleaned = lessons.map((lesson) => lesson.replace(/\r\n/g, "\n").trim()).filter((lesson) => lesson.length > 0);
  if (cleaned.length > limit || cleaned.some((lesson) => lesson.length > LESSON_MAX_LENGTH)) throw new ClosingInputError("lessons");
  return cleaned;
}

export type OwnExpense = { label: string; amountCents: number };

// D4 : les frais propres de la planner (déplacements, sous-traitance), saisis librement, hors du budget
// du client ; montants HT en centimes entiers.
export function cleanOwnExpenses(expenses: readonly OwnExpense[], limit: number): OwnExpense[] {
  const cleaned = expenses.map((expense) => ({ label: expense.label.replace(/\s+/g, " ").trim(), amountCents: expense.amountCents }));
  if (cleaned.length > limit) throw new ClosingInputError("expenses");
  for (const expense of cleaned) {
    if (expense.label.length < 1 || expense.label.length > EXPENSE_LABEL_MAX_LENGTH) throw new ClosingInputError("expenses");
    if (!Number.isInteger(expense.amountCents) || expense.amountCents <= 0 || expense.amountCents > EXPENSE_MAX_CENTS) throw new ClosingInputError("expenses");
  }
  return cleaned;
}

export function cleanTimeSpent(minutes: number | null): number | null {
  if (minutes === null) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > TIME_SPENT_MAX_MINUTES) throw new ClosingInputError("time_spent");
  return minutes;
}

export function cleanCheckedSteps(steps: readonly string[]): ClosingStep[] {
  const unique = [...new Set(steps)];
  if (unique.some((step) => !(CLOSING_STEPS as readonly string[]).includes(step) || step === "time_spent")) throw new ClosingInputError("steps");
  return unique as ClosingStep[];
}

// « 12 h 30 » saisi en heures décimales ou en heures et minutes : la planner tape « 12,5 » ou « 12:30 ».
export function parseHours(value: string): number | null {
  const text = value.trim();
  if (text === "") return null;
  const clock = /^(\d{1,4})\s*[:h]\s*(\d{1,2})$/i.exec(text);
  if (clock) {
    const minutes = Number(clock[2]);
    if (minutes > 59) throw new ClosingInputError("time_spent");
    return cleanTimeSpent(Number(clock[1]) * 60 + minutes);
  }
  if (!/^\d{1,4}(?:[.,]\d{1,2})?$/.test(text)) throw new ClosingInputError("time_spent");
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return cleanTimeSpent(Number(whole) * 60 + Math.round((Number(`0.${fraction || "0"}`) * 60)));
}
