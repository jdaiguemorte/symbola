"use client";

// Lot 74a (critère 7) : « Votre espace est prêt » s'ouvre par son haut, même quand la dernière question avait
// été défilée jusqu'à « Continuer » (la position était gardée après la redirection de l'action, sur téléphone).
import { useEffect } from "react";

export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
