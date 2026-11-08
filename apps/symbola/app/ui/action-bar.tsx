// Lot 16 (IMP-11, ADR 0041) — barre d'action fixe en bas d'un assistant :
// « Retour » à gauche, l'action principale (« Continuer », qui enregistre) à
// droite. `children` : le bouton principal, lié au formulaire de l'étape par
// son attribut `form`, ou un lien.
import Link from "next/link";
import type { ReactNode } from "react";

export function ActionBar({ label, backHref, backLabel, children }: { label: string; backHref: string | null; backLabel: string; children: ReactNode }) {
  return (
    <div className="action-bar" role="group" aria-label={label}>
      {backHref ? (
        <Link href={backHref} className="button-link">
          {backLabel}
        </Link>
      ) : (
        <span />
      )}
      <div className="action-bar-main">{children}</div>
    </div>
  );
}
