"use client";

// Lot 13 (AIDE-11, ADR 0033) — bouton « ? » d'un écran sans repères : il
// ouvre le même panneau que les repères, avec le seul texte d'aide de
// l'écran (remplace la bulle dépliée de l'AIDE-03).
import { useState } from "react";
import { Landmarks } from "@symbola/ui";
import { useTranslations } from "next-intl";

export function ScreenHelp({ title, body }: { title: string; body: string }) {
  const t = useTranslations("Landmarks");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="help-button"
        data-tour="help-button"
        aria-expanded={open}
        aria-label={t("toggle")}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      <Landmarks
        open={open}
        intro={body}
        steps={[]}
        labels={{
          panel: t("panel", { screen: title }),
          close: t("close"),
          previous: t("previous"),
          next: t("next"),
          marker: (number, markerTitle) => t("marker", { number, title: markerTitle }),
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
