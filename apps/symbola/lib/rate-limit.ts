// Lot 16 (SEC-02, ADR 0044) — limitation de débit de l'app : connexion,
// double authentification, mot de passe oublié, recherche instantanée, envoi
// de fichiers. Chaque tentative compte pour l'adresse du client et pour le
// compte visé ; au-delà, la réponse dit combien de minutes attendre (429 pour
// une route, message dans le formulaire pour une action serveur).
import { headers as requestHeaders } from "next/headers";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { consumeRateLimits, purgeRateLimitEvents, type RateLimitDecision, type RateLimitRule } from "@symbola/db/rate-limit";

const MINUTE = 60_000;

type Window = { limit: number; windowMs: number };

// Réglages techniques de sécurité (pas des données métier) : larges pour un
// usage normal, bas pour une attaque. Le verrouillage par compte (5 échecs,
// ADR 0037) reste en place en plus.
export const RATE_LIMITS: Record<"login" | "mfa" | "passwordReset" | "search" | "upload", { ip: Window; account: Window }> = {
  login: { ip: { limit: 20, windowMs: 15 * MINUTE }, account: { limit: 10, windowMs: 15 * MINUTE } },
  mfa: { ip: { limit: 20, windowMs: 15 * MINUTE }, account: { limit: 10, windowMs: 15 * MINUTE } },
  passwordReset: { ip: { limit: 5, windowMs: 60 * MINUTE }, account: { limit: 3, windowMs: 60 * MINUTE } },
  search: { ip: { limit: 300, windowMs: MINUTE }, account: { limit: 120, windowMs: MINUTE } },
  upload: { ip: { limit: 60, windowMs: 10 * MINUTE }, account: { limit: 30, windowMs: 10 * MINUTE } },
};

export type RateLimitedAction = keyof typeof RATE_LIMITS;

// Tentatives gardées un jour au plus, à l'heure près (registre de données).
const RETENTION_MS = 24 * 60 * MINUTE;
const PURGE_INTERVAL_MS = 60 * MINUTE;

// Adresse du client : la dernière de X-Forwarded-For, celle qu'a vue le
// proxy (Caddy en production, Traefik en développement) ; Caddy remplace
// l'en-tête envoyé par le client, qui ne peut donc pas choisir son adresse.
// Next.js ne pose l'en-tête que s'il manque, avec l'adresse de la connexion :
// sans proxy devant l'app (tests de bout en bout, poste local), c'est une
// adresse de bouclage, qui ne désigne personne. Pas d'adresse alors : seule
// la limite par compte s'applique.
const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const address = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  return address && !LOOPBACK.test(address) ? address : null;
}

export function rateLimitRules(action: RateLimitedAction, subject: { ip: string | null; account: string | null }): RateLimitRule[] {
  const windows = RATE_LIMITS[action];
  const rules: RateLimitRule[] = [];
  if (subject.ip) rules.push({ bucket: `${action}.ip`, key: subject.ip, ...windows.ip });
  const account = subject.account?.trim().toLowerCase();
  if (account) rules.push({ bucket: `${action}.account`, key: account, ...windows.account });
  return rules;
}

// `headers` : ceux de la requête d'une route ; une action serveur les lit d'elle-même.
export async function checkRateLimit(action: RateLimitedAction, subject: { account: string | null; headers?: Headers }): Promise<RateLimitDecision> {
  const ip = clientIpFrom(subject.headers ?? (await requestHeaders()));
  return consumeRateLimits(appDatabase(), rateLimitRules(action, { ip, account: subject.account }));
}

export async function rateLimitMessage(retryAfterSeconds: number): Promise<string> {
  const t = await getTranslations("RateLimit");
  return t("tooMany", { minutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)) });
}

// Réponse d'une route refusée : 429, délai en secondes, message traduit.
export async function rateLimitedResponse(decision: Extract<RateLimitDecision, { allowed: false }>): Promise<Response> {
  return Response.json(
    { error: await rateLimitMessage(decision.retryAfterSeconds) },
    { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}

// Lancé au démarrage du serveur (instrumentation.ts) : purge horaire.
export function scheduleRateLimitPurge(): void {
  const run = () => {
    purgeRateLimitEvents(appDatabase(), new Date(Date.now() - RETENTION_MS)).catch((error: unknown) => {
      console.error("purge des tentatives limitées échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
