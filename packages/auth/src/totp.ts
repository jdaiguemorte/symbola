// TOTP (SOC-04, ADR 0013) : MFA obligatoire pour les rôles professionnels,
// facultative pour les mariés (rôle "client").
import * as OTPAuth from "otpauth";

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotpProvisioningUri(options: { secret: string; email: string }): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Symbola",
    label: options.email,
    secret: OTPAuth.Secret.fromBase32(options.secret),
  });
  return totp.toString();
}

export function verifyTotpToken(options: { secret: string; token: string; timestamp?: number }): boolean {
  return matchTotpStep(options) !== null;
}

// SEC-01 (lot 16) : pas de temps (période de 30 s) du code reconnu, ou null.
// Le service l'enregistre pour refuser qu'un code serve deux fois (anti-rejeu).
export function matchTotpStep(options: { secret: string; token: string; timestamp?: number }): number | null {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(options.secret),
  });
  const timestamp = options.timestamp ?? Date.now();
  // window: 1 => tolère un décalage d'une période (30s) avant/après, pour
  // l'horloge du téléphone de l'utilisateur.
  const delta = totp.validate({ token: options.token, timestamp, window: 1 });
  return delta === null ? null : totp.counter({ timestamp }) + delta;
}
