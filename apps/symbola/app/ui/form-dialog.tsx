"use client";

// Lot 64 (maquettes M2, M4) — une fenêtre qui porte un court formulaire : le bouton l'ouvre, le
// formulaire s'envoie à une action serveur, la fenêtre se ferme quand l'action réussit et dit
// l'erreur sinon. <dialog> natif : focus gardé dedans, Échap ou « Annuler » pour fermer.
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { ErrorNotice } from "./notices";

export type FormDialogState = { error?: string; success?: boolean; at?: number };

export function FormDialog({
  triggerLabel,
  triggerAccessibleLabel,
  triggerClassName = "button-secondary",
  title,
  intro,
  submitLabel,
  cancelLabel,
  action,
  children,
  wide = false,
}: {
  triggerLabel: string;
  // Le nom accessible du bouton, quand le libellé visible est court (« Modifier »).
  triggerAccessibleLabel?: string;
  triggerClassName?: string;
  title: string;
  intro?: string;
  submitLabel: string;
  cancelLabel: string;
  action: (state: FormDialogState, formData: FormData) => Promise<FormDialogState>;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state]);
  return (
    <>
      <button type="button" className={triggerClassName} aria-label={triggerAccessibleLabel} aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </button>
      <dialog ref={dialogRef} className={wide ? "form-dialog form-dialog-wide" : "form-dialog"} aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {intro ? <p className="form-dialog-intro">{intro}</p> : null}
        <form action={formAction} className="form-dialog-form">
          {children}
          {state.error ? <ErrorNotice>{state.error}</ErrorNotice> : null}
          <div className="form-dialog-actions">
            <button type="button" className="button-secondary" onClick={() => dialogRef.current?.close()}>
              {cancelLabel}
            </button>
            <button type="submit" disabled={pending}>
              {submitLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
