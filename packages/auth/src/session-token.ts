// Jeton de session opaque (SOC-04, ADR 0013) : randomBytes(32) en
// base64url, jamais stocké en clair en base — seul son hash SHA-256 est
// conservé, pour qu'une fuite de la base ne permette pas de rejouer les
// sessions existantes.
import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
