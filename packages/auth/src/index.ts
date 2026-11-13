// Porte d'entrée publique de @symbola/auth (SOC-04, ADR 0013 ; lot 33 : ADR 0052 et 0067). Aucun
// autre code n'importe un fichier interne du package ni une lib sous-jacente (openid-client)
// directement — tout passe par ici.
export {
  addMembership,
  createOrganization,
  createUser,
  destroySession,
  findSessionActor,
  listOrganizations,
  PROVISIONAL_ORGANIZATION_NAME,
  requireUser,
  setUserLanguage,
  signInWithIdentity,
  switchOrganization,
  type AuthenticatedUser,
  type AuthResult,
  type SignInOutcome,
} from "./service";
// Lot 33 (SEC-01, SEC-07) : fournisseur d'identité.
export {
  createManagementClient,
  IdentityProviderError,
  MAGIC_LINK_TTL_SECONDS,
  type IdentityConnection,
  type ManagementClient,
} from "./identity/management";
export {
  createOidcClient,
  IdentityClaimsError,
  MFA_ACR,
  type IdentityClaims,
  type OidcClient,
  type PendingAuthorization,
} from "./identity/oidc";
export { openMagicLink, sealMagicLink, type MagicLinkPayload } from "./identity/magic-link";
export {
  countAccountsByOrganization,
  findTeamAccountOrganization,
  listTeamAccounts,
  type OrganizationAccountCounts,
  type TeamAccountStatus,
} from "./support";
export { purgeConnectionTraces } from "./connection-journal";
// Clé de l'app (MFA_ENCRYPTION_KEY) : depuis le lot 33, elle scelle les liens magiques.
export { MfaKeyError, readMfaEncryptionKey } from "./secret-box";
export { isPlannerRole, isProfessionalRole, ROLES, type Role } from "./roles";
// Lot 24b (SEC-06, décision D3) : équipe, retrait d'un accès, déconnexion de tous les appareils.
export { listTeam, removeMember, revokeOtherSessions, type RemoveMemberOutcome, type TeamMember } from "./team";
