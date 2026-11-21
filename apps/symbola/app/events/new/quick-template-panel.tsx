"use client";

// Lot 63c (EVT-01, HUB-21 ; ADR 0106, maquette M7) — « Créer un modèle pour « <type> » » dans le panneau
// latéral, sans quitter le formulaire de création (ADR 0107 : le panneau sert aux réglages). Les
// tâches se comptent en jours avant la date de l'évènement ; le détail (responsable, après la date)
// se règle ensuite dans les modèles de rétroplanning.
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RequiredMark } from "@/app/ui/required-mark";
import { createTypedTaskTemplateAction } from "./actions";

export type ProposedTemplate = { id: string; name: string; eventTypeId: string; items: { label: string; offsetDays: number }[] };

type Row = { label: string; daysBefore: string };

export function QuickTemplatePanel({ eventTypeId, typeLabel, onClose, onCreated }: { eventTypeId: string; typeLabel: string; onClose: () => void; onCreated: (template: ProposedTemplate) => void }) {
  const t = useTranslations("Events");
  const tCommon = useTranslations("Common");
  const [name, setName] = useState(typeLabel);
  const [rows, setRows] = useState<Row[]>([
    { label: "", daysBefore: "30" },
    { label: "", daysBefore: "7" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Le focus revient au bouton qui a ouvert le panneau.
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onClose]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = rows.filter((row) => row.label.trim() !== "").map((row) => ({ label: row.label.trim(), daysBefore: Number.parseInt(row.daysBefore || "0", 10) || 0 }));
    if (items.length === 0) {
      setError(t("quickTemplateNoTask"));
      return;
    }
    startTransition(async () => {
      const result = await createTypedTaskTemplateAction({ eventTypeId, name, items });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.template);
    });
  };

  return (
    <aside className="side-panel" aria-labelledby="quick-template-title">
      <div className="side-panel-head">
        <h2 id="quick-template-title" ref={titleRef} tabIndex={-1}>
          {t("templateTipCreate", { type: typeLabel })}
        </h2>
        <button type="button" className="side-panel-close" aria-label={tCommon("closePanel")} onClick={onClose}>
          ×
        </button>
      </div>
      <p className="meta">{t("quickTemplateIntro")}</p>
      <form onSubmit={submit} className="panel-form">
        <label>
          {t("newTaskTemplateName")}
          <RequiredMark />
          <input type="text" value={name} maxLength={200} required onChange={(event) => setName(event.target.value)} />
        </label>
        <fieldset className="stack">
          <legend>{t("quickTemplateTasks")}</legend>
          {rows.map((row, index) => (
            <div key={index} className="field-row">
              <label>
                {t("quickTemplateTaskLabel", { number: index + 1 })}
                <input type="text" value={row.label} maxLength={200} onChange={(event) => setRows(rows.map((other, at) => (at === index ? { ...other, label: event.target.value } : other)))} />
              </label>
              <label className="field-fit">
                {t("quickTemplateDaysBefore", { number: index + 1 })}
                <input type="number" min={-1095} max={1095} className="field-short" value={row.daysBefore} onChange={(event) => setRows(rows.map((other, at) => (at === index ? { ...other, daysBefore: event.target.value } : other)))} />
              </label>
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => setRows([...rows, { label: "", daysBefore: "1" }])}>
            {t("quickTemplateAddTask")}
          </button>
        </fieldset>
        {error ? <p role="alert">{error}</p> : null}
        <div className="row-wrap">
          <button type="button" className="button-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="button-primary" disabled={pending}>
            {t("quickTemplateSave")}
          </button>
        </div>
      </form>
    </aside>
  );
}
