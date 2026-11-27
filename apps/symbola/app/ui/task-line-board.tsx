"use client";

// Lot 70c (CHR-02 ; M2, C-35, C-40) — la liste de lignes types et son mode « Sélectionner » : hors de ce
// mode, aucune case ; dedans, une case par ligne (« Fait » et « ⋯ » s'effacent) et la barre des actions
// en lot (décaler, confier, catégorie, supprimer, reprise du lot 63d ; son dessin final vient au 70d).
import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { bulkTasksAction, type TaskRowState } from "@/app/taches/task-row-actions";
import { useFeedback } from "./feedback";
import { TaskLineList, type TaskLineGroup } from "./task-line";
import type { TaskLineForm } from "@/lib/tasks/task-line";
import type { DateShortcutOption } from "./task-date-panel";
import type { AssignOption } from "./task-assign-panel";

type Option = { value: string; label: string };

function BulkBar({ ids, categories, members, onClear, onDone }: { ids: string[]; categories: Option[]; members: Option[]; onClear: () => void; onDone: (message: string, undoOffered: boolean) => void }) {
  const t = useTranslations("Events");
  const tLine = useTranslations("TaskLine");
  const [state, action, pending] = useActionState(bulkTasksAction, {} as TaskRowState);
  const [days, setDays] = useState("7");
  // Une action réussie vide la sélection (les lignes ont bougé, ou sont parties) ; son résultat reste
  // annoncé sous la barre, qui disparaît avec la sélection.
  useEffect(() => {
    if (!state.success) return;
    onDone(state.success, state.undoOffered === true);
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
          <summary>{tLine("filterWho")}</summary>
          <div className="row-menu-panel row-menu-date">
            <label>
              {tLine("filterWho")}
              {/* Lot 70a (CHR-02 ; A1) : « Vous », chaque collègue par son nom, les clients. */}
              <select name="responsible" defaultValue={members[0]?.value ?? "planner"}>
                {members.length === 0 ? <option value="planner">{t("responsiblePlanner")}</option> : null}
                {members.map((member) => (
                  <option key={member.value} value={member.value}>
                    {member.label}
                  </option>
                ))}
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

export function TaskLineBoard({
  groups,
  form,
  label,
  shortcuts,
  assignOptions,
  categories,
  members,
}: {
  groups: TaskLineGroup[];
  form: TaskLineForm;
  label: string;
  shortcuts: DateShortcutOption[];
  assignOptions: Record<string, AssignOption[]>;
  categories: Option[];
  members: Option[];
}) {
  const t = useTranslations("TaskLine");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = useMemo(() => groups.flatMap((group) => group.lines.map((line) => line.id)), [groups]);
  // Les lignes qui disparaissent (supprimées, filtrées) quittent la sélection.
  const shown = allIds.filter((id) => selected.has(id));
  const clear = useMemo(() => () => setSelected(new Set()), []);
  const feedback = useFeedback();
  const done = useMemo(
    () => (message: string, undoOffered: boolean) => {
      if (!undoOffered) feedback?.show({ title: message });
    },
    [feedback],
  );
  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(":popover-open, dialog[open]")) {
        setSelecting(false);
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="task-board">
      <div className="task-board-tools">
        <button
          type="button"
          className="button-secondary"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((value) => !value);
            setSelected(new Set());
          }}
        >
          {selecting ? t("selectEnd") : t("select")}
        </button>
      </div>
      <TaskLineList groups={groups} form={form} label={label} shortcuts={shortcuts} assignOptions={assignOptions} selecting={selecting} selected={selected} onToggle={toggle} />
      {selecting && shown.length > 0 ? <BulkBar ids={shown} categories={categories} members={members} onClear={clear} onDone={done} /> : null}
    </div>
  );
}
