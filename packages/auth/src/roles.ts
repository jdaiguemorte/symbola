// Rôles (SOC-04, ADR 0013). Les rôles professionnels (titulaire, membre,
// Admin de la suite) doivent configurer la double authentification avant
// d'accéder au hub. Lot 26a (ADR 0053, décision D8) : plus de rôle « client » ;
// les tiers agissent par lien personnel, sans compte.
// Lot 52 (réponse de Julien du 18/11 au lot 58 ; ADR 0094) : « accountant », le comptable en lecture
// seule des factures, avoirs, encaissements, journaux, exports et e-reporting.
export const ROLES = ["owner", "member", "accountant", "admin"] as const;
export type Role = (typeof ROLES)[number];
// Rôle d'une adhésion à une organisation (l'Exploitation n'en a pas).
export type MembershipRole = Exclude<Role, "admin">;

const PROFESSIONAL_ROLES: readonly Role[] = ["owner", "member", "accountant", "admin"];

export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}

// PRD-EVT-06 : rôles de l'équipe d'une organisation (titulaire, membre), seuls
// admis sur les écrans de la planner ; l'Admin n'a aucune donnée métier
// (CLAUDE.md §5). Le comptable n'y entre pas : il a ses seuls écrans de lecture.
const PLANNER_ROLES: readonly Role[] = ["owner", "member"];

export function isPlannerRole(role: Role): boolean {
  return PLANNER_ROLES.includes(role);
}

// Lot 52 : lecture comptable (factures, avoirs, encaissements, journaux, exports, e-reporting).
export function isAccountingReaderRole(role: Role): boolean {
  return role === "owner" || role === "member" || role === "accountant";
}

// SEC-02 (D5) : la double authentification est exigée pour la Propriétaire, l'Exploitation et le
// Comptable ; proposée aux Planners.
const MFA_REQUIRED_ROLES: readonly Role[] = ["owner", "accountant", "admin"];

export function requiresMfa(role: Role): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
