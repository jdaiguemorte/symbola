"use client";

// AIDE-03 — « Chaque écran a un bouton « ? » qui ouvre un article court
// sur ce que l'on peut y faire. » <details>/<summary> : accessible et
// sans état JS à gérer, cohérent avec le reste de l'app (aucun style).
// AIDE-01 — « [La visite guidée] se relance à tout moment depuis le
// bouton « ? » du module » : même bouton, lien optionnel en plus de
// l'article (relaunchLabel/onRelaunchTour), pour ne pas multiplier les
// affordances « ? » sur un même écran.
export function HelpButton({
  title,
  body,
  relaunchLabel,
  onRelaunchTour,
}: {
  title: string;
  body: string;
  relaunchLabel?: string;
  onRelaunchTour?: () => void;
}) {
  return (
    <details>
      <summary aria-label={title}>?</summary>
      <h3>{title}</h3>
      <p>{body}</p>
      {onRelaunchTour ? (
        <button type="button" onClick={onRelaunchTour}>
          {relaunchLabel}
        </button>
      ) : null}
    </details>
  );
}
