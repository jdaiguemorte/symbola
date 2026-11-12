"use server";

// Lot 26a (UX-11, SEC-14, SEC-15, SEC-17 ; ADR 0053, décisions D2 et D5) —
// ouverture d'un lien personnel et demande d'un nouveau lien. Le jeton arrive
// en POST (il était après « # » dans l'adresse, jamais envoyé au serveur) ; il
// n'est écrit nulle part. Débit limité par adresse IP (SEC-04).
import { z } from "zod";
import { openEventLink, requestLinkRenewal } from "@/modules/events/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { setLinkSessionCookie } from "@/lib/link-session";

export type OpenLinkOutcome = { outcome: "opened" } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };
export type RenewalOutcome = { outcome: "requested" } | { outcome: "retry"; minutes: number };

const tokenSchema = z.string().max(200);

// L'organisation (partie publique du jeton) sert de second compteur de débit.
function organizationOf(token: string): string | null {
  const organizationId = token.split(".")[0] ?? "";
  return z.uuid().safeParse(organizationId).success ? organizationId : null;
}

function minutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

export async function openLinkAction(token: unknown): Promise<OpenLinkOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("linkOpen", { account: organizationOf(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  const result = await openEventLink(parsed.data);
  if (result.outcome !== "opened") return { outcome: "invalid" };
  await setLinkSessionCookie(result.sessionToken, result.maxAgeSeconds);
  return { outcome: "opened" };
}

// Décision D5 : la même réponse, que le lien existe ou non.
export async function requestLinkRenewalAction(token: unknown): Promise<RenewalOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "requested" };
  const limit = await checkRateLimit("linkRenewal", { account: organizationOf(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  await requestLinkRenewal(parsed.data);
  return { outcome: "requested" };
}
