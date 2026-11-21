"use client";

// Lot 53 (HUB-24 ; D8) — le terme d'un type, dans une langue : un terme proposé ou un terme libre court,
// avec son genre et son nombre.
// Lot 62b (UX-13, D1) : une ligne du tableau, enregistrée à la sortie du champ ; « Rétablir » revient
// au terme du type. Plus de bouton « Enregistrer » par type et par langue (quatorze à l'écran).
import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { ClientTerm } from "@symbola/contracts";
import { useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { saveClientTermAction } from "./actions";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

export function ClientTermRow({ eventTypeId, typeLabel, locale, current, fallback, listId }: { eventTypeId: string; typeLabel: string; locale: "fr" | "en"; current: ClientTerm | null; fallback: ClientTerm; listId: string }) {
  const t = useTranslations("ClientTerms");
  const { run } = useAutosaveList();
  // Annuler la première modification d'un terme resté par défaut le remet par défaut, pas « réglé ».
  const wasDefault = useRef(current === null);
  const isDefault = current === null;
  const value = current ?? fallback;
  const { ref, rowProps, read } = useAutosaveRow(
    (data, { revert }) => {
      if (revert && wasDefault.current) data.set("reset", "true");
      else if (!revert) wasDefault.current = isDefault;
      return saveClientTermAction({}, data);
    },
    { term: value.term, gender: value.gender, number: value.number },
  );
  const names = { type: typeLabel, locale: locale.toUpperCase() };

  const reset = () => {
    const before = read();
    void run({
      apply: () => saveClientTermAction({}, formData({ ...before, reset: "true" })),
      revert: () => saveClientTermAction({}, formData(before)),
    });
  };

  return (
    <div className="edit-row" role="row" ref={ref} {...rowProps}>
      <input type="hidden" name="eventTypeId" value={eventTypeId} />
      <input type="hidden" name="locale" value={locale} />
      <span role="rowheader" className="edit-cell-name edit-cell-wide">
        {typeLabel} <span className="badge">{names.locale}</span>
      </span>
      <span role="cell" className="edit-cell edit-cell-wide">
        <span className="edit-cell-label" aria-hidden="true">
          {t("term")}
        </span>
        <input type="text" name="term" maxLength={40} required defaultValue={value.term} list={listId} aria-label={t("termFor", names)} />
      </span>
      <span role="cell" className="edit-cell">
        <span className="edit-cell-label" aria-hidden="true">
          {t("gender")}
        </span>
        <select name="gender" defaultValue={value.gender} aria-label={t("genderFor", names)}>
          {(["masculine", "feminine", "neuter"] as const).map((gender) => (
            <option key={gender} value={gender}>
              {t(`genderValue.${gender}`)}
            </option>
          ))}
        </select>
      </span>
      <span role="cell" className="edit-cell">
        <span className="edit-cell-label" aria-hidden="true">
          {t("number")}
        </span>
        <select name="number" defaultValue={value.number} aria-label={t("numberFor", names)}>
          {(["singular", "plural"] as const).map((number) => (
            <option key={number} value={number}>
              {t(`numberValue.${number}`)}
            </option>
          ))}
        </select>
      </span>
      <span role="cell" className="row-actions edit-cell-wide">
        {current ? (
          <button type="button" className="button-ghost" aria-label={t("resetFor", names)} onClick={reset}>
            {t("resetShort")}
          </button>
        ) : (
          <span className="muted">{t("defaultState")}</span>
        )}
      </span>
    </div>
  );
}
