"use client";

// Lot 13 (EVT-19) — bandeau « Prochaine étape » : l'action proposée vient du
// serveur ; « Plus tard » la masque pour cet événement et cette étape, dans
// ce navigateur (préférence d'affichage, sans donnée personnelle).
import { useEffect, useState, type ReactNode } from "react";

export function NextStepBanner({ storageKey, title, laterLabel, children }: { storageKey: string; title: string; laterLabel: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Stockage indisponible : le bandeau reste affiché.
    }
  }, [storageKey]);

  if (hidden) return null;
  return (
    <section className="next-step" aria-labelledby="next-step-title">
      <div className="next-step-body">
        <h2 id="next-step-title">{title}</h2>
        {children}
      </div>
      <button
        type="button"
        className="button-ghost next-step-later"
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {
            // Sans stockage, le bandeau revient au prochain chargement.
          }
        }}
      >
        {laterLabel}
      </button>
    </section>
  );
}
