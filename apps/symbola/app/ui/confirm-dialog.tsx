"use client";

// Lot 20 (L20-PRE-17) — une action lourde (archiver un prestataire…) se confirme
// dans une fenêtre qui nomme ce qui va changer. La fenêtre est un <dialog>
// natif : focus gardé dedans, Échap pour annuler.
// Lot 63g (ADR 0108) : une confirmation sans danger (tone « primary », bouton principal) et un détail
// sous le texte (montants, ce que voit l'équipe Symbola).
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
  tone = "danger",
  children,
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
  tone?: "danger" | "primary";
  children?: ReactNode;
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
        {children ? <div className="confirm-dialog-details">{children}</div> : null}
        <form action={action} className="confirm-dialog-actions">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()}>
            {cancelLabel}
          </button>
          <button type="submit" className={tone === "danger" ? "confirm-dialog-confirm" : undefined}>
            {confirmLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
