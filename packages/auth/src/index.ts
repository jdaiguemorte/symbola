// Porte d'entrée publique de @symbola/auth (SOC-04, ADR 0013). Aucun autre
// code n'importe un fichier interne du package (password.ts, totp.ts,
// session-token.ts…) ni une lib sous-jacente (@node-rs/argon2, otpauth)
// directement — tout passe par ici.
export {
  confirmTotp,
  createOrganization,
  createUser,
  destroySession,
  login,
  requireUser,
  setupTotp,
  type AuthenticatedUser,
  type AuthResult,
  type LoginResult,
} from "./service";
export { isProfessionalRole, ROLES, type Role } from "./roles";
