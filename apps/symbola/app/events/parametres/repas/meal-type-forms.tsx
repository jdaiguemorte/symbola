"use client";

// Lot 50 (INV-06 ; D5) — ajouter un type de repas, renommer un type (ou reprendre le libellé de
// départ). Résultat annoncé (role="status"), erreur (role="alert").
// Lot 62b (UX-13, D1) : la liste est un tableau éditable ; le libellé s'enregistre à la sortie du
// champ, « Masquer », « Afficher » et « Rétablir » sont des actions de ligne.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { addMealTypeAction, renameMealTypeAction, toggleMealTypeAction, type MealTypeState } from "./actions";

export type MealTypeLine = { id: string; label: string; hidden: boolean; starter: boolean };

function data(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

export function AddMealTypeForm() {
  const t = useTranslations("Guests.mealTypes");
  const [state, action, pending] = useActionState(addMealTypeAction, {} as MealTypeState);
  return (
    <form action={action} className="form-inline">
      <label>
        {t("label")}
        <input name="label" required maxLength={60} />
      </label>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}

function MealTypeRow({ type, renaming, onRenaming }: { type: MealTypeLine; renaming: boolean; onRenaming: (open: boolean) => void }) {
  const t = useTranslations("Guests.mealTypes");
  const { run } = useAutosaveList();
  const { ref, rowProps, read } = useAutosaveRow((form) => renameMealTypeAction({}, form), { label: type.label });

  const toggle = (hidden: boolean) =>
    void run({
      apply: () => toggleMealTypeAction(data({ mealTypeId: type.id, hidden: String(hidden) })),
      revert: () => toggleMealTypeAction(data({ mealTypeId: type.id, hidden: String(!hidden) })),
    });
  const reset = () => {
    const before = read();
    void run({
      apply: () => renameMealTypeAction({}, data({ mealTypeId: type.id, label: "", reset: "1" })),
      revert: () => renameMealTypeAction({}, data(before)),
    });
  };

  return (
    <div className="edit-row" role="row" ref={ref} {...rowProps} data-hidden={type.hidden ? "true" : undefined}>
      <input type="hidden" name="mealTypeId" value={type.id} />
      {renaming ? (
        <span key="edit" role="cell" className="edit-cell">
          <input
            name="label"
            defaultValue={type.label}
            required
            maxLength={60}
            aria-label={t("labelFor", { label: type.label })}
            autoFocus
            onBlur={() => onRenaming(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.value = type.label;
                event.currentTarget.blur();
              } else if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </span>
      ) : (
        <span key="read" role="rowheader" className="edit-cell-name">
          <input type="hidden" name="label" value={type.label} />
          {type.label}
        </span>
      )}
      <span role="cell" className="edit-cell-meta">
        {type.hidden ? <span className="badge">{t("hiddenState")}</span> : t("shownState")}
      </span>
      <span role="cell" className="row-actions">
        <button type="button" className="button-ghost" aria-label={t("renameFor", { label: type.label })} onClick={() => onRenaming(true)}>
          {t("renameShort")}
        </button>
        {type.starter ? (
          <button type="button" className="button-ghost" aria-label={t("resetFor", { label: type.label })} onClick={reset}>
            {t("resetShort")}
          </button>
        ) : null}
        <button type="button" className="button-ghost" aria-label={type.hidden ? t("show", { label: type.label }) : t("hide", { label: type.label })} onClick={() => toggle(!type.hidden)}>
          {type.hidden ? t("showShort") : t("hideShort")}
        </button>
      </span>
    </div>
  );
}

export function MealTypeList({ types }: { types: MealTypeLine[] }) {
  const t = useTranslations("Guests.mealTypes");
  // Une seule ligne ouverte à la fois.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  return (
    <AutosaveList hint={t("listHint")}>
      <div className="edit-list-scroll settings-list">
        <div className="edit-list meal-types-list" role="table" aria-label={t("title")}>
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("label")}</span>
            <span role="columnheader">{t("columnState")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("columnActions")}</span>
            </span>
          </div>
          {types.map((type) => (
            <MealTypeRow key={type.id} type={type} renaming={renamingId === type.id} onRenaming={(open) => setRenamingId(open ? type.id : null)} />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}
