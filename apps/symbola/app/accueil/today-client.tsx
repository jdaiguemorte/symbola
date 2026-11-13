"use client";

// Lot 32a (HUB-08, EVT-02, PAR-03 ; D6, D7) — parties interactives de « Aujourd'hui » et du cockpit :
// l'avis « Annuler » qui reste dix secondes après une tâche cochée, la relance d'un prestataire
// (relance inscrite, puis messagerie de la planner ouverte sur un message prérempli), le report.
import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { postponeTaskAction, remindVendorAction, undoTaskAction, type PostponeState, type RemindState } from "./actions";

const UNDO_SECONDS = 10;

export function UndoTaskNotice({ eventId, taskId, message, undoLabel, returnTo }: { eventId: string; taskId: string; message: string; undoLabel: string; returnTo: "home" | "event" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      router.replace(pathname, { scroll: false });
    }, UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);
  if (!visible) return null;
  return (
    <div role="status" className="undo-notice">
      <span>{message}</span>
      <form action={undoTaskAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="button-ghost">
          {undoLabel}
        </button>
      </form>
    </div>
  );
}

export function RemindVendorButton({ eventId, candidateId, label, ariaLabel }: { eventId: string; candidateId: string; label: string; ariaLabel: string }) {
  const [state, formAction, pending] = useActionState<RemindState, FormData>(remindVendorAction, {});
  useEffect(() => {
    if (state.mailto) window.location.href = state.mailto;
  }, [state.mailto, state.nonce]);
  return (
    <form action={formAction} className="today-action">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <button type="submit" disabled={pending} aria-label={ariaLabel}>
        {label}
      </button>
      {state.message ? <p role="status">{state.message}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
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
  const [state, formAction, pending] = useActionState<PostponeState, FormData>(postponeTaskAction, {});
  return (
    <details className="postpone">
      <summary>{labels.summary}</summary>
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={taskId} />
        <label htmlFor={`postpone-${taskId}`}>{labels.date}</label>
        <input id={`postpone-${taskId}`} type="date" name="dueDate" required defaultValue={defaultDate} />
        <button type="submit" disabled={pending}>
          {labels.save}
        </button>
        {state.message ? <p role="status">{state.message}</p> : null}
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
    </details>
  );
}
