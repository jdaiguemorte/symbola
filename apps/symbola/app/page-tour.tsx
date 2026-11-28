"use client";

// Lot 10 (AIDE-05), refait au lot 13 (ADR 0033), au lot 16 (L16-HUB-19, ADR 0039), au lot 63f (HUB-11,
// ADR 0104) puis au lot 74d (D2 de l'audit, B11 ; page 25 des maquettes du lot 68) — un écran à visite
// guidée DÉCLARE sa visite et son texte d'aide. Quand la visite est proposée, une ligne discrète, sous
// l'en-tête : « Première fois sur cet écran ? … Découvrir cet écran en 1 minute », et une croix « Ne plus
// proposer cette visite ». Aucun bouton plein ; elle ne couvre rien. « Lancer » ou « Fermer » comptent
// la visite comme vue ; sa parution compte une venue (au plus une par jour, trois en tout). Ensuite,
// « ? › Revoir la visite de cet écran » la relance.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { PageTourState } from "@/lib/help/page-tour";
import { useHelpContext } from "./help-context";
import { recordHelpProgressAction, recordTourVenueAction } from "./actions";

export function PageTour({
  tourKey,
  stepCount,
  variant,
  offer,
  replay,
  line,
  helpTitle,
  helpBody,
  helpExtra,
}: PageTourState & {
  helpTitle: string;
  helpBody: string;
  helpExtra?: ReactNode;
}) {
  const help = useHelpContext();
  const declare = help?.declare;
  const withdraw = help?.withdraw;
  const startTour = help?.startTour;
  const id = useId();
  const [lineShown, setLineShown] = useState(offer === "line" && line !== null);
  const autoOpen = offer === "auto" || replay;

  useEffect(() => {
    if (!declare || !withdraw) return;
    declare(id, { title: helpTitle, body: helpBody, tour: { key: tourKey, stepCount, variant, autoOpen }, extra: helpExtra });
    return () => withdraw(id);
  }, [declare, withdraw, id, helpTitle, helpBody, tourKey, stepCount, variant, autoOpen, helpExtra]);

  // La ligne a paru : une venue (le serveur n'en compte qu'une par jour).
  const counted = useRef(false);
  useEffect(() => {
    if (!lineShown || counted.current) return;
    counted.current = true;
    void recordTourVenueAction(tourKey);
  }, [lineShown, tourKey]);

  if (!lineShown || !line || !help) return null;
  return (
    <aside className="tour-line" aria-label={line.label}>
      <span className="tour-line-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-1.5 5.5 5 3.5-5 3.5v-7Z" fill="currentColor" />
        </svg>
      </span>
      <p className="tour-line-text">
        <span className="tour-line-lead">{line.lead}</span>{" "}
        <button
          type="button"
          className="tour-line-start"
          onClick={() => {
            setLineShown(false);
            startTour?.();
          }}
        >
          {line.start}
        </button>
      </p>
      <button
        type="button"
        className="tour-line-close"
        aria-label={line.close}
        title={line.close}
        onClick={() => {
          setLineShown(false);
          void recordHelpProgressAction(`tour:${tourKey}`, "completed", 0);
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
