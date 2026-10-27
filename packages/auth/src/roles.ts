// Rôles (SOC-04, ADR 0013). Les rôles professionnels (titulaire, membre,
// Admin de la suite) doivent configurer la double authentification avant
// d'accéder au hub ; le rôle client (marié) y est seulement invité.
export const ROLES = ["owner", "member", "client", "admin"] as const;
export type Role = (typeof ROLES)[number];

const PROFESSIONAL_ROLES: readonly Role[] = ["owner", "member", "admin"];

export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}

// EVT-06 : rôles de l'équipe d'une organisation (titulaire, membre), seuls
// admis sur les écrans de la planner. Un marié (client) n'a accès qu'à son
// espace ; l'Admin n'a aucune donnée métier (CLAUDE.md §5).
const PLANNER_ROLES: readonly Role[] = ["owner", "member"];

export function isPlannerRole(role: Role): boolean {
  return PLANNER_ROLES.includes(role);
}
