"use client";

// Lot 73c (PRE-02 ; spécification du lot 73, § 5.3, critère 1) — « Ajouter à un mariage… » dans l'en-tête de
// la fiche : la même fenêtre que le carnet, montée au clic.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddToEventDialog } from "./add-to-event-dialog";

export function AddToEventButton({ vendorId, vendorName, primary = false }: { vendorId: string; vendorName: string; primary?: boolean }) {
  const t = useTranslations("VendorBook");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={primary ? "button-primary" : "button-secondary"} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("addToEvent.button")}
      </button>
      {open ? <AddToEventDialog vendorIds={[vendorId]} names={[vendorName]} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
