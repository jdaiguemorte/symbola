"use client";

// Lot 71d (HUB-14, P-16) — « Continuer » avec des choix restants mène au premier : l'adresse d'une
// redirection d'action serveur perd son ancre, l'écran s'y place donc lui-même à l'arrivée.
import { useEffect } from "react";

export function ScrollToChoice({ anchor }: { anchor: string }) {
  useEffect(() => {
    document.getElementById(anchor)?.scrollIntoView({ block: "center" });
  }, [anchor]);
  return null;
}
