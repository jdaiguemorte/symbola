// Lot 16 (PRE-14) — pastille d'une famille de prestataires : sa couleur et
// son pictogramme, pour que la famille ne soit jamais portée par la couleur
// seule (critère 1.4.1). La couleur passe par l'attribut SVG fill, jamais
// par un style en ligne (CSP stricte). Décorative : le libellé est à côté.
import { iconComponent } from "@/app/budget-line-icon";

export function FamilyIcon({ color, icon }: { color: string; icon: string | null }) {
  const Icon = iconComponent(icon);
  return (
    <span className="family-icon" aria-hidden="true">
      <svg className="family-icon-bg" viewBox="0 0 24 24" width="24" height="24" focusable="false">
        <circle cx="12" cy="12" r="12" fill={color} />
      </svg>
      <Icon size={14} strokeWidth={2.25} color="#ffffff" aria-hidden="true" />
    </span>
  );
}
