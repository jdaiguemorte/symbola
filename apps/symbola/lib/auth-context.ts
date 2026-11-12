// Plomberie HTTP (cookie) pour SOC-04 — ne contient aucune logique
// d'authentification : tout est délégué à @symbola/auth (seule porte
// d'entrée, ADR 0013). Ce fichier ne fait que lire/écrire le cookie de
// session httpOnly et appeler requireUser().
// Plomberie pure : pas d'import "next/server" ici. Importer next/server
// (after()) dans ce fichier a cassé setSessionCookie()/cookies() sur une
// requête ultérieure (login) en dev — bundling Server Actions perturbé,
// même quand after() n'était jamais exécuté. La collecte d'usage (SOC-13,
// ADR 0017) est câblée séparément, au niveau de chaque page protégée
// (voir app/page.tsx), pas ici.
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { registerActorResolver, type Actor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { findSessionActor, isPlannerRole, requireUser, type AuthResult } from "@symbola/auth";

// Lot 24b (SEC-05) : nom et réglages du cookie partagés avec le middleware.
export { SESSION_COOKIE_NAME } from "./session-cookie";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./session-cookie";
// L16-SEC-03 (lot 16, ADR 0038) : appareil de confiance, dispensé du code de double
// authentification pendant 90 jours ; seul son hachage est en base.
export const TRUSTED_DEVICE_COOKIE_NAME = "symbola_appareil";
const TRUSTED_DEVICE_MAX_AGE_S = 90 * 24 * 60 * 60;

// Lot 23 (partie B, ADR 0060) : l'auteur des écritures en base est la personne
// connectée de la requête en cours. withOrganization (packages/db) appelle ce
// résolveur à chaque transaction ; un petit cache évite de relire la session
// à chaque fois (5 secondes : l'attribution, pas l'autorisation, qui reste
// vérifiée à chaque requête par les gardes). Hors requête, cookies() échoue et
// l'auteur est « system ».
const ACTOR_CACHE_MS = 5_000;
const ACTOR_CACHE_MAX = 500;
const actorCache = new Map<string, { actor: Actor | null; until: number }>();

export async function resolveRequestActor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const key = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const cached = actorCache.get(key);
  if (cached && cached.until > now) return cached.actor;
  const actor = await findSessionActor(appDatabase(), token);
  if (actorCache.size >= ACTOR_CACHE_MAX) actorCache.clear();
  actorCache.set(key, { actor, until: now + ACTOR_CACHE_MS });
  return actor;
}

registerActorResolver(resolveRequestActor);

export async function getAuthContext(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const db = appDatabase();
  return await requireUser(db, token);
}

// PRD-EVT-06 : écrans et actions de la planner. L'Admin y reçoit « forbidden » : le type oblige chaque page à le traiter, et
// toute action qui n'accepte que « authenticated » le refuse d'office.
export type PlannerAuthResult = AuthResult | { status: "forbidden"; role: string };

export function toPlannerAuth(result: AuthResult): PlannerAuthResult {
  if (result.status !== "authenticated") return result;
  if (!isPlannerRole(result.user.role)) return { status: "forbidden", role: result.user.role };
  return result;
}

export async function getPlannerAuthContext(): Promise<PlannerAuthResult> {
  return toPlannerAuth(await getAuthContext());
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function setTrustedDeviceCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRUSTED_DEVICE_MAX_AGE_S,
  });
}

export async function getTrustedDeviceToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
}

export async function clearTrustedDeviceCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE_NAME);
}
