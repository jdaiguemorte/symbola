"use client";

// Lot 51 (JRJ-06) — un modèle de liste de contrôle : nom, nature, une case par ligne.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveChecklistTemplateAction, type ChecklistTemplateState } from "./actions";

export function ChecklistTemplateForm({ template }: { template: { id: string; name: string; phase: "setup" | "teardown"; items: string[] } | null }) {
  const t = useTranslations("DayChecklists");
  const [state, action, pending] = useActionState(saveChecklistTemplateAction, {} as ChecklistTemplateState);
  return (
    <form action={action} className="stack">
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <label>
        {t("name")}
        <input name="name" required maxLength={100} defaultValue={template?.name ?? ""} />
      </label>
      <label>
        {t("phase")}
        <select name="phase" defaultValue={template?.phase ?? "setup"}>
          <option value="setup">{t("setup")}</option>
          <option value="teardown">{t("teardown")}</option>
        </select>
      </label>
      <label>
        {t("items")}
        <textarea name="items" rows={6} defaultValue={template?.items.join("\n") ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {template ? t("save") : t("add")}
      </button>
      {state.error ? <p role="alert">{t("invalid")}</p> : null}
      {state.saved ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
