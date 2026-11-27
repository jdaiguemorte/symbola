"use client";

// Lot 70c (CHR-02, CHR-04, UX-07, UX-15 ; C-35, M3, M11) — « Fait » : la seule action rapide d'une tâche,
// nommée, sur la ligne comme dans le panneau, pour une tâche d'évènement comme hors évènement, confiée à
// l'agence comme aux mariés (la planner coche après un appel, M3). La coche se voit tout de suite (mise à
// jour optimiste) ; le message de retour propose « Annuler » pendant dix secondes. Une tâche faite montre
// « Rouvrir ».
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "./feedback";
import { setTaskDoneAction } from "@/app/taches/task-line-actions";

export function TaskDoneButton({ taskId, label, done }: { taskId: string; label: string; done: boolean }) {
  const t = useTranslations("TaskLine");
  const feedback = useFeedback();
  const router = useRouter();
  const [shownDone, setShownDone] = useOptimistic(done);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const next = !done;
      setShownDone(next);
      const result = await setTaskDoneAction(taskId, next);
      if (!result.ok) {
        feedback?.show({ tone: "error", title: result.error ?? t("notFound") });
        return;
      }
      if (next) {
        feedback?.show({
          title: t("doneMessage", { label }),
          action: {
            kind: "undo",
            label: t("undo"),
            run: async () => {
              await setTaskDoneAction(taskId, false);
              feedback.show({ title: t("reopenedMessage", { label }) });
              router.refresh();
            },
          },
        });
      } else {
        feedback?.show({ title: t("reopenedMessage", { label }) });
      }
      router.refresh();
    });

  return (
    // Le texte visible ouvre le nom accessible (WCAG 2.5.3) ; la tâche n'est lue que par le lecteur d'écran.
    <button
      type="button"
      className={shownDone ? "button-secondary task-done-button" : "task-done-button"}
      data-done={shownDone ? "true" : undefined}
      aria-label={`${shownDone ? t("reopen") : t("done")} ${t("doneFor", { label })}`}
      onClick={toggle}
      disabled={pending}
    >
      {shownDone ? t("reopen") : t("done")}
    </button>
  );
}
