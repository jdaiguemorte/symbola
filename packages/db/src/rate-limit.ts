// Lot 16 (L16-SEC-02, ADR 0044) — limitation de débit à fenêtre glissante, en
// base : une ligne par tentative acceptée, comptée sur la fenêtre de la règle.
// Une tentative refusée n'est pas enregistrée : qui attend le délai annoncé
// repasse. Les clés (adresse IP, e-mail, compte) ne sont gardées que sous
// forme d'empreinte.
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { AppDatabase } from "./client";
import { rateLimitEvents } from "./schema/core";

export type RateLimitRule = {
  // Ce qui est limité et selon quoi : « login.ip », « login.account »…
  bucket: string;
  // La valeur limitée (adresse IP, e-mail, identifiant du compte).
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = { allowed: true } | { allowed: false; bucket: string; retryAfterSeconds: number };

export function rateLimitKeyHash(bucket: string, key: string): string {
  return createHash("sha256").update(`${bucket}\u0000${key}`).digest("hex");
}

// Vérifie toutes les règles d'une tentative ; si aucune ne la refuse, la
// compte dans chacune. Le verrou consultatif de la transaction sérialise les
// tentatives d'une même clé : des requêtes simultanées ne dépassent pas la
// limite.
export async function consumeRateLimits(db: AppDatabase, rules: RateLimitRule[], now: Date = new Date()): Promise<RateLimitDecision> {
  if (rules.length === 0) return { allowed: true };
  const keyed = rules
    .map((rule) => ({ ...rule, keyHash: rateLimitKeyHash(rule.bucket, rule.key) }))
    .sort((a, b) => (a.keyHash < b.keyHash ? -1 : a.keyHash > b.keyHash ? 1 : 0));
  return db.transaction(async (tx) => {
    for (const rule of keyed) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`rate-limit:${rule.keyHash}`}, 0))`);
    for (const rule of keyed) {
      const since = new Date(now.getTime() - rule.windowMs);
      const recent = await tx
        .select({ createdAt: rateLimitEvents.createdAt })
        .from(rateLimitEvents)
        .where(and(eq(rateLimitEvents.bucket, rule.bucket), eq(rateLimitEvents.keyHash, rule.keyHash), gt(rateLimitEvents.createdAt, since)))
        .orderBy(asc(rateLimitEvents.createdAt));
      if (recent.length >= rule.limit) {
        // Une place se libère quand la plus ancienne des tentatives en trop sort de la fenêtre.
        const freedAt = recent[recent.length - rule.limit]!.createdAt.getTime() + rule.windowMs;
        return { allowed: false, bucket: rule.bucket, retryAfterSeconds: Math.max(1, Math.ceil((freedAt - now.getTime()) / 1000)) };
      }
    }
    await tx.insert(rateLimitEvents).values(keyed.map((rule) => ({ bucket: rule.bucket, keyHash: rule.keyHash, createdAt: now })));
    return { allowed: true };
  });
}

// Oublie les tentatives antérieures à `before` (purge régulière, 24 h au plus).
export async function purgeRateLimitEvents(db: AppDatabase, before: Date): Promise<number> {
  const deleted = await db.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, before)).returning({ id: rateLimitEvents.id });
  return deleted.length;
}

// Lot 24b (SEC-04) — délai croissant après des échecs répétés : à partir du
// dixième échec d'une même clé (compte ou adresse) dans les dernières 24 heures,
// la tentative suivante attend 1 minute après le dernier échec, puis 2, 4, 8…,
// jusqu'à 1 heure. Les échecs sont des lignes de la même table (empreintes
// seulement), purgées avec elles ; un succès efface ceux du compte.
export type FailureRule = { bucket: string; key: string };

export const FAILURE_THRESHOLD = 10;
const FAILURE_BASE_MS = 60_000;
const FAILURE_MAX_MS = 60 * 60_000;
const FAILURE_WINDOW_MS = 24 * 60 * 60_000;

export function failureDelayMs(failures: number): number {
  if (failures < FAILURE_THRESHOLD) return 0;
  return Math.min(FAILURE_MAX_MS, FAILURE_BASE_MS * 2 ** (failures - FAILURE_THRESHOLD));
}

export async function checkFailureBackoff(db: AppDatabase, rules: FailureRule[], now: Date = new Date()): Promise<RateLimitDecision> {
  for (const rule of rules) {
    const keyHash = rateLimitKeyHash(rule.bucket, rule.key);
    const failures = await db
      .select({ createdAt: rateLimitEvents.createdAt })
      .from(rateLimitEvents)
      .where(and(eq(rateLimitEvents.bucket, rule.bucket), eq(rateLimitEvents.keyHash, keyHash), gt(rateLimitEvents.createdAt, new Date(now.getTime() - FAILURE_WINDOW_MS))))
      .orderBy(desc(rateLimitEvents.createdAt));
    const delay = failureDelayMs(failures.length);
    if (delay === 0) continue;
    const until = failures[0]!.createdAt.getTime() + delay;
    if (now.getTime() < until) return { allowed: false, bucket: rule.bucket, retryAfterSeconds: Math.max(1, Math.ceil((until - now.getTime()) / 1000)) };
  }
  return { allowed: true };
}

export async function recordFailures(db: AppDatabase, rules: FailureRule[], now: Date = new Date()): Promise<void> {
  if (rules.length === 0) return;
  await db.insert(rateLimitEvents).values(rules.map((rule) => ({ bucket: rule.bucket, keyHash: rateLimitKeyHash(rule.bucket, rule.key), createdAt: now })));
}

export async function clearFailures(db: AppDatabase, rules: FailureRule[]): Promise<void> {
  for (const rule of rules) {
    await db.delete(rateLimitEvents).where(and(eq(rateLimitEvents.bucket, rule.bucket), eq(rateLimitEvents.keyHash, rateLimitKeyHash(rule.bucket, rule.key))));
  }
}
