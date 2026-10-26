// Rôles (SOC-04, ADR 0013). Les rôles professionnels (titulaire, membre,
// Admin de la suite) doivent configurer la double authentification avant
// d'accéder au hub ; le rôle client (marié) y est seulement invité.
export const ROLES = ["owner", "member", "client", "admin"] as const;
export type Role = (typeof ROLES)[number];

const PROFESSIONAL_ROLES: readonly Role[] = ["owner", "member", "admin"];

export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}
