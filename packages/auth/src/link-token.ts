// SEC-14 (lot 26a, ADR 0053 ; socle des lots 46 et 49) — jeton des liens
// personnels, commun à tous les modules qui ouvrent un accès sans compte
// (évènements, rendez-vous, invités). Déplacé de modules/events/link-tokens.ts,
// qui le réexporte : les nouveaux modules s'en servent sans franchir la
// frontière du module events (ARC-02).
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// SEC-14 : 256 bits aléatoires (le cahier des charges en demande 128 au moins).
const SECRET_BYTES = 32;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newLinkSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

// Seul ce haché est stocké (lien et session).
export function hashLinkSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

// Format de l'ADR 0053 : l'organisation, non secrète, permet la recherche sous
// RLS ; le secret ne quitte jamais le navigateur de la personne qu'en POST.
export function formatLinkToken(organizationId: string, secret: string): string {
  return `${organizationId}.${secret}`;
}

export function parseLinkToken(token: string): { organizationId: string; secret: string } | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [organizationId, secret] = parts as [string, string];
  if (!z.uuid().safeParse(organizationId).success || !SECRET_PATTERN.test(secret)) return null;
  return { organizationId, secret };
}
