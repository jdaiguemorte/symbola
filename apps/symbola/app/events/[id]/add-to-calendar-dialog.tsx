"use client";

// Lot 64 (HUB-29 ; D5 ; maquette M4) — « Ajouter à mon agenda » : la fenêtre dit où va le fichier (dans
// l'agenda principal, celui que lit un outil de réservation extérieur), comment l'importer, et qu'il
// ne suit pas les changements ; puis le téléchargement.
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { AttentionNotice } from "@/app/ui/notices";

export function AddToCalendarDialog({ eventId }: { eventId: string }) {
  const t = useTranslations("Busy");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button type="button" className="button-secondary" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        {t("addToCalendar")}
      </button>
      <dialog ref={dialogRef} className="form-dialog" aria-labelledby={titleId}>
        <h2 id={titleId}>{t("addToCalendar")}</h2>
        <p className="form-dialog-intro">{t("addToCalendarIntro")}</p>
        <ol className="busy-steps">
          <li>{t("addToCalendarStep1")}</li>
          <li>{t("addToCalendarStep2")}</li>
        </ol>
        <AttentionNotice>{t("addToCalendarWarning")}</AttentionNotice>
        <div className="form-dialog-actions">
          <button type="button" className="button-secondary" onClick={() => dialogRef.current?.close()}>
            {t("close")}
          </button>
          <a className="button-link button-link-primary" href={`/events/${eventId}/agenda`} download onClick={() => dialogRef.current?.close()}>
            {t("download")}
          </a>
        </div>
      </dialog>
    </>
  );
}
