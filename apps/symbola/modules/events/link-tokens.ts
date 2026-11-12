// Lot 26a (SEC-14, SEC-15, SEC-17, POR-10 ; ADR 0053, décisions D4 et D7) —
// règles pures des liens personnels : jeton, expiration, droits. Sans base ni
// horloge implicite : chaque fonction reçoit l'instant qu'elle juge.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { parisToday } from "@symbola/i18n";
import { starterLinkExpiry } from "@symbola/starter-templates";
import { LINK_RUBRICS, type EventLinkRights, type EventLinkStatus, type LinkAudience } from "@symbola/contracts";
import { addDays } from "./schedule";

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

// SEC-15, décision D4 : dernier jour valable (AAAA-MM-JJ, heure de Paris). La
// date choisie par la planner, sinon la date de l'événement plus le délai du
// public, sinon (pas encore de date) un délai après la création. Calculé à
// chaque lecture : un report garde des liens valables.
export function linkExpiresOn(input: {
  audience: LinkAudience;
  customExpiresOn: string | null;
  eventDate: string | null;
  createdAt: Date;
}): string {
  if (input.customExpiresOn) return input.customExpiresOn;
  const policy = starterLinkExpiry();
  if (input.eventDate) return addDays(input.eventDate, policy.daysAfterEvent[input.audience]);
  return addDays(parisToday(input.createdAt), policy.daysWithoutEventDate);
}

// Valable jusqu'à la fin de son dernier jour, à Paris.
export function isLinkExpired(expiresOn: string, now: Date): boolean {
  return parisToday(now) > expiresOn;
}

// Instant où commence un jour à Paris : minuit vaut 23 h UTC la veille en
// hiver, 22 h UTC en été (les changements d'heure ont lieu la nuit, après minuit).
export function parisStartOfDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(Date.UTC(year, month - 1, date, -offsetHours));
    if (parisToday(candidate) === day && parisToday(new Date(candidate.getTime() - 1)) !== day) return candidate;
  }
  return new Date(Date.UTC(year, month - 1, date, -1));
}

// Premier instant où le lien ne vaut plus.
export function linkValidUntil(expiresOn: string): Date {
  return parisStartOfDay(addDays(expiresOn, 1));
}

// Décision D7 : une session de lien dure 30 jours sans visite, jamais au-delà
// de l'expiration du lien.
export const LINK_SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

export function linkSessionExpiresAt(expiresOn: string, now: Date): Date {
  return new Date(Math.min(now.getTime() + LINK_SESSION_IDLE_MS, linkValidUntil(expiresOn).getTime()));
}

export function linkStatus(input: { revokedAt: Date | null; expiresOn: string }, now: Date): EventLinkStatus {
  if (input.revokedAt) return "revoked";
  return isLinkExpired(input.expiresOn, now) ? "expired" : "active";
}

// POR-10 : seules les rubriques connues, dans l'ordre du portail ; des
// catégories seulement en « catégories choisies » avec la rubrique Budget.
export function normalizeLinkRights(rights: EventLinkRights): EventLinkRights {
  const rubrics = LINK_RUBRICS.filter((rubric) => rights.rubrics.includes(rubric));
  const budgetScope = rights.budgetScope === "selected" ? "selected" : "all";
  const sharedSlotIds =
    budgetScope === "selected" && rubrics.includes("budget")
      ? [...new Set(rights.sharedSlotIds)].filter((id) => z.uuid().safeParse(id).success)
      : [];
  return { rubrics, budgetScope, sharedSlotIds };
}
