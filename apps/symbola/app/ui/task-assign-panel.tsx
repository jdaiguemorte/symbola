"use client";

// Lot 70c (CHR-02, UX-07 ; A1, A18, C-40 ; page 2 des maquettes du lot 68) — « Confier à… » : un petit
// panneau avec vous, chaque collègue, les clients (le mot du type d'évènement) et les prestataires
// retenus sur l'évènement. Le choix s'applique tout de suite ; le message de retour propose « Annuler ».
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "./feedback";
import { TaskPopover, type PopoverHandle } from "./task-popover";
import { assignTaskAction, undoTaskChangeAction } from "@/app/taches/task-line-actions";

export type AssignOption = { value: string; label: string; initials: string | null };

export function TaskAssignPanel({ handle, task, options }: { handle: PopoverHandle; task: { id: string; label: string; responsibleValue: string }; options: AssignOption[] }) {
  const t = useTranslations("TaskLine");
  const feedback = useFeedback();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (option: AssignOption) => {
    setError(null);
    if (option.value === task.responsibleValue) {
      handle.close();
      return;
    }
    startTransition(async () => {
      const result = await assignTaskAction(task.id, option.value);
      if (!result.ok) {
        setError(result.error ?? t("invalid"));
        return;
      }
      handle.close();
      const undoId = result.undoId;
      feedback?.show({
        title: t("assignedMessage", { who: option.label, label: task.label }),
        ...(undoId
          ? {
              action: {
                kind: "undo" as const,
                label: t("undo"),
                run: async () => {
                  const undone = await undoTaskChangeAction(undoId);
                  feedback.show(undone.ok ? { title: t("restored", { label: task.label }) } : { tone: "error", title: undone.error ?? t("undoExpired") });
                  router.refresh();
                },
              },
            }
          : {}),
      });
      router.refresh();
    });
  };

  return (
    <TaskPopover handle={handle} label={t("assignTitle")} className="task-assign-panel">
      <p className="task-popover-title">{t("assignTitle")}</p>
      <p className="task-popover-subtitle">{t("assignSubtitle", { label: task.label })}</p>
      <ul className="task-popover-choices">
        {options.map((option, index) => (
          <li key={option.value}>
            <button
              type="button"
              className="task-popover-choice"
              aria-pressed={option.value === task.responsibleValue}
              onClick={() => choose(option)}
              disabled={pending}
              {...(index === 0 ? { "data-autofocus": true } : {})}
            >
              <span className="task-avatar" aria-hidden="true">
                {option.initials ?? "–"}
              </span>
              <span>{option.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="task-popover-hint">{t("dateOutside")}</p>
    </TaskPopover>
  );
}
