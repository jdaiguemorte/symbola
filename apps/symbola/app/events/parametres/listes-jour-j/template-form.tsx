"use client";

// Lot 51 (JRJ-06) — un nouveau modèle de liste de contrôle : nom, nature, une case par ligne.
// Lot 62b (UX-12) : formulaire en grille (nom et nature côte à côte) ; un modèle existant se modifie
// dans sa ligne du tableau (template-list.tsx).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveChecklistTemplateAction, type ChecklistTemplateState } from "./actions";

export function ChecklistTemplateForm() {
  const t = useTranslations("DayChecklists");
  const [state, action, pending] = useActionState(saveChecklistTemplateAction, {} as ChecklistTemplateState);
  return (
    <form action={action} className="form-grid" aria-label={t("addTitle")}>
      <label>
        {t("name")}
        <input name="name" required maxLength={100} />
      </label>
      <label>
        {t("phase")}
        <select name="phase" defaultValue="setup">
          <option value="setup">{t("setup")}</option>
          <option value="teardown">{t("teardown")}</option>
        </select>
      </label>
      <label className="span-all">
        {t("items")}
        <textarea name="items" rows={6} />
      </label>
      <div className="span-all form-foot">
        <button type="submit" disabled={pending}>
          {t("add")}
        </button>
        {state.error ? <p role="alert">{t("invalid")}</p> : null}
        {state.saved ? <p role="status">{t("saved")}</p> : null}
      </div>
    </form>
  );
}
