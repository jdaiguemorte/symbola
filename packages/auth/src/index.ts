// Porte d'entrée publique de @symbola/auth (SOC-04, ADR 0013). Aucun autre
// code n'importe un fichier interne du package (password.ts, totp.ts,
// session-token.ts…) ni une lib sous-jacente (@node-rs/argon2, otpauth)
// directement — tout passe par ici.
export {
  confirmTotp,
  countTrustedDevices,
  createOrganization,
  createUser,
  destroySession,
  findAccountByEmail,
  findSessionActor,
  forgetTrustedDevices,
  login,
  requireUser,
  setUserLanguage,
  resumeTotpSetup,
  sealLegacyTotpSecrets,
  setupTotp,
  unsealTotpSecrets,
  type AuthenticatedUser,
  type ConfirmTotpResult,
  type AuthResult,
  type LoginOptions,
  type LoginResult,
} from "./service";
export {
  isPasswordResetTokenValid,
  MfaResetNotAllowedError,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_DURATION_MS,
  requestPasswordReset,
  resetPassword,
  resetUserMfa,
  type PasswordResetOutcome,
  type PasswordResetRequest,
} from "./recovery";
export {
  countAccountsByOrganization,
  findTeamAccountOrganization,
  listTeamAccounts,
  type OrganizationAccountCounts,
  type TeamAccountStatus,
} from "./support";
export { purgeConnectionTraces } from "./connection-journal";
export { MfaKeyError, readMfaEncryptionKey } from "./secret-box";
export { isPlannerRole, isProfessionalRole, ROLES, type Role } from "./roles";
