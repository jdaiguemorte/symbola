// Porte d'entrée publique de @symbola/auth (SOC-04, ADR 0013). Aucun autre
// code n'importe un fichier interne du package (password.ts, totp.ts,
// session-token.ts…) ni une lib sous-jacente (@node-rs/argon2, otpauth)
// directement — tout passe par ici.
export {
  confirmTotp,
  createOrganization,
  createUser,
  destroySession,
  findAccountByEmail,
  login,
  requireUser,
  setUserLanguage,
  resumeTotpSetup,
  setupTotp,
  type AuthenticatedUser,
  type AuthResult,
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
export { isPlannerRole, isProfessionalRole, ROLES, type Role } from "./roles";
