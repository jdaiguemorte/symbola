// Lot 16 (L16-HUB-19, ADR 0039) — en-tête commun d'un écran : titre (et son
// badge de statut), sous-titre, actions à droite. L'action principale est le
// seul bouton plein ; l'aide n'y figure plus (le « ? » est dans la barre du haut).
import type { ReactNode } from "react";

export function PageHeader({
  title,
  badge,
  subtitle,
  actions,
}: {
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {badge ? (
          <div className="title-with-badge">
            <h1>{title}</h1>
            {badge}
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        {subtitle ? <p className="meta">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
