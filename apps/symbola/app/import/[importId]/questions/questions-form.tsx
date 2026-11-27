"use client";

// Lot 71c (HUB-14, UX-10 ; maquette 07) — les questions de l'étape, une par bloc, aucune réponse cochée
// d'avance (R5). Chaque réponse dit ce qu'elle donnera ; « Certains seulement » et « Ligne par ligne »
// cochent ligne par ligne, et le total suit. « Continuer » sans réponse écrit sous la question ce qui
// manque (forme du lot 70b) ; les autres choix restent.
import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImportAnswers } from "@symbola/contracts";
import { formatAmount, type Locale } from "@symbola/i18n";
import { FieldError } from "@/app/ui/field-error";
import type { MissingAnswer, MoneyFigures } from "@/lib/import/question-rules";
import { saveQuestionsAction, type QuestionsFormState } from "./actions";

export type QuestionsFormModel = {
  importId: string;
  locale: Locale;
  entityType: string;
  answers: ImportAnswers;
  missing: MissingAnswer[];
  target: { legend: string; hint: string; options: { id: string; title: string; hint: string }[] } | null;
  deposits: {
    legend: string;
    hint: string;
    yes: string;
    no: string;
    base: MoneyFigures;
    rows: { rowIndex: number; title: string; hint: string; amountCents: number; late: boolean }[];
  } | null;
  contracts: { hint: string; all: string; none: string; vendors: { name: string; rowIndexes: number[] }[] } | null;
  eventType: { options: { id: string; label: string }[] } | null;
  onlyEventType: string | null;
  eventStage: boolean;
  prospectSource: { options: { id: string; label: string }[] } | null;
  pastDue: { legend: string; hint: string; keep: string; redate: string; done: string; today: string } | null;
  sheet: boolean;
};

function Choice({ name, value, checked, onChange, title, hint, describedBy }: { name: string; value: string; checked: boolean; onChange: (value: string) => void; title: string; hint?: string | null; describedBy?: string }) {
  return (
    <label className="standing-option">
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} aria-describedby={describedBy} />
      <span>
        <strong>{title}</strong>
        {hint ? <span className="meta">{hint}</span> : null}
      </span>
    </label>
  );
}

export function QuestionsForm({ model }: { model: QuestionsFormModel }) {
  const t = useTranslations("Import");
  const initial: QuestionsFormState = { missing: [] };
  const [state, formAction, pending] = useActionState(saveQuestionsAction, initial);
  const answers = model.answers;
  const [target, setTarget] = useState(answers.newEvent ? "new" : (answers.targetEvent ?? ""));
  const [deposits, setDeposits] = useState<string>(answers.depositsPaid?.answer ?? "");
  const [paidRows, setPaidRows] = useState<Set<number>>(new Set(answers.depositsPaid?.paidRows ?? []));
  const [contracts, setContracts] = useState<string>(answers.contracts?.answer ?? "");
  const [signedRows, setSignedRows] = useState<Set<number>>(new Set(answers.contracts?.signedRows ?? []));
  const [eventType, setEventType] = useState(answers.eventTypeId ?? "");
  const [stage, setStage] = useState<string>(answers.eventStage ?? "");
  const [pastDue, setPastDue] = useState<string>(answers.pastDueTasks?.answer ?? "");
  const money = (cents: number) => formatAmount(cents, model.locale);

  const errorOf = (key: MissingAnswer["key"]) => {
    const entry = state.missing.find((item) => item.key === key);
    if (!entry) return undefined;
    if (entry.code === "name_required") return t("questions.errors.nameRequired");
    if (entry.code === "date_required") return t("questions.errors.pastDueDateRequired");
    if (entry.code === "date_past") return t("questions.errors.pastDueDatePast");
    return t(`questions.errors.choose.${key}`, { what: model.entityType === "tasks" ? "tasks" : "budget" });
  };
  const errorId = (key: string) => `question-${key}-error`;
  const invalid = (key: MissingAnswer["key"]) => (errorOf(key) ? { "aria-invalid": true as const } : {});

  // « Certains seulement » : réglé et en retard suivent les coches.
  const someFigures = useMemo(() => {
    if (!model.deposits) return null;
    let paid = model.deposits.base.paidCents;
    let due = model.deposits.base.dueCents;
    let late = model.deposits.base.lateCount;
    for (const row of model.deposits.rows) {
      if (!paidRows.has(row.rowIndex)) continue;
      paid += row.amountCents;
      due -= row.amountCents;
      if (row.late) late -= 1;
    }
    return { paid, due, late, count: model.deposits.rows.filter((row) => paidRows.has(row.rowIndex)).length };
  }, [model.deposits, paidRows]);

  const toggle = (set: Set<number>, rows: number[], on: boolean) => {
    const next = new Set(set);
    for (const row of rows) {
      if (on) next.add(row);
      else next.delete(row);
    }
    return next;
  };
  const signedVendors = model.contracts ? model.contracts.vendors.filter((vendor) => vendor.rowIndexes.some((row) => signedRows.has(row))).length : 0;

  return (
    <form action={formAction} id="questions-form" className="stack import-questions-form" noValidate aria-busy={pending}>
      <input type="hidden" name="importId" value={model.importId} />
      {state.missing.length > 1 ? (
        <p role="alert" className="field-error">
          <span className="field-error-icon" aria-hidden="true">
            !
          </span>
          {t("questions.errors.summary", { count: state.missing.length })}
        </p>
      ) : null}
      {state.error ? <p role="alert">{state.error}</p> : null}

      {model.target ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("targetEvent") ? errorId("targetEvent") : undefined}>
          <legend>{model.target.legend}</legend>
          <p className="meta">{model.target.hint}</p>
          {model.target.options.map((option) => (
            <Choice key={option.id} name="targetEvent" value={option.id} checked={target === option.id} onChange={setTarget} title={option.title} hint={option.hint} />
          ))}
          <Choice name="targetEvent" value="new" checked={target === "new"} onChange={setTarget} title={t("questions.targetNew")} hint={t("questions.targetNewHint")} />
          {target === "new" ? (
            <div className="stack import-new-event">
              <label>
                {t("questions.newEventName")}
                <input type="text" name="newEventName" maxLength={200} autoComplete="off" defaultValue={answers.newEvent?.name ?? ""} {...invalid("targetEvent")} />
              </label>
              <label>
                {t("questions.newEventDate")}
                <input type="date" name="newEventDate" defaultValue={answers.newEvent?.eventDate ?? ""} />
              </label>
            </div>
          ) : null}
          <FieldError id={errorId("targetEvent")} message={errorOf("targetEvent")} />
        </fieldset>
      ) : null}

      {model.deposits ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("depositsPaid") ? errorId("depositsPaid") : undefined}>
          <legend>{model.deposits.legend}</legend>
          <p className="meta">{model.deposits.hint}</p>
          <Choice name="depositsPaid" value="yes" checked={deposits === "yes"} onChange={setDeposits} title={t("questions.depositsYes")} hint={`${t("questions.depositsYesHint")} ${model.deposits.yes}`} />
          <Choice name="depositsPaid" value="no" checked={deposits === "no"} onChange={setDeposits} title={t("questions.depositsNo")} hint={`${t("questions.depositsNoHint")} ${model.deposits.no}`} />
          <Choice name="depositsPaid" value="some" checked={deposits === "some"} onChange={setDeposits} title={t("questions.depositsSome")} hint={t("questions.depositsSomeHint")} />
          {deposits === "some" && someFigures ? (
            <fieldset className="stack import-question-rows">
              <legend>{t("questions.depositsSomeLegend")}</legend>
              {model.deposits.rows.map((row) => (
                <label key={row.rowIndex} className="import-question-row">
                  <input type="checkbox" name="depositPaidRow" value={row.rowIndex} checked={paidRows.has(row.rowIndex)} onChange={(event) => setPaidRows(toggle(paidRows, [row.rowIndex], event.target.checked))} />
                  <span>
                    <strong>{row.title}</strong>
                    <span className="meta">{row.hint}</span>
                  </span>
                </label>
              ))}
              <p role="status" className="import-question-total">
                {t("questions.depositsSomeTotal", { count: someFigures.count, total: model.deposits.rows.length })} · {t("questions.moneyFigures", { paid: money(someFigures.paid), due: money(someFigures.due), late: someFigures.late })}
              </p>
            </fieldset>
          ) : null}
          <FieldError id={errorId("depositsPaid")} message={errorOf("depositsPaid")} />
        </fieldset>
      ) : null}

      {model.contracts ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("contracts") ? errorId("contracts") : undefined}>
          <legend>{t("questions.contractsLegend")}</legend>
          <p className="meta">{model.contracts.hint}</p>
          <Choice name="contracts" value="all" checked={contracts === "all"} onChange={setContracts} title={t("questions.contractsAll")} hint={model.contracts.all} />
          <Choice name="contracts" value="none" checked={contracts === "none"} onChange={setContracts} title={t("questions.contractsNone")} hint={model.contracts.none} />
          <Choice name="contracts" value="per_line" checked={contracts === "per_line"} onChange={setContracts} title={t("questions.contractsPerLine")} hint={t("questions.contractsPerLineHint")} />
          {contracts === "per_line" ? (
            <fieldset className="stack import-question-rows">
              <legend>{t("questions.contractsPerLineLegend")}</legend>
              {model.contracts.vendors.map((vendor) => (
                <label key={vendor.name} className="import-question-row">
                  <input
                    type="checkbox"
                    name="contractSignedRows"
                    value={vendor.rowIndexes.join(",")}
                    checked={vendor.rowIndexes.some((row) => signedRows.has(row))}
                    onChange={(event) => setSignedRows(toggle(signedRows, vendor.rowIndexes, event.target.checked))}
                  />
                  <span>
                    <strong>{vendor.name}</strong>
                  </span>
                </label>
              ))}
              <p role="status" className="import-question-total">
                {t("questions.contractsPerLineTotal", { signed: signedVendors, unsigned: model.contracts.vendors.length - signedVendors })}
              </p>
            </fieldset>
          ) : null}
          <FieldError id={errorId("contracts")} message={errorOf("contracts")} />
        </fieldset>
      ) : null}

      {model.onlyEventType ? <p className="import-fixed-event">{model.onlyEventType}</p> : null}
      {model.eventType ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("eventType") ? errorId("eventType") : undefined}>
          <legend>{t("questions.eventTypeLegend")}</legend>
          <p className="meta">{t("questions.eventTypeHint")}</p>
          {model.eventType.options.map((option) => (
            <Choice key={option.id} name="eventTypeId" value={option.id} checked={eventType === option.id} onChange={setEventType} title={option.label} />
          ))}
          <FieldError id={errorId("eventType")} message={errorOf("eventType")} />
        </fieldset>
      ) : null}

      {model.eventStage ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("eventStage") ? errorId("eventStage") : undefined}>
          <legend>{t("questions.stageLegend")}</legend>
          <p className="meta">{t("questions.stageHint")}</p>
          <Choice name="eventStage" value="enquiry" checked={stage === "enquiry"} onChange={setStage} title={t("questions.stageEnquiry")} hint={t("questions.stageEnquiryHint")} />
          <Choice name="eventStage" value="signed" checked={stage === "signed"} onChange={setStage} title={t("questions.stageSigned")} hint={t("questions.stageSignedHint")} />
          <FieldError id={errorId("eventStage")} message={errorOf("eventStage")} />
        </fieldset>
      ) : null}

      {model.prospectSource ? (
        <div className="card stack">
          <label>
            {t("questions.sourceLegend")}
            <select name="prospectSourceId" defaultValue={answers.prospectSourceId ?? ""}>
              <option value="">{t("questions.sourceNone")}</option>
              {model.prospectSource.options.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <p className="meta">{t("questions.sourceHint")}</p>
        </div>
      ) : null}

      {model.sheet ? (
        <label className="import-keep-case">
          <input type="checkbox" name="nameCase" value="keep" defaultChecked={answers.nameCase === "keep"} />
          {t("questions.keepCapitals")}
        </label>
      ) : null}

      {model.pastDue ? (
        <fieldset className="standing-choice card" aria-describedby={errorOf("pastDueTasks") ? errorId("pastDueTasks") : undefined}>
          <legend>{model.pastDue.legend}</legend>
          <p className="meta">{model.pastDue.hint}</p>
          <Choice name="pastDueTasks" value="keep" checked={pastDue === "keep"} onChange={setPastDue} title={t("questions.pastDueKeep")} hint={model.pastDue.keep} />
          <Choice name="pastDueTasks" value="redate" checked={pastDue === "redate"} onChange={setPastDue} title={t("questions.pastDueRedate")} hint={model.pastDue.redate} />
          {pastDue === "redate" ? (
            <label className="import-new-event">
              {t("questions.pastDueDate")}
              <input type="date" name="pastDueDate" min={model.pastDue.today} defaultValue={answers.pastDueTasks?.date ?? ""} {...invalid("pastDueTasks")} />
            </label>
          ) : null}
          <Choice name="pastDueTasks" value="done" checked={pastDue === "done"} onChange={setPastDue} title={t("questions.pastDueDone")} hint={model.pastDue.done} />
          <FieldError id={errorId("pastDueTasks")} message={errorOf("pastDueTasks")} />
        </fieldset>
      ) : null}
    </form>
  );
}
