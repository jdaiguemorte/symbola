// Porte d'entrée publique de @symbola/auth (SOC-04, ADR 0013 ; lot 33 : ADR 0052 et 0067). Aucun
// autre code n'importe un fichier interne du package ni une lib sous-jacente (openid-client)
// directement — tout passe par ici.
export {
  accountIdentity,
  addMembership,
  createOrganization,
  createUser,
  destroySession,
  ensureMembership,
  findSessionActor,
  listOrganizations,
  PROVISIONAL_ORGANIZATION_NAME,
  requireUser,
  setUserLanguage,
  signInWithIdentity,
  switchOrganization,
  type AuthenticatedUser,
  type AuthResult,
  type NewDeviceAlert,
  SESSION_ACTIVITY_STEP_MS,
  type SignInOutcome,
} from "./service";
// Lot 33 (SEC-01, SEC-07) : fournisseur d'identité.
export {
  createManagementClient,
  IdentityProviderError,
  MAGIC_LINK_TTL_SECONDS,
  type IdentityConnection,
  identityConnectionFromEnv,
  IDENTITY_WEBHOOK_EVENTS,
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
export { IDENTITY_WEBHOOK_NAME, identityWebhookUrl } from "./identity/settings";
export {
  countAccountsByOrganization,
  findTeamAccountOrganization,
  listTeamAccounts,
  MfaResetNotAllowedError,
  resetIdentityMfa,
  type OrganizationAccountCounts,
  type TeamAccountStatus,
} from "./support";
export { purgeConnectionTraces } from "./connection-journal";
// Clé de l'app (MFA_ENCRYPTION_KEY) : depuis le lot 33, elle scelle les liens magiques.
export { MfaKeyError, readMfaEncryptionKey } from "./secret-box";
export { isAccountingReaderRole, isPlannerRole, isProfessionalRole, requiresMfa, ROLES, type MembershipRole, type Role } from "./roles";
// Lot 24b (SEC-06, décision D3) : équipe, retrait d'un accès, déconnexion de tous les appareils.
// Lot 52 (HUB-04) : le retrait ferme aussi les sessions du fournisseur d'identité.
export { listTeam, removeMember, revokeOtherSessions, type ProviderSessionCloser, type RemoveMemberOutcome, type TeamMember } from "./team";
// Lot 52 (HUB-05, SEC-08) : sessions et appareils d'un compte, « Ce n'est pas moi ».
export {
  closeAccountSession,
  closeAllAccountSessions,
  disownDeviceAlert,
  isDeviceAlertTokenValid,
  KNOWN_DEVICE_RETENTION_MS,
  listAccountSessions,
  listKnownDevices,
  purgeKnownDevices,
  type AccountSession,
  type CloseSessionOutcome,
  type DisownedDevice,
} from "./sessions";
export { DEVICE_BROWSERS, DEVICE_SYSTEMS, parseDeviceLabel, type DeviceBrowser, type DeviceLabel, type DeviceSystem } from "./devices";
// Lot 52 (HUB-04, D1) : transfert de propriété.
export {
  cancelOwnershipTransfer,
  confirmOwnershipTransfer,
  describeOwnershipTransfer,
  findPendingOwnershipTransfer,
  OWNERSHIP_TRANSFER_TTL_MS,
  requestOwnershipTransfer,
  type ConfirmOwnershipTransferOutcome,
  type OwnershipTransferInfo,
  type PendingOwnershipTransfer,
  type RequestOwnershipTransferOutcome,
} from "./ownership";
// Lot 52 (SEC-02, D5) : bandeau de double authentification des Planners.
export { dismissMfaPrompt, isMfaPromptDue, mfaPromptDismissedAt, MFA_PROMPT_INTERVAL_MS } from "./mfa-prompt";
// Lot 52 (SEC-08, D6) : webhook signé du fournisseur d'identité et alertes de changement d'identité.
export {
  IDENTITY_WEBHOOK_MAX_BYTES,
  IDENTITY_WEBHOOK_SIGNATURE_HEADER,
  identityWebhookDeliveryKey,
  isIdentityWebhookSigned,
  mfaFactorsFingerprint,
  readIdentityWebhook,
  type IdentityWebhookEvent,
} from "./identity/webhook";
export {
  listUnsentIdentityAlerts,
  markIdentityAlertSent,
  purgeIdentityAlerts,
  recordIdentityChange,
  type IdentityAlert,
  type IdentityChangeKind,
} from "./identity-changes";
// Socle des lots 46 et 49 (ADR 0079) : chiffrement au niveau du champ (DAT-08), avec sa propre
// clé DATA_ENCRYPTION_KEY, et jeton des liens personnels commun aux modules (SEC-14, ADR 0053).
export {
  DataKeyError,
  FieldUnreadableError,
  isSealedField,
  openField,
  readDataEncryptionKey,
  sealField,
  type FieldPlace,
} from "./field-box";
export { formatLinkToken, hashLinkSecret, newLinkSecret, parseLinkToken } from "./link-token";
