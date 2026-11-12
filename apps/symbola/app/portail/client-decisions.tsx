import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import type { EventDecision } from "@/modules/events/service";
import { choiceName, decisionLabel } from "./decision-label";
import { DecisionAnswerForm } from "./decision-answer-form";

// Lot 27b (POR-03, BUD-07, EVT-09) — « À décider » : les décisions en attente de
// ses rubriques, et « Vos décisions » : celles déjà répondues, avec qui et
// quand (lisibles des deux côtés). Le programme approuvé puis modifié est signalé.
export async function ClientDecisions({ decisions, locale, preview = false }: { decisions: EventDecision[]; locale: Locale; preview?: boolean }) {
  const t = await getTranslations("Decisions");
  const pending = decisions.filter((decision) => decision.status === "pending");
  const answered = decisions.filter((decision) => decision.status === "approved" || decision.status === "declined").reverse();
  const label = (decision: EventDecision) => decisionLabel(t, decision, locale);
  return (
    <section aria-labelledby="client-decisions-title" id="decisions">
      <h2 id="client-decisions-title">{t("toDecideTitle")}</h2>
      {pending.length === 0 ? <p>{t("nothingToDecide")}</p> : null}
      <ul className="item-list">
        {pending.map((decision) => (
          <li key={decision.id}>
            <p>
              <strong>{label(decision)}</strong>
            </p>
            {decision.dueOn ? <p className="muted">{t("dueOn", { date: formatCalendarDate(decision.dueOn, locale) })}</p> : null}
            {decision.note ? <p>{decision.note}</p> : null}
            <DecisionAnswerForm
              decisionId={decision.id}
              snapshot={decision.snapshot}
              label={label(decision)}
              amounts={Object.fromEntries(decision.snapshot.kind === "option" ? decision.snapshot.options.filter((option) => option.quoteAmountCents !== null).map((option) => [option.candidateId, formatAmount(option.quoteAmountCents!, locale)]) : [])}
              preview={preview}
            />
          </li>
        ))}
      </ul>
      {answered.length > 0 ? (
        <>
          <h3>{t("yourDecisionsTitle")}</h3>
          <ul className="item-list" aria-label={t("yourDecisionsTitle")}>
            {answered.map((decision) => (
              <li key={decision.id}>
                <p>{answerSentence(t, decision, label(decision), locale)}</p>
                {decision.comment ? <p className="muted">{t("answeredComment", { comment: decision.comment })}</p> : null}
                {decision.programChanged ? <p className="badge-warning">{t("programChanged", { date: formatCalendarDate(decision.decidedAt!.slice(0, 10), locale) })}</p> : null}
                {decision.replacedById ? <p className="muted">{t("replaced")}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"Decisions">>>;

// « Traiteur : Maison Haddad, choisi par Léa Martin le 3 mars 2027 à 10 h 12 ».
export function answerSentence(t: Translate, decision: EventDecision, label: string, locale: Locale): string {
  const values = { label, name: decision.decidedByName ?? t("someone"), at: formatDateTime(new Date(decision.decidedAt!), locale) };
  if (decision.snapshot.kind === "option" && decision.status === "approved") return t("answeredChoice", { ...values, choice: choiceName(decision) ?? "" });
  return t(decision.status === "approved" ? "answeredApproved" : "answeredDeclined", values);
}
