"use client";

// Lot 63d (CHR-03, HUB-20) — la liste des catégories des tâches, éditable comme les autres listes de
// réglages (lot 62b) : libellé et couleur s'enregistrent à la sortie du champ ; « Monter », « Descendre »
// et « Supprimer » sont des actions de ligne. La couleur se choisit dans une palette nommée ; la pastille
// accompagne toujours le nom.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { TaskCategory } from "@/modules/events/service";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { CategorySwatch } from "@/app/taches/category-swatch";
import {
  createTaskCategoryAction,
  moveTaskCategoryAction,
  removeTaskCategoryAction,
  updateTaskCategoryAction,
  type TaskCategoryFormState,
} from "./task-category-actions";

export type PaletteColor = { key: string; label: string; color: string };

function ColorSelect({ palette, defaultValue, label }: { palette: PaletteColor[]; defaultValue: string; label?: string }) {
  // Une couleur posée avant un changement de palette reste proposée.
  const known = palette.some((entry) => entry.color === defaultValue);
  return (
    <select name="color" defaultValue={defaultValue} aria-label={label}>
      {palette.map((entry) => (
        <option key={entry.key} value={entry.color}>
          {entry.label}
        </option>
      ))}
      {!known ? <option value={defaultValue}>{defaultValue}</option> : null}
    </select>
  );
}

function CategoryRow({ category, taskCount, palette, first, last }: { category: TaskCategory; taskCount: number; palette: PaletteColor[]; first: boolean; last: boolean }) {
  const t = useTranslations("TaskCategories");
  const { run } = useAutosaveList();
  const { ref, rowProps } = useAutosaveRow((data) => updateTaskCategoryAction({}, data), { label: category.label, color: category.color });
  const act = (action: (state: TaskCategoryFormState, data: FormData) => Promise<TaskCategoryFormState>, fields: Record<string, string>) => {
    const data = new FormData();
    data.set("categoryId", category.id);
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    void run({ apply: () => action({}, data) });
  };
  return (
    <div className="edit-row" role="row" ref={ref} {...rowProps}>
      <input type="hidden" name="categoryId" value={category.id} />
      <span role="cell" className="edit-cell">
        <span className="edit-cell-label" aria-hidden="true">
          {t("label")}
        </span>
        <span className="task-category">
          <CategorySwatch color={category.color} />
          <input type="text" name="label" defaultValue={category.label} required maxLength={60} aria-label={t("labelFor", { label: category.label })} />
        </span>
      </span>
      <span role="cell" className="edit-cell">
        <span className="edit-cell-label" aria-hidden="true">
          {t("color")}
        </span>
        <ColorSelect palette={palette} defaultValue={category.color} label={t("colorFor", { label: category.label })} />
      </span>
      <span role="cell" className="edit-cell-meta">
        {t("tasksCount", { count: taskCount })}
      </span>
      <span role="cell" className="row-actions">
        <button type="button" className="button-ghost" disabled={first} aria-label={t("moveUpFor", { label: category.label })} onClick={() => act(moveTaskCategoryAction, { direction: "up" })}>
          {t("moveUp")}
        </button>
        <button type="button" className="button-ghost" disabled={last} aria-label={t("moveDownFor", { label: category.label })} onClick={() => act(moveTaskCategoryAction, { direction: "down" })}>
          {t("moveDown")}
        </button>
        <button type="button" className="button-ghost" disabled={first && last} aria-label={t("removeFor", { label: category.label })} onClick={() => act(removeTaskCategoryAction, {})}>
          {t("remove")}
        </button>
      </span>
    </div>
  );
}

export function TaskCategoryList({ categories, counts, palette }: { categories: TaskCategory[]; counts: Record<string, number>; palette: PaletteColor[] }) {
  const t = useTranslations("TaskCategories");
  return (
    <AutosaveList>
      <div className="edit-list-scroll settings-list" role="region" aria-label={t("tableLabel")}>
        <div className="edit-list event-types-list" role="table">
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("label")}</span>
            <span role="columnheader">{t("color")}</span>
            <span role="columnheader">{t("columnTasks")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("columnActions")}</span>
            </span>
          </div>
          {categories.map((category, index) => (
            <CategoryRow key={category.id} category={category} taskCount={counts[category.id] ?? 0} palette={palette} first={index === 0} last={index === categories.length - 1} />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}

export function AddTaskCategoryForm({ palette }: { palette: PaletteColor[] }) {
  const t = useTranslations("TaskCategories");
  const tCommon = useTranslations("Common");
  const [state, action, pending] = useActionState(createTaskCategoryAction, {});
  return (
    <form action={action}>
      <div className="form-inline">
        <label>
          <span>
            {t("label")}
            <RequiredMark />
          </span>
          <input type="text" name="label" required maxLength={60} />
        </label>
        <label>
          {t("color")}
          <ColorSelect palette={palette} defaultValue={palette[0]?.color ?? "#6b7280"} />
        </label>
        <button type="submit" disabled={pending}>
          {t("add")}
        </button>
      </div>
      <RequiredLegend text={tCommon("requiredLegend")} />
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}
