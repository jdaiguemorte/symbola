import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { importStepHref } from "@/lib/import/wizard";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { QuestionsForm, type QuestionsFormModel } from "./questions-form";

// Lot 71c (HUB-14, BUD-01, EVT-01, EVT-05, CHR-01, CHR-02, UX-10 ; spécification du lot 71, § 5.3 ;
// maquette 07) — l'étape « Questions » : ce que le fichier ne dit pas, demandé une fois, chaque réponse
// avec ce qu'elle donnera en euros ou en nombre ; à droite, « Ce que Symbola a compris » (ou, pour la
// fiche d'un logiciel, « Ce qui sera écrit »). Aucune réponse n'est cochée d'avance ; aucune question ne
// renvoie au fichier. Les textes lus dans le fichier sont neutralisés à la lecture et rendus en texte.
export default async function ImportQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { wizard } = await importStepContext(importId);
  const view = wizard.questions;
  if (!view || !wizard.steps.some((step) => step.key === "questions")) redirect(importStepHref(importId, wizard.next));
  // L'étape vient après les colonnes : tant qu'elles ne sont pas faites, on y retourne.
  const before = wizard.steps.slice(0, wizard.steps.findIndex((step) => step.key === "questions"));
  const pending = before.find((step) => !step.done && step.key !== "file");
  if (pending) redirect(importStepHref(importId, pending.key));

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const money = (cents: number) => formatAmount(cents, locale);
  const day = (date: string) => formatCalendarDate(date, locale);
  const isTasks = view.entityType === "tasks";
  const notProvided = t("questions.notProvided");

  const model: QuestionsFormModel = {
    importId,
    locale,
    entityType: view.entityType,
    answers: view.answers ?? {},
    missing: view.missing,
    target: view.targetEvent
      ? {
          legend: t(isTasks ? "questions.targetLegendTasks" : "questions.targetLegend"),
          hint: t("questions.targetHint", { rows: view.rowCount }),
          options: view.targetEvent.options.map((option) => ({
            id: option.id,
            title: option.name,
            hint: `${option.eventDate ? day(option.eventDate) : t("questions.targetNoDate")} · ${option.budgetLines === 0 ? t("questions.targetBudgetEmpty") : t("questions.targetBudgetLines", { count: option.budgetLines })}`,
          })),
        }
      : null,
    deposits: view.deposits
      ? {
          legend: t("questions.depositsLegend", { column: view.deposits.header }),
          hint: t("questions.depositsHint", { count: view.deposits.rows.length, from: day(view.deposits.dates.from), to: day(view.deposits.dates.to) }),
          yes: t("questions.moneyFigures", { paid: money(view.deposits.figures.yes.paidCents), due: money(view.deposits.figures.yes.dueCents), late: view.deposits.figures.yes.lateCount }),
          no: t("questions.moneyFigures", { paid: money(view.deposits.figures.no.paidCents), due: money(view.deposits.figures.no.dueCents), late: view.deposits.figures.no.lateCount }),
          // « Certains seulement » : le total suit les coches (montants en centimes, échéances passées).
          base: view.deposits.figures.no,
          rows: view.deposits.rows.map((row) => ({
            rowIndex: row.rowIndex,
            title: [row.slotLabel, row.vendorName].filter(Boolean).join(" · ") || t("questions.lineNumber", { line: row.lineNumber }),
            hint: `${money(row.amountCents)} · ${day(row.dueOn)}`,
            amountCents: row.amountCents,
            late: row.dueOn < view.today,
          })),
        }
      : null,
    contracts: view.contracts
      ? {
          hint: t("questions.contractsHint", { count: view.contracts.vendors.length }),
          all: t("questions.contractsAllHint", { count: view.contracts.vendors.length }),
          none: t("questions.contractsNoneHint", { count: view.contracts.vendors.length }),
          vendors: view.contracts.vendors.map((vendor) => ({ name: vendor.name, rowIndexes: vendor.rowIndexes })),
        }
      : null,
    eventType: view.eventType,
    onlyEventType: view.onlyEventType ? t("questions.onlyEventType", { type: view.onlyEventType }) : null,
    eventStage: view.eventStage,
    prospectSource: view.prospectSource,
    pastDue: view.pastDue
      ? {
          legend: t("questions.pastDueLegend", { count: view.pastDue.tasks.length }),
          hint: t("questions.pastDueHint", { tasks: view.pastDue.tasks.map((task) => t("questions.pastDueTask", { label: task.label, date: day(task.dueDate) })).join(", ") }),
          keep: t("questions.pastDueKeepHint", { count: view.pastDue.tasks.length }),
          redate: t("questions.pastDueRedateHint", { count: view.pastDue.tasks.length }),
          done: t("questions.pastDueDoneHint", { done: view.pastDue.doneCount + view.pastDue.tasks.length, before: view.pastDue.doneCount }),
          today: view.today,
        }
      : null,
    sheet: view.sheets.length > 0,
  };

  const understood = view.understood.map((line) => {
    switch (line.key) {
      case "carriedSlot":
        return { file: t("questions.understood.carriedSlotFile"), symbola: t("questions.understood.carriedSlot", { count: line.count }) };
      case "balances":
        return { file: t("questions.understood.balancesFile"), symbola: t(line.upcoming ? "questions.understood.balancesUpcoming" : "questions.understood.balances", { count: line.count, from: day(line.from), to: day(line.to) }) };
      case "actualEmpty":
        return { file: t("questions.understood.actualEmptyFile"), symbola: t("questions.understood.actualEmpty", { count: line.count }) };
      case "vendorsRetained":
        return { file: t("questions.understood.vendorsRetainedFile"), symbola: t("questions.understood.vendorsRetained", { count: line.count }) };
      case "taskDone":
        return { file: t("questions.understood.taskDoneFile"), symbola: t("questions.understood.taskDone", { count: line.count }) };
      case "taskTodo":
        return { file: t("questions.understood.taskTodoFile"), symbola: t("questions.understood.taskTodo", { count: line.count }) };
      case "taskPlanner":
        return { file: t("questions.understood.whoFile", { words: line.values.map((value) => `« ${value} »`).join(", ") }), symbola: t("questions.understood.taskPlanner") };
      case "taskClients":
        return { file: t("questions.understood.whoFile", { words: line.values.map((value) => `« ${value} »`).join(", ") }), symbola: t("questions.understood.taskClients") };
      case "taskDue":
        return { file: t("questions.understood.taskDueFile"), symbola: t("questions.understood.taskDue", { from: day(line.from), to: day(line.to) }) };
    }
  });

  const fixed = view.fixedEvent
    ? t(view.fixedEvent.fromTakeover ? "questions.fixedFromTakeover" : "questions.fixedFromEvent", {
        event: view.fixedEvent.name,
        date: view.fixedEvent.eventDate ? day(view.fixedEvent.eventDate) : t("questions.targetNoDate"),
      })
    : null;
  const previousStep = wizard.steps.filter((step) => step.key !== "confirm" && step.key !== "questions" && step.key !== "matches" && step.key !== "file").at(-1)?.key ?? null;
  const asInFile = view.sheets.flatMap((sheet) => sheet.clients.filter((client) => client.asInFile !== client.written).map((client) => `« ${client.asInFile} »`));

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="questions" abandon={wantsAbandon(await searchParams)} />
      <ScreenHelp title={tHelp("importQuestions.title")} body={tHelp("importQuestions.body")} />
      {fixed ? <p className="import-fixed-event">{fixed}</p> : null}
      <div className="import-questions">
        <QuestionsForm model={model} />
        <aside className="import-understood card" aria-labelledby="understood-title">
          {view.sheets.length > 0 ? (
            <>
              <h2 id="understood-title">{t("questions.writtenTitle")}</h2>
              {view.sheets.map((sheet) => (
                <dl key={sheet.rowIndex} className="import-written">
                  <div>
                    <dt>{t("questions.writtenClients")}</dt>
                    <dd>
                      {sheet.clients.map((client) => client.written).join(" · ") || notProvided}
                      {asInFile.length > 0 && view.answers?.nameCase !== "keep" ? <span className="meta"> {t("questions.writtenAsInFile", { values: asInFile.join(", ") })}</span> : null}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("questions.writtenDate")}</dt>
                    <dd>{sheet.eventDate ? day(sheet.eventDate) : <span className="meta">{notProvided}</span>}</dd>
                  </div>
                  <div>
                    <dt>{t("questions.writtenPlaces")}</dt>
                    <dd>{sheet.places.length > 0 ? sheet.places.join(" · ") : <span className="meta">{notProvided}</span>}</dd>
                  </div>
                  <div>
                    <dt>{t("questions.writtenWantedBudget")}</dt>
                    <dd>{sheet.wantedBudgetCents !== null ? money(sheet.wantedBudgetCents) : <span className="meta">{notProvided}</span>}</dd>
                  </div>
                  <div>
                    <dt>{t("questions.writtenActual")}</dt>
                    <dd>
                      {sheet.totalCents !== null ? (
                        <>
                          {t("questions.writtenActualValue", { total: money(sheet.totalCents), paid: money(sheet.paidCents ?? 0) })}
                          <span className="meta"> {t("questions.writtenActualHint")}</span>
                        </>
                      ) : (
                        <span className="meta">{notProvided}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("questions.writtenNotes")}</dt>
                    <dd>{sheet.note ?? <span className="meta">{notProvided}</span>}</dd>
                  </div>
                </dl>
              ))}
              <p className="meta">{t("questions.notImported")}</p>
            </>
          ) : (
            <>
              <h2 id="understood-title">{t("questions.understoodTitle")}</h2>
              {understood.length > 0 ? (
                <table className="import-understood-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("questions.colFile")}</th>
                      <th scope="col">{t("questions.colSymbola")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {understood.map((line, index) => (
                      <tr key={index}>
                        <th scope="row">{line.file}</th>
                        <td>{line.symbola}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <p className="meta">{t(isTasks ? "questions.tasksFooter" : "questions.amountsNote")}</p>
            </>
          )}
        </aside>
      </div>
      <ActionBar label={t("actionBarLabel")} backHref={previousStep ? importStepHref(importId, previousStep) : null} backLabel={t("back")}>
        <button type="submit" form="questions-form">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
