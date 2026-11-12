// Rôles (SOC-04, ADR 0013). Les rôles professionnels (titulaire, membre,
// Admin de la suite) doivent configurer la double authentification avant
// d'accéder au hub. Lot 26a (ADR 0053, décision D8) : plus de rôle « client » ;
// les tiers agissent par lien personnel, sans compte.
export const ROLES = ["owner", "member", "admin"] as const;
export type Role = (typeof ROLES)[number];

const PROFESSIONAL_ROLES: readonly Role[] = ["owner", "member", "admin"];

export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}

// PRD-EVT-06 : rôles de l'équipe d'une organisation (titulaire, membre), seuls
// admis sur les écrans de la planner ; l'Admin n'a aucune donnée métier
// (CLAUDE.md §5).
const PLANNER_ROLES: readonly Role[] = ["owner", "member"];

export function isPlannerRole(role: Role): boolean {
  return PLANNER_ROLES.includes(role);
}
