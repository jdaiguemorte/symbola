"use client";

// Lot 20 (PRE-17) — une action lourde (archiver un prestataire…) se confirme
// dans une fenêtre qui nomme ce qui va changer. La fenêtre est un <dialog>
// natif : focus gardé dedans, Échap pour annuler.
import { useId, useRef, type ReactNode } from "react";

export function ConfirmDialog({
  trigger,
  triggerLabel,
  triggerClassName,
  title,
  body,
  confirmLabel,
  cancelLabel,
  action,
  fields,
}: {
  trigger: ReactNode;
  // Libellé accessible du bouton qui ouvre la fenêtre (le texte visible peut être court).
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  return (
    <>
      <button type="button" className={triggerClassName} aria-label={triggerLabel} aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        {trigger}
      </button>
      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        <form action={action} className="confirm-dialog-actions">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()}>
            {cancelLabel}
          </button>
          <button type="submit" className="confirm-dialog-confirm">
            {confirmLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
