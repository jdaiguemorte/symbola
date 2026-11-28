"use client";

// Lot 74b (EVT-01, CHR-01, CHR-02, UX-06 ; B7, L74-D2 ; page 23 des maquettes du lot 68) — l'étape 2 de
// « Nouvel évènement » : les tâches du rétroplanning dont l'échéance tombe avant aujourd'hui. Chacune avec la
// date qu'elle aurait eue et qui la porte, et deux réponses en bascule (« Déjà fait », « À faire », M8), rien
// de coché ; deux raccourcis répondent pour toutes. Les tâches à faire sont réparties sur la période choisie
// (4 semaines proposé) ; la date de chacune s'écrit sous elle. Une tâche sans réponse est créée « à dater ».
// Le calcul est celui du module events (packages/contracts, past-due.ts) : le compte annoncé est celui
// qu'on retrouve (P-07).
import { useLocale } from "next-intl";
import { usePastDueTranslator, type PastDueMessages } from "./past-due-messages";
import { formatShortCalendarDate, type Locale } from "@symbola/i18n";
import { PAST_DUE_SPREADS, pastDueOutcomes, type PastDueSpread, type PastDueTaskAnswer } from "@symbola/contracts";

export type PastDueItem = { id: string; label: string; offsetDays: number; responsible: "planner" | "clients" };

export function PastDueStep({
  items,
  eventDate,
  today,
  holidays,
  heading,
  answers,
  onAnswer,
  spread,
  onSpread,
  messages,
}: {
  // Les tâches du modèle, dans son ordre (écart, puis position).
  items: PastDueItem[];
  eventDate: string;
  today: string;
  holidays: readonly string[];
  // « Léa & Maxime, sam. 12 juin 2027 ».
  heading: string;
  answers: Record<string, PastDueTaskAnswer>;
  onAnswer: (next: Record<string, PastDueTaskAnswer>) => void;
  spread: PastDueSpread;
  onSpread: (spread: PastDueSpread) => void;
  messages: PastDueMessages;
}) {
  const t = usePastDueTranslator(messages);
  const locale = useLocale() as Locale;
  const holidaySet = new Set(holidays);
  const outcomes = pastDueOutcomes(items, { eventDate, today, answers, spread, holidays: holidaySet });
  const past = outcomes.filter((outcome) => outcome.past);
  const byId = new Map(items.map((item) => [item.id, item]));
  const done = past.filter((outcome) => answers[outcome.id] === "done").length;
  const todo = past.filter((outcome) => answers[outcome.id] === "todo").length;
  const unanswered = past.length - done - todo;
  const date = (day: string) => formatShortCalendarDate(day, locale);
  const all = (answer: PastDueTaskAnswer) => onAnswer(Object.fromEntries(past.map((outcome) => [outcome.id, answer])));
  // La période de chaque répartition, pour les tâches à faire (« du lun. 30 nov. au mar. 22 déc. »).
  const range = (choice: PastDueSpread): string | null => {
    if (choice === "undated" || todo === 0) return null;
    const dated = pastDueOutcomes(items, { eventDate, today, answers, spread: choice, holidays: holidaySet }).flatMap((outcome) => (outcome.past && outcome.kind === "dated" ? [outcome.dueDate] : []));
    return dated.length > 0 ? t("spreadRange", { from: date(dated[0]!), to: date(dated[dated.length - 1]!) }) : null;
  };

  return (
    <section className="past-due-step" aria-labelledby="past-due-title">
      <p className="meta">{t("stepLabel", { heading })}</p>
      <h2 id="past-due-title">{t("title", { count: past.length })}</h2>
      <p>{t("intro")}</p>
      <div className="past-due-shortcuts">
        <button type="button" className="button-link" onClick={() => all("done")}>
          {t("allDone")}
        </button>
        <button type="button" className="button-link" onClick={() => all("todo")}>
          {t("allTodo")}
        </button>
      </div>
      <p className="meta" aria-live="polite">
        {t("counts", { done, todo, unanswered })}
      </p>
      <ul className="past-due-list">
        {past.map((outcome) => {
          const item = byId.get(outcome.id)!;
          const answer = answers[outcome.id];
          const result = outcome.kind === "done" ? t("resultDone") : outcome.kind === "dated" ? t("resultRedated", { date: date(outcome.dueDate) }) : t("resultUndated");
          return (
            <li key={outcome.id}>
              <fieldset className="past-due-task">
                <legend>{item.label}</legend>
                <p className="meta">
                  {t("planned", { date: date(outcome.templateDate) })} · {item.responsible === "clients" ? t("withClients") : t("you")}
                  {answer ? ` · ${result}` : null}
                </p>
                <div className="segmented-radio past-due-toggle">
                  {(["done", "todo"] as const).map((value) => (
                    <label key={value}>
                      <input type="radio" name={`pastDue:${outcome.id}`} value={value} checked={answer === value} onChange={() => onAnswer({ ...answers, [outcome.id]: value })} />
                      {value === "done" ? t("answerDone") : t("answerTodo")}
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <fieldset className="past-due-spread">
        <legend>{t("spreadLegend", { count: todo })}</legend>
        {PAST_DUE_SPREADS.map((choice) => (
          <label key={choice} className="standing-option">
            <input type="radio" name="pastDueSpread" value={choice} checked={spread === choice} onChange={() => onSpread(choice)} />
            <span>
              <strong>{t(`spread.${choice}`)}</strong>
              <span className="meta">{choice === "undated" ? t("spreadUndatedHint") : range(choice)}</span>
            </span>
          </label>
        ))}
        <p className="meta">{t("spreadRule")}</p>
      </fieldset>
      <p className="meta">{t("unansweredRule")}</p>
    </section>
  );
}
