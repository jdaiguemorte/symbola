"use client";

// Lot 13 (AIDE-11, ADR 0033), revu au lot 16 (L16-HUB-19, ADR 0039) et au lot 63f (ADR 0104) —
// aide d'un écran sans visite guidée. Dans l'app, l'écran DÉCLARE son texte d'aide : le « ? »
// de la barre du haut l'ouvre. Hors de l'app (connexion, double
// authentification, invitation : pas de barre du haut), le bouton reste dans
// la page.
import { useEffect, useId, useState } from "react";
import { HelpDrawer } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";
import { useInSettingsPanel } from "./ui/screen-main";

export function ScreenHelp({ title, body }: { title: string; body: string }) {
  const t = useTranslations("HelpUi");
  const help = useHelpContext();
  const declare = help?.declare;
  const withdraw = help?.withdraw;
  const id = useId();
  const [open, setOpen] = useState(false);
  const inPanel = useInSettingsPanel();

  useEffect(() => {
    if (!declare || !withdraw) return;
    declare(id, { title, body });
    return () => withdraw(id);
  }, [declare, withdraw, id, title, body]);

  if (help) return null;
  // Lot 65 (recette du 22/11) : dans le panneau latéral des réglages, l'aide se déplie dans le panneau
  // lui-même ; un second panneau par-dessus faisait un « millefeuille ».
  if (inPanel) {
    return (
      <details className="settings-panel-help">
        <summary>{t("panel", { screen: title })}</summary>
        <p>{body}</p>
      </details>
    );
  }
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
      <HelpDrawer open={open} intro={body} labels={{ panel: t("panel", { screen: title }), close: t("close"), replay: t("replay") }} onClose={() => setOpen(false)} />
    </>
  );
}
