"use client";

// Lot 63d (CHR-02, CHR-03 ; Q42 bis, ADR 0107 ; maquette M6) — la fenêtre de la tâche : un clic sur la
// ligne ou « Modifier » l'ouvre, sans quitter l'écran (« Tâches » ou le rétroplanning). Tâche et
// échéance obligatoires ; responsable, catégorie, priorité. « Enregistrer », « Annuler » et « Supprimer la
// tâche » (tout de suite, « Annuler » dix secondes dans le bandeau). Fenêtre native : focus gardé dedans,
// Échap ferme ; sur téléphone, elle occupe l'écran, avec « Retour ». Dans le rétroplanning, ses autres
// rubriques (pièces jointes, commentaires, réglages de la tâche) suivent, avec leur sommaire à gauche.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { ResponsibleSelect, type TaskVendorOption } from "@/app/events/[id]/task-forms";
import type { TaskMemberOption } from "@/app/events/[id]/task-responsible";
import { deleteTaskAction, saveTaskAction, type TaskRowState } from "./task-row-actions";

export type TaskDialogTask = {
  id: string;
  label: string;
  dueDate: string;
  responsible: string;
  categoryId: string | null;
  priority: "high" | "normal";
};

export type TaskDialogSection = { id: string; title: string };

export function TaskDialog({
  task,
  closeHref,
  categories,
  vendors = [],
  members = [],
  eventLink,
  sections = [],
  children,
}: {
  task: TaskDialogTask;
  // L'écran sans la fenêtre : fermer y revient, à la même place.
  closeHref: string;
  categories: { id: string; label: string }[];
  vendors?: TaskVendorOption[];
  // Lot 70a (CHR-02 ; A1) : les collègues proposés dans « Qui s'en charge ».
  members?: TaskMemberOption[];
  // Écran « Tâches » : l'évènement de la tâche, et son rétroplanning.
  eventLink?: { href: string; label: string; names: string };
  // Rubriques de plus (rétroplanning), rendues par le serveur dans `children`.
  sections?: TaskDialogSection[];
  children?: ReactNode;
}) {
  const t = useTranslations("Events");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(saveTaskAction, {} as TaskRowState);
  const [label, setLabel] = useState(task.label);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [responsible, setResponsible] = useState(task.responsible);
  const [categoryId, setCategoryId] = useState(task.categoryId ?? "");
  const [priority, setPriority] = useState(task.priority);
  const closing = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    dialog.current?.close();
    router.replace(closeHref, { scroll: false });
  };

  // Enregistrée : la fenêtre se ferme, la ligne montre les nouvelles valeurs.
  useEffect(() => {
    if (state.success) close();
  }, [state]);

  const long = sections.length > 0;
  return (
    <dialog ref={dialog} className={`task-dialog${long ? " task-dialog-long" : ""}`} aria-labelledby={titleId} onClose={close} onCancel={close}>
      <div className="task-dialog-head">
        <h2 id={titleId}>{t("taskDialogTitle")}</h2>
        <button type="button" className="button-ghost" onClick={close}>
          <span className="task-dialog-back">{t("taskDialogBack")}</span>
          <span className="task-dialog-x">{t("taskDialogClose")}</span>
        </button>
      </div>
      <div className="task-dialog-body">
        {long ? (
          <nav className="task-dialog-nav" aria-label={t("taskDialogSections")}>
            <ul>
              <li>
                <a href="#task-dialog-main">{t("taskDialogMain")}</a>
              </li>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="task-dialog-content">
          <section id="task-dialog-main" aria-labelledby={`${titleId}-main`}>
            <h3 id={`${titleId}-main`} className={long ? undefined : "sr-only"}>
              {t("taskDialogMain")}
            </h3>
            {eventLink ? (
              <p className="meta">
                {eventLink.names} · <Link href={eventLink.href}>{eventLink.label}</Link>
              </p>
            ) : null}
            <form action={action} id={`${titleId}-form`} className="task-dialog-form">
              <input type="hidden" name="taskId" value={task.id} />
              <label>
                <span>
                  {t("taskColumnLabel")}
                  <RequiredMark />
                </span>
                <input type="text" name="label" required maxLength={300} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <div className="field-row">
                <label className="field-fit">
                  <span>
                    {t("taskDueDate")}
                    <RequiredMark />
                  </span>
                  <input type="date" name="dueDate" className="field-date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
                <ResponsibleSelect value={responsible} onChange={setResponsible} vendors={vendors} members={members} />
              </div>
              <div className="field-row">
                <label>
                  {t("taskCategory")}
                  <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">{t("taskNoCategory")}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("taskPriority")}
                  <select name="priority" value={priority} onChange={(event) => setPriority(event.target.value === "high" ? "high" : "normal")}>
                    <option value="normal">{t("taskPriorityNormal")}</option>
                    <option value="high">{t("taskPriorityHigh")}</option>
                  </select>
                </label>
              </div>
              <RequiredLegend text={tCommon("requiredLegend")} />
              {state.error ? <p role="alert">{state.error}</p> : null}
            </form>
          </section>
          {children}
        </div>
      </div>
      <div className="task-dialog-actions">
        <form
          action={async (formData) => {
            await deleteTaskAction(formData);
            close();
          }}
        >
          <input type="hidden" name="taskId" value={task.id} />
          <button type="submit" className="button-danger">
            {t("taskDialogDelete")}
          </button>
        </form>
        <span className="task-dialog-actions-main">
          <button type="button" className="button-secondary" onClick={close}>
            {t("taskDialogCancel")}
          </button>
          <button type="submit" form={`${titleId}-form`} disabled={pending}>
            {t("taskDialogSave")}
          </button>
        </span>
      </div>
    </dialog>
  );
}
