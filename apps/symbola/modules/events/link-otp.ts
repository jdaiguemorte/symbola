// Lot 26b (POR-01, SEC-14 ; ADR 0053, décision D6) — règles pures du code à
// usage unique demandé à l'ouverture d'un lien qui l'exige : six chiffres
// envoyés à l'e-mail du lien, valables dix minutes, cinq essais, un seul usage.
// Sans base ni horloge implicite : chaque fonction reçoit l'instant qu'elle juge.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const LINK_CODE_LENGTH = 6;
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_CODE_MAX_ATTEMPTS = 5;
// Au plus cinq codes par lien et par heure : au-delà, aucun e-mail ne part.
export const LINK_CODES_PER_HOUR = 5;

const CODE_PATTERN = /^\d{6}$/;

export function newLinkCode(): string {
  return randomInt(0, 10 ** LINK_CODE_LENGTH)
    .toString()
    .padStart(LINK_CODE_LENGTH, "0");
}

// Seul ce haché est stocké ; le lien entre dans le calcul pour qu'un même code
// n'ait pas le même haché sur deux liens.
export function hashLinkCode(linkId: string, code: string): string {
  return createHash("sha256").update(`${linkId}.${code}`).digest("hex");
}

// Ce que la personne tape : espaces et tirets tolérés (« 042 317 »).
export function normalizeLinkCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

export function linkCodeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + LINK_CODE_TTL_MS);
}

// Un code vaut tant qu'il n'est ni utilisé, ni expiré, ni épuisé.
export function isLinkCodeUsable(code: { consumedAt: Date | null; expiresAt: Date; attempts: number }, now: Date): boolean {
  return !code.consumedAt && code.expiresAt.getTime() > now.getTime() && code.attempts < LINK_CODE_MAX_ATTEMPTS;
}

// Comparaison en temps constant de deux hachés hexadécimaux.
export function sameLinkCodeHash(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

// L'adresse où le code est parti, masquée : « b•••@exemple.test ».
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
