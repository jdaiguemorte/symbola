"use client";

// Lot 16 (L16-HUB-19, ADR 0039), revu au lot 63f (ADR 0104) — le tiroir de l'aide d'un écran,
// ouvert par le « ? » : le texte de l'écran, son action propre (essai guidé…) et, quand l'écran a
// une visite guidée, « Revoir la visite ». Plus de liste de repères. Rien n'est bloqué : le tiroir
// pousse le contenu ; Échap ferme.
import { useEffect, useRef, type ReactNode } from "react";

export type HelpDrawerLabels = {
  panel: string;
  close: string;
  replay: string;
};

export function HelpDrawer({
  open,
  intro,
  labels,
  onClose,
  onReplay,
  extra,
}: {
  open: boolean;
  intro: string;
  labels: HelpDrawerLabels;
  onClose: () => void;
  // Absent : l'écran n'a pas de visite guidée.
  onReplay?: (() => void) | undefined;
  extra?: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside className="help-drawer" aria-label={labels.panel}>
      <div className="help-drawer-head">
        <h2 ref={titleRef} tabIndex={-1}>
          {labels.panel}
        </h2>
        <button type="button" className="help-drawer-close" onClick={onClose} aria-label={labels.close}>
          ×
        </button>
      </div>
      <p className="help-drawer-intro">{intro}</p>
      {onReplay ? (
        <button type="button" className="button-secondary help-drawer-replay" onClick={onReplay}>
          {labels.replay}
        </button>
      ) : null}
      {extra ? <div className="help-drawer-extra">{extra}</div> : null}
    </aside>
  );
}
