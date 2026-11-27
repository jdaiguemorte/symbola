"use client";

// Lot 70c (CHR-02, UX-07 ; C-36, C-09 ; page 2 des maquettes du lot 68) — « Changer la date » : un petit
// panneau, le même depuis la ligne (menu « ⋯ ») et depuis le panneau de la tâche (champ « Échéance »).
// « Confirmer la voiture des mariés · prévue le sam. 21 nov. », trois raccourcis qui disent leur date,
// « Autre date » et « Enregistrer ». Depuis la ligne, un raccourci s'applique tout de suite, et le message
// de retour propose « Annuler » (la date d'avant et son état « date relative » d'avant reviennent) ; depuis
// le panneau de la tâche, le choix remplit le champ, enregistré avec le reste (M1).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "./feedback";
import { TaskPopover, type PopoverHandle } from "./task-popover";
import { changeTaskDateAction, undoTaskChangeAction } from "@/app/taches/task-line-actions";

export type DateShortcutOption = { key: "tomorrow" | "next_monday" | "in_a_week"; date: string; label: string };

const SHORTCUT_KEYS = { tomorrow: "dateTomorrow", next_monday: "dateNextMonday", in_a_week: "dateInAWeek" } as const;

export function TaskDatePanel({
  handle,
  task,
  shortcuts,
  onPick,
}: {
  handle: PopoverHandle;
  task: { id: string; label: string; dueDate: string; dateLabel: string };
  shortcuts: DateShortcutOption[];
  // Depuis le panneau de la tâche : le choix remplit le champ, sans rien enregistrer.
  onPick?: (date: string) => void;
}) {
  const t = useTranslations("TaskLine");
  const tFeedback = useTranslations("Feedback");
  const feedback = useFeedback();
  const router = useRouter();
  const [other, setOther] = useState(task.dueDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (choice: string) => {
    setError(null);
    if (onPick) {
      onPick(choice);
      handle.close();
      return;
    }
    startTransition(async () => {
      const result = await changeTaskDateAction(task.id, choice);
      if (!result.ok) {
        setError(result.error ?? t("invalid"));
        return;
      }
      handle.close();
      const undoId = result.undoId;
      feedback?.show({
        title: tFeedback("dateChanged", { date: result.message ?? "" }),
        detail: task.label,
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
    <TaskPopover handle={handle} label={t("dateTitle")} className="task-date-panel">
      <p className="task-popover-title">{t("dateTitle")}</p>
      <p className="task-popover-subtitle">{t("dateSubtitle", { label: task.label, date: task.dateLabel })}</p>
      <ul className="task-popover-choices">
        {shortcuts.map((shortcut, index) => (
          <li key={shortcut.key}>
            <button type="button" className="task-popover-choice" onClick={() => apply(onPick ? shortcut.date : shortcut.key)} disabled={pending} {...(index === 0 ? { "data-autofocus": true } : {})}>
              <span>{t(SHORTCUT_KEYS[shortcut.key])}</span>
              <span className="task-popover-choice-hint">{shortcut.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="task-popover-other"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!other) {
            setError(t("invalidDate"));
            return;
          }
          apply(other);
        }}
      >
        <label>
          <span>{t("dateOther")}</span>
          <input type="date" value={other} onChange={(event) => setOther(event.target.value)} />
        </label>
        <button type="submit" className="button-secondary" disabled={pending}>
          {t("dateApply")}
        </button>
      </form>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="task-popover-hint">{t("dateOutside")}</p>
    </TaskPopover>
  );
}
