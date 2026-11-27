"use client";

// Lot 32a (HUB-08, EVT-02, PAR-03 ; D6, D7) — parties interactives de « Aujourd'hui » et du cockpit :
// l'offre « Annuler » dix secondes après une tâche cochée, le report. Lot 65d : la relance d'un
// prestataire se note (note-reminder.tsx). Lot 70b (UX-07, UX-10 ; M5, C-09) : l'offre passe par le
// message de retour unique du gabarit ; la date du report est contrôlée par Symbola, sous le champ.
import { useActionState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FieldError } from "@/app/ui/field-error";
import { useFeedback } from "@/app/ui/feedback";
import { useFieldValidation } from "@/app/ui/use-field-validation";
import { useRetryableAction } from "@/app/ui/use-retryable-action";
import { postponeFieldsSchema } from "@/lib/forms/postpone-fields";
import { postponeTaskAction, undoTaskAction, type PostponeState } from "./actions";

export function UndoTaskNotice({ eventId, taskId, message, undoLabel, returnTo }: { eventId: string; taskId: string; message: string; undoLabel: string; returnTo: "home" | "event" }) {
  const router = useRouter();
  const pathname = usePathname();
  const feedback = useFeedback();
  const shown = useRef(false);
  const input = useMemo(
    () => ({
      title: message,
      action: {
        kind: "undo" as const,
        label: undoLabel,
        run: async () => {
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("taskId", taskId);
          formData.set("returnTo", returnTo);
          await undoTaskAction(formData);
        },
      },
    }),
    [eventId, taskId, message, undoLabel, returnTo],
  );
  useEffect(() => {
    if (shown.current || !feedback) return;
    shown.current = true;
    feedback.show(input);
    // L'adresse perd « ?fait=… » : recharger la page ne repropose pas l'annulation.
    router.replace(pathname, { scroll: false });
  }, [feedback, input, pathname, router]);
  return null;
}

export function PostponeTaskForm({
  eventId,
  taskId,
  defaultDate,
  labels,
}: {
  eventId: string;
  taskId: string;
  defaultDate: string;
  labels: { summary: string; date: string; save: string };
}) {
  const tFeedback = useTranslations("Feedback");
  const feedback = useFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const action = useRetryableAction(postponeTaskAction, formRef, tFeedback("dateNotChanged"));
  const [state, formAction, pending] = useActionState<PostponeState, FormData>(action, {});
  const validation = useFieldValidation(postponeFieldsSchema, state.fieldErrors);
  useEffect(() => {
    if (state.message) feedback?.show({ title: state.message });
  }, [state, feedback]);
  return (
    <details className="postpone">
      <summary>{labels.summary}</summary>
      <form ref={formRef} action={formAction} noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={taskId} />
        <label htmlFor={validation.fieldId("dueDate")}>{labels.date}</label>
        <input type="date" name="dueDate" required defaultValue={defaultDate} {...validation.fieldProps("dueDate")} />
        <FieldError id={validation.errorId("dueDate")} message={validation.errorFor("dueDate")} />
        <button type="submit" disabled={pending}>
          {labels.save}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
    </details>
  );
}
