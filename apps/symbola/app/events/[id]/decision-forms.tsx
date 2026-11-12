"use client";

// Lot 27b (POR-03, BUD-07) — demander une décision au client : choisir entre les
// prestataires montrés d'un poste, valider une dépense, approuver le
// programme ; une note et une date de réponse souhaitée, facultatives.
import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { requestDecisionAction, type DecisionFormState } from "./decision-actions";

export type DecisionFormSlot = { id: string; label: string; options: number };
export type DecisionFormExpense = { lineId: string; label: string };

export function RequestDecisionForm({ eventId, slots, expenses, hasProgram }: { eventId: string; slots: DecisionFormSlot[]; expenses: DecisionFormExpense[]; hasProgram: boolean }) {
  const t = useTranslations("Decisions");
  const [state, formAction, pending] = useActionState(requestDecisionAction, {} as DecisionFormState);
  const kinds = [slots.length > 0 ? "option" : null, expenses.length > 0 ? "expense" : null, hasProgram ? "program" : null].filter((kind): kind is "option" | "expense" | "program" => kind !== null);
  const [kind, setKind] = useState(kinds[0] ?? "option");
  const ids = { kind: useId(), slot: useId(), line: useId(), note: useId(), due: useId() };
  if (kinds.length === 0) return <p className="muted">{t("nothingToRequest")}</p>;
  return (
    <form action={formAction} className="link-form">
      <h3>{t("requestTitle")}</h3>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor={ids.kind}>{t("kindLabel")}</label>
      <select id={ids.kind} name="kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
        {kinds.map((value) => (
          <option key={value} value={value}>
            {t(`kind.${value}`)}
          </option>
        ))}
      </select>
      {kind === "option" ? (
        <>
          <label htmlFor={ids.slot}>{t("slotLabel")}</label>
          <select id={ids.slot} name="slotId" required>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {t("slotOption", { label: slot.label, count: slot.options })}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {kind === "expense" ? (
        <>
          <label htmlFor={ids.line}>{t("expenseLabel")}</label>
          <select id={ids.line} name="lineId" required>
            {expenses.map((expense) => (
              <option key={expense.lineId} value={expense.lineId}>
                {expense.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label htmlFor={ids.note}>{t("noteLabel")}</label>
      <textarea id={ids.note} name="note" maxLength={500} rows={2} />
      <label htmlFor={ids.due}>{t("dueOnLabel")}</label>
      <input id={ids.due} type="date" name="dueOn" />
      <button type="submit" className="primary" disabled={pending}>
        {t("requestSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("requestSent")}</p> : null}
    </form>
  );
}
