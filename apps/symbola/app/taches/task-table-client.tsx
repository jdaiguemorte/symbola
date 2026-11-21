"use client";

// Lot 63d (CHR-02, CHR-03, UX-07 ; recette du 21/11/2026, maquette M6) — le tableau des tâches, le même
// sur l'écran « Tâches » et dans le rétroplanning d'un évènement. Deux gestes distincts : le rond « Fait »
// (coche, « Annuler » dix secondes) et la case de sélection à gauche, avec « Tout sélectionner » dans
// l'en-tête. Sur la ligne : « Modifier » (ou un clic sur la ligne) ouvre la fenêtre de la tâche,
// « Reporter » (demain, dans une semaine, une date), « Supprimer » (tout de suite, « Annuler » dix
// secondes). L'échéance se change dans sa cellule. Des tâches choisies : décaler de N jours,
// responsable, catégorie, supprimer. La catégorie et la priorité s'écrivent toujours en toutes lettres.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";
import { TaskCheck } from "./task-check";
import { bulkTasksAction, deleteTaskAction, setTaskDueDateAction, type TaskRowState } from "./task-row-actions";
import { CategorySwatch } from "./category-swatch";

export type TaskTableRow = {
  id: string;
  eventId: string;
  label: string;
  dueDate: string;
  dueLabel: string;
  done: boolean;
  overdue: boolean;
  priority: "high" | "normal";
  category: { label: string; color: string } | null;
  responsibleLabel: string;
  responsibleKind: "planner" | "clients" | "vendor";
  event: { names: string; href: string } | null;
  // Adresse de l'écran courant qui ouvre la fenêtre de cette tâche.
  href: string;
};

export type TaskTableMonth = { key: string; label: string; rows: TaskTableRow[] };

type Option = { value: string; label: string };

// Un clic sur la ligne ouvre la fenêtre, sauf s'il vise un contrôle de la ligne.
function fromControl(event: MouseEvent): boolean {
  return (event.target as HTMLElement).closest("a, button, input, select, label, summary, details, form") !== null;
}

function DueCell({ row }: { row: TaskTableRow }) {
  const t = useTranslations("Events");
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(setTaskDueDateAction, {} as TaskRowState);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    try {
      input.current?.showPicker?.();
    } catch {
      // Le petit calendrier ne s'ouvre que sur un geste ; le champ reste saisissable au clavier.
    }
  }, [editing]);
  if (!editing) {
    return (
      <>
        <button type="button" className={`task-due${row.overdue ? " text-overdue" : ""}`} onClick={() => setEditing(true)} disabled={pending}>
          {/* Le texte visible ouvre le nom accessible (WCAG 2.5.3) ; la suite n'est lue que par le lecteur d'écran. */}
          {row.dueLabel}
          <span className="sr-only">{t("taskDueEdit", { label: row.label })}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </>
    );
  }
  return (
    <form ref={form} action={action} className="task-due-form" onSubmit={() => setEditing(false)}>
      <input type="hidden" name="taskId" value={row.id} />
      <input
        ref={input}
        type="date"
        name="dueDate"
        defaultValue={row.dueDate}
        aria-label={t("taskDueInput", { label: row.label })}
        onChange={(event) => {
          if (event.target.value && event.target.value !== row.dueDate) form.current?.requestSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      />
    </form>
  );
}

function PostponeMenu({ row, tomorrow, nextWeek }: { row: TaskTableRow; tomorrow: string; nextWeek: string }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(setTaskDueDateAction, {} as TaskRowState);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.success && menu.current) menu.current.open = false;
  }, [state]);
  return (
    <details className="row-menu" ref={menu}>
      <summary aria-label={t("taskPostponeLabel", { label: row.label })}>{t("taskPostpone")}</summary>
      <div className="row-menu-panel">
        <form action={action} className="row-menu-choices">
          <input type="hidden" name="taskId" value={row.id} />
          <button type="submit" name="postpone" value="tomorrow" className="button-ghost" disabled={pending}>
            {t("taskPostponeTomorrow", { date: tomorrow })}
          </button>
          <button type="submit" name="postpone" value="next_week" className="button-ghost" disabled={pending}>
            {t("taskPostponeNextWeek", { date: nextWeek })}
          </button>
        </form>
        <form action={action} className="row-menu-date">
          <input type="hidden" name="taskId" value={row.id} />
          <label>
            {t("taskPostponeDate")}
            <input type="date" name="dueDate" defaultValue={row.dueDate} />
          </label>
          <button type="submit" className="button-secondary" disabled={pending}>
            {t("taskPostponeApply")}
          </button>
        </form>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </div>
    </details>
  );
}

function ReopenButton({ row }: { row: TaskTableRow }) {
  const t = useTranslations("Events");
  return (
    <form action={toggleEventTaskAction}>
      <input type="hidden" name="eventId" value={row.eventId} />
      <input type="hidden" name="taskId" value={row.id} />
      <input type="hidden" name="done" value="false" />
      <button type="submit" className="button-secondary" aria-label={t("taskReopenLabel", { label: row.label })}>
        {t("taskReopen")}
      </button>
    </form>
  );
}

function BulkBar({ ids, categories, onClear, onDone }: { ids: string[]; categories: Option[]; onClear: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(bulkTasksAction, {} as TaskRowState);
  const [days, setDays] = useState("7");
  // Une action réussie vide la sélection (les lignes ont bougé, ou sont parties) ; son résultat reste
  // annoncé sous la barre, qui disparaît avec la sélection.
  useEffect(() => {
    if (!state.success) return;
    onDone(state.success);
    onClear();
  }, [state, onClear, onDone]);
  return (
    <>
      <form action={action} className="task-bulk" aria-label={t("tasksBulkLabel")}>
        {ids.map((id) => (
          <input key={id} type="hidden" name="taskIds" value={id} />
        ))}
        <strong className="task-bulk-count">{t("tasksBulkSelected", { count: ids.length })}</strong>
        <details className="row-menu">
          <summary>{t("tasksBulkShift")}</summary>
          <div className="row-menu-panel row-menu-date">
            <label>
              {t("tasksBulkDays")}
              <input type="number" name="days" min={-366} max={366} step={1} value={days} onChange={(event) => setDays(event.target.value)} />
            </label>
            <button type="submit" name="op" value="shift" className="button-secondary" disabled={pending}>
              {t("tasksBulkShiftApply")}
            </button>
          </div>
        </details>
        <details className="row-menu">
          <summary>{t("tasksBulkResponsible")}</summary>
          <div className="row-menu-panel row-menu-date">
            <label>
              {t("taskResponsible")}
              <select name="responsible" defaultValue="planner">
                <option value="planner">{t("responsiblePlanner")}</option>
                <option value="clients">{t("responsibleClients")}</option>
              </select>
            </label>
            <button type="submit" name="op" value="responsible" className="button-secondary" disabled={pending}>
              {t("tasksBulkApply")}
            </button>
          </div>
        </details>
        <details className="row-menu">
          <summary>{t("tasksBulkCategory")}</summary>
          <div className="row-menu-panel row-menu-date">
            <label>
              {t("taskCategory")}
              <select name="categoryId" defaultValue={categories[0]?.value ?? ""}>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
                <option value="">{t("taskNoCategory")}</option>
              </select>
            </label>
            <button type="submit" name="op" value="category" className="button-secondary" disabled={pending}>
              {t("tasksBulkApply")}
            </button>
          </div>
        </details>
        <button type="submit" name="op" value="delete" className="button-danger" disabled={pending}>
          {t("tasksBulkDelete", { count: ids.length })}
        </button>
        <button type="button" className="button-ghost" onClick={onClear}>
          {t("tasksBulkClear")}
        </button>
      </form>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </>
  );
}

export function TaskTableClient({
  months,
  caption,
  showEvent,
  selectedTaskId,
  categories,
  postponeDates,
  undoMessages,
}: {
  months: TaskTableMonth[];
  caption: string;
  showEvent: boolean;
  selectedTaskId: string | null;
  categories: Option[];
  postponeDates: { tomorrow: string; nextWeek: string };
  // Textes du bandeau « Annuler » d'une tâche cochée, par tâche (lot 39c).
  undoMessages: Record<string, { done: string; reopened: string }>;
}) {
  const t = useTranslations("Events");
  const router = useRouter();
  const allIds = useMemo(() => months.flatMap((month) => month.rows.map((row) => row.id)), [months]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Les lignes qui disparaissent (supprimées, filtrées) quittent la sélection.
  const shown = allIds.filter((id) => selected.has(id));
  const allSelected = allIds.length > 0 && shown.length === allIds.length;
  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = shown.length > 0 && !allSelected;
  }, [shown.length, allSelected]);
  const clear = useMemo(() => () => setSelected(new Set()), []);
  const [bulkMessage, setBulkMessage] = useState("");
  const done = useMemo(() => (message: string) => setBulkMessage(message), []);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns = 7;

  return (
    <div>
      {shown.length > 0 ? <BulkBar ids={shown} categories={categories} onClear={clear} onDone={done} /> : null}
      <div role="status" className="task-bulk-status">
        {shown.length === 0 ? bulkMessage : ""}
      </div>
      <div role="region" aria-label={t("taskTableRegion", { caption })} tabIndex={0}>
        <table className="data-table tasks-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="task-select-cell">
                <label className="task-select">
                  <input ref={selectAll} type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(allIds))} />
                  <span className="sr-only">{t("tasksSelectAll")}</span>
                </label>
              </th>
              <th scope="col">{t("taskColumnDone")}</th>
              <th scope="col">{t("taskColumnLabel")}</th>
              <th scope="col">{t("taskColumnCategory")}</th>
              <th scope="col">{t("taskColumnDue")}</th>
              <th scope="col">{t("taskColumnResponsible")}</th>
              <th scope="col">
                <span className="sr-only">{t("taskColumnActions")}</span>
              </th>
            </tr>
          </thead>
          {months.map((month) => (
            <tbody key={month.key}>
              <tr className="month-row">
                <th scope="colgroup" colSpan={columns}>
                  {month.label}
                </th>
              </tr>
              {month.rows.map((row) => (
                <tr
                  key={row.id}
                  className="tasks-table-row"
                  aria-current={row.id === selectedTaskId ? "true" : undefined}
                  data-selected={selected.has(row.id) ? "true" : undefined}
                  onClick={(event) => {
                    if (!fromControl(event)) router.push(row.href, { scroll: false });
                  }}
                >
                  <td className="task-select-cell">
                    <label className="task-select">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                      <span className="sr-only">{t("taskSelect", { label: row.label })}</span>
                    </label>
                  </td>
                  <td>
                    <TaskCheck
                      eventId={row.eventId}
                      taskId={row.id}
                      done={row.done}
                      labelDone={t("taskMarkDone", { label: row.label })}
                      labelUndone={t("taskMarkUndone", { label: row.label })}
                      doneMessage={undoMessages[row.id]?.done ?? ""}
                      reopenedMessage={undoMessages[row.id]?.reopened ?? ""}
                    />
                  </td>
                  <th scope="row" className="task-label-cell">
                    <Link href={row.href} scroll={false} className={row.done ? "done" : undefined}>
                      {row.label}
                    </Link>
                    {row.overdue ? <span className="badge badge-terracotta">{t("taskStatusOverdue")}</span> : null}
                    {row.priority === "high" ? <span className="badge badge-ambre">{t("taskPriorityHigh")}</span> : null}
                    {row.done ? <span className="badge badge-sauge">{t("taskStatusDone")}</span> : null}
                    {/* L'évènement en texte (maquette M6) : la fenêtre de la tâche mène à son rétroplanning. */}
                    {showEvent && row.event ? <span className="task-event">{row.event.names}</span> : null}
                  </th>
                  <td>
                    {row.category ? (
                      <span className="task-category">
                        <CategorySwatch color={row.category.color} />
                        {row.category.label}
                      </span>
                    ) : (
                      <span className="muted">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{t("taskNoCategory")}</span>
                      </span>
                    )}
                  </td>
                  <td className="nowrap">
                    <DueCell row={row} />
                  </td>
                  <td>
                    <span className={row.responsibleKind === "clients" ? "badge badge-ambre" : "badge badge-bleu"}>{row.responsibleLabel}</span>
                  </td>
                  <td>
                    <div className="row-actions tasks-table-actions">
                      {row.done ? (
                        <ReopenButton row={row} />
                      ) : (
                        <>
                          <Link href={row.href} scroll={false} className="button-link" aria-label={t("taskEditLabel", { label: row.label })}>
                            {t("taskEdit")}
                          </Link>
                          <PostponeMenu row={row} tomorrow={postponeDates.tomorrow} nextWeek={postponeDates.nextWeek} />
                        </>
                      )}
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="taskId" value={row.id} />
                        <button type="submit" className="button-danger" aria-label={t("taskDeleteLabel", { label: row.label })}>
                          {t("taskDelete")}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
