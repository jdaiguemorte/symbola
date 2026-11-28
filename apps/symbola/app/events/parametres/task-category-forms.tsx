"use client";

// Lot 63d (CHR-03, HUB-20) — la liste des catégories des tâches, éditable comme les autres listes de
// réglages (lot 62b) : libellé et couleur s'enregistrent à la sortie du champ ; « Monter », « Descendre »
// et « Supprimer » sont des actions de ligne. La couleur se choisit dans une palette nommée ; la pastille
// accompagne toujours le nom.
// Lot 74h (D7, G9 ; page 30) : « ✓ Enregistré » sur la ligne (AutosaveList `rowStatus`) ; « Monter »,
// « Descendre », « Supprimer… » au menu « ⋯ » de la ligne ; le seuil de « Bientôt » en réglage isolé.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { TaskCategory } from "@/modules/events/service";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import { LineMenu } from "@/app/ui/line-menu";
import { SavedIndicator, type SavedLabels } from "@/app/ui/saved-indicator";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { CategorySwatch } from "@/app/taches/category-swatch";
import {
  createTaskCategoryAction,
  moveTaskCategoryAction,
  removeTaskCategoryAction,
  saveTaskSoonDaysAction,
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

export type RowMenuLabels = { menu: string; removeHint: string };

function CategoryRow({ category, taskCount, palette, first, last, saved, menu }: { category: TaskCategory; taskCount: number; palette: PaletteColor[]; first: boolean; last: boolean; saved: SavedLabels; menu: RowMenuLabels }) {
  const t = useTranslations("TaskCategories");
  const { run } = useAutosaveList();
  const { ref, rowProps, status, stamp, rowId } = useAutosaveRow((data) => updateTaskCategoryAction({}, data), { label: category.label, color: category.color });
  const act = (action: (state: TaskCategoryFormState, data: FormData) => Promise<TaskCategoryFormState>, fields: Record<string, string>) => {
    const data = new FormData();
    data.set("categoryId", category.id);
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    void run({ apply: () => action({}, data) }, rowId);
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
        {status === "idle" ? t("tasksCount", { count: taskCount }) : null}
        <SavedIndicator status={status} stamp={stamp} labels={saved} />
      </span>
      <span role="cell" className="row-actions">
        <LineMenu
          label={menu.menu.replace("{label}", category.label)}
          items={[
            { label: t("moveUp"), disabled: first, onSelect: () => act(moveTaskCategoryAction, { direction: "up" }) },
            { label: t("moveDown"), disabled: last, onSelect: () => act(moveTaskCategoryAction, { direction: "down" }) },
            { label: `${t("remove")}…`, hint: menu.removeHint, disabled: first && last, onSelect: () => act(removeTaskCategoryAction, {}) },
          ]}
        />
      </span>
    </div>
  );
}

export function TaskCategoryList({ categories, counts, palette, saved, menu }: { categories: TaskCategory[]; counts: Record<string, number>; palette: PaletteColor[]; saved: SavedLabels; menu: RowMenuLabels }) {
  const t = useTranslations("TaskCategories");
  return (
    <AutosaveList rowStatus={saved}>
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
            <CategoryRow key={category.id} category={category} taskCount={counts[category.id] ?? 0} palette={palette} first={index === 0} last={index === categories.length - 1} saved={saved} menu={menu} />
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

// Lot 74h (G9, M10) — « Échéance proche » : le seuil de « Bientôt », réglage isolé (1 à 30 jours). Les mots
// viennent du serveur (espace « SettingsPattern », NFR-02).
export type SoonDaysLabels = { title: string; hint: string; label: string; unit: string; invalid: string; form: string };

export function TaskSoonDaysSetting({ days, labels, saved }: { days: number; labels: SoonDaysLabels; saved: SavedLabels }) {
  return (
    <AutoSettingForm action={saveTaskSoonDaysAction} labels={saved} ariaLabel={labels.form} invalid={{ soonDays: labels.invalid }}>
      <div className="setting-line" id="reglage-soonDays">
        <div className="setting-line-text">
          <h2>{labels.title}</h2>
          <p id="soon-days-hint">{labels.hint}</p>
        </div>
        <div className="setting-line-control">
          <label>
            <span className="sr-only">{labels.label}</span>
            <input className="field-short setting-days" type="number" name="soonDays" inputMode="numeric" min={1} max={30} step={1} required defaultValue={days} aria-describedby="soon-days-hint" />
            <span aria-hidden="true">{labels.unit}</span>
          </label>
          <SettingStatus name="soonDays" />
        </div>
      </div>
    </AutoSettingForm>
  );
}
