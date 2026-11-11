"use client";

// Lot 13 (AIDE-11, ADR 0033), revu au lot 16 (L16-HUB-19, ADR 0039) — aide d'un
// écran sans repères. Dans l'app, l'écran DÉCLARE son texte d'aide : le « ? »
// de la barre du haut l'ouvre. Hors de l'app (connexion, double
// authentification, invitation : pas de barre du haut), le bouton reste dans
// la page.
import { useEffect, useId, useState } from "react";
import { Landmarks } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";

export function ScreenHelp({ title, body }: { title: string; body: string }) {
  const t = useTranslations("Landmarks");
  const help = useHelpContext();
  const declare = help?.declare;
  const withdraw = help?.withdraw;
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!declare || !withdraw) return;
    declare(id, { title, body, steps: [] });
    return () => withdraw(id);
  }, [declare, withdraw, id, title, body]);

  if (help) return null;
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
