"use client";

// Lot 16 (L16-HUB-19, ADR 0039), revu au lot 63f (ADR 0104) et au lot 74d (C-06 ; page 25 des
// maquettes du lot 68) — le tiroir de l'aide d'un écran, ouvert par le « ? » : en tête, quand l'écran
// a une visite guidée, « Revoir la visite de cet écran », son nombre de bulles et sa durée, et
// « Lancer » ; puis le texte de l'écran et son action propre (essai guidé…). Un écran sans visite ne
// la promet pas. Rien n'est bloqué : le tiroir pousse le contenu ; Échap ferme.
import { useEffect, useId, useRef, type ReactNode } from "react";

export type HelpDrawerLabels = {
  panel: string;
  close: string;
  // « Revoir la visite de cet écran », « 3 bulles, 1 minute », « Lancer ».
  replay: string;
  replayMeta?: string;
  replayStart?: string;
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
  const replayId = useId();

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
      {onReplay ? (
        <div className="help-drawer-tour">
          <p id={replayId} className="help-drawer-tour-text">
            <strong>{labels.replay}</strong>
            {labels.replayMeta ? <span className="help-drawer-tour-meta">{labels.replayMeta}</span> : null}
          </p>
          <button type="button" className="button-secondary help-drawer-replay" onClick={onReplay} aria-describedby={replayId}>
            {labels.replayStart ?? labels.replay}
          </button>
        </div>
      ) : null}
      <p className="help-drawer-intro">{intro}</p>
      {extra ? <div className="help-drawer-extra">{extra}</div> : null}
    </aside>
  );
}
