"use client";

// Lot 62b (UX-13, D1) — les modèles de listes du jour J en tableau : une ligne par modèle (nom, nature,
// nombre de cases) et deux actions de ligne. « Modifier » ouvre la ligne en place, une seule à la
// fois ; le nom, la nature et les cases s'enregistrent à la sortie du champ.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { removeChecklistTemplateAction, saveChecklistTemplateAction } from "./actions";

export type ChecklistLine = { id: string; name: string; phase: "setup" | "teardown"; items: string[] };

function TemplateEditor({ template }: { template: ChecklistLine }) {
  const t = useTranslations("DayChecklists");
  const { ref, rowProps } = useAutosaveRow(
    async (data) => ((await saveChecklistTemplateAction({}, data)).error ? { error: t("invalid") } : {}),
    { name: template.name, phase: template.phase, items: template.items.join("\n") },
  );
  return (
    <div className="edit-row-open" role="row">
      <div role="cell" ref={ref} {...rowProps}>
        <div className="form-grid" role="group" aria-label={t("edit", { name: template.name })}>
          <input type="hidden" name="templateId" value={template.id} />
          <label htmlFor={`name-${template.id}`}>
            {t("name")}
            <input id={`name-${template.id}`} name="name" required maxLength={100} defaultValue={template.name} />
          </label>
          <label htmlFor={`phase-${template.id}`}>
            {t("phase")}
            <select id={`phase-${template.id}`} name="phase" defaultValue={template.phase}>
              <option value="setup">{t("setup")}</option>
              <option value="teardown">{t("teardown")}</option>
            </select>
          </label>
          <label htmlFor={`items-${template.id}`} className="span-all">
            {t("items")}
            <textarea id={`items-${template.id}`} name="items" rows={6} defaultValue={template.items.join("\n")} />
          </label>
        </div>
      </div>
    </div>
  );
}

function TemplateRow({ template, open, onOpen }: { template: ChecklistLine; open: boolean; onOpen: (open: boolean) => void }) {
  const t = useTranslations("DayChecklists");
  const { run } = useAutosaveList();
  const remove = () => {
    const data = new FormData();
    data.set("templateId", template.id);
    void run({ apply: () => removeChecklistTemplateAction(data) });
  };
  return (
    <>
      <div className="edit-row" role="row">
        <strong role="rowheader" className="edit-cell-name">
          {template.name}
        </strong>
        <span role="cell" className="edit-cell-meta">
          {t(template.phase)}
        </span>
        <span role="cell" className="edit-cell-meta">
          {t("count", { count: template.items.length })}
        </span>
        <span role="cell" className="row-actions">
          <button type="button" className="button-ghost" aria-expanded={open} aria-label={open ? t("closeNamed", { name: template.name }) : t("edit", { name: template.name })} onClick={() => onOpen(!open)}>
            {open ? t("close") : t("editShort")}
          </button>
          <button type="button" className="button-ghost" aria-label={t("remove", { name: template.name })} onClick={remove}>
            {t("removeShort")}
          </button>
        </span>
      </div>
      {open ? <TemplateEditor template={template} /> : null}
    </>
  );
}

export function ChecklistTemplateList({ templates }: { templates: ChecklistLine[] }) {
  const t = useTranslations("DayChecklists");
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <AutosaveList hint={t("listHint")}>
      <div className="edit-list-scroll settings-list">
        <div className="edit-list day-checklists-list" role="table" aria-label={t("title")}>
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("name")}</span>
            <span role="columnheader">{t("phase")}</span>
            <span role="columnheader">{t("columnItems")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("columnActions")}</span>
            </span>
          </div>
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} open={openId === template.id} onOpen={(open) => setOpenId(open ? template.id : null)} />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}
