"use client";

// Lot 63d (PRE-02, UX-13 ; Q42 bis, ADR 0107) — la fenêtre de modification d'une ligne d'un écran de
// choix (prestataires consultés d'un poste, demande de décision) : le bouton de la ligne l'ouvre, sans
// quitter l'écran. Fenêtre native : fond assombri, focus gardé dedans, Échap ferme ; sur téléphone, elle
// occupe l'écran, avec « Retour ». Une seule fenêtre à la fois (DESIGN.md).
import { forwardRef, useId, useImperativeHandle, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export type EditDialogHandle = { open: () => void; close: () => void };

export const EditDialog = forwardRef<
  EditDialogHandle,
  { title: string; trigger?: { label: string; ariaLabel?: string; className?: string }; long?: boolean; children: ReactNode }
>(function EditDialog({ title, trigger, long = false, children }, handle) {
  const t = useTranslations("Common");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useImperativeHandle(handle, () => ({ open: () => dialog.current?.showModal(), close: () => dialog.current?.close() }), []);
  return (
    <>
      {trigger ? (
        <button type="button" className={trigger.className ?? "button-secondary"} aria-label={trigger.ariaLabel} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
          {trigger.label}
        </button>
      ) : null}
      <dialog ref={dialog} className={`task-dialog${long ? " task-dialog-long" : ""}`} aria-labelledby={titleId}>
        <div className="task-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="button-ghost" onClick={() => dialog.current?.close()}>
            <span className="task-dialog-back">{t("dialogBack")}</span>
            <span className="task-dialog-x">{t("dialogClose")}</span>
          </button>
        </div>
        <div className="task-dialog-body">
          <div className="task-dialog-content">{children}</div>
        </div>
      </dialog>
    </>
  );
});
