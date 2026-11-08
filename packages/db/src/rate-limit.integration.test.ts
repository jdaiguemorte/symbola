// Lot 16 (SEC-02, ADR 0044) — limitation de débit à fenêtre glissante, contre
// un vrai PostgreSQL, rôle applicatif, horloge simulée.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { consumeRateLimits, purgeRateLimitEvents, rateLimitKeyHash, type RateLimitRule } from "./rate-limit";
import { rateLimitEvents } from "./schema/core";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const MINUTE = 60_000;
const T0 = new Date("2026-11-08T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

function rule(overrides: Partial<RateLimitRule> = {}): RateLimitRule {
  return { bucket: `test.${randomUUID()}`, key: "203.0.113.7", limit: 3, windowMs: 15 * MINUTE, ...overrides };
}

describe("SEC-02 — Limitation de débit à fenêtre glissante (PostgreSQL réel)", () => {
  it("accepte jusqu'à la limite, puis refuse en annonçant le délai d'attente", async () => {
    const r = rule();
    for (let i = 0; i < 3; i += 1) expect(await consumeRateLimits(db, [r], at(i * MINUTE))).toEqual({ allowed: true });
    // La première tentative (à T0) sort de la fenêtre à T0 + 15 min.
    expect(await consumeRateLimits(db, [r], at(5 * MINUTE))).toEqual({ allowed: false, bucket: r.bucket, retryAfterSeconds: 10 * 60 });
  });

  it("la fenêtre glisse : une place se libère dès que la plus ancienne tentative en sort, la veille comprise", async () => {
    const r = rule();
    for (let i = 0; i < 3; i += 1) await consumeRateLimits(db, [r], at(i * MINUTE));
    expect((await consumeRateLimits(db, [r], at(15 * MINUTE - 1))).allowed).toBe(false);
    expect((await consumeRateLimits(db, [r], at(15 * MINUTE))).allowed).toBe(true);
    // La place suivante se libère à T0 + 16 min (deuxième tentative).
    expect(await consumeRateLimits(db, [r], at(15 * MINUTE + 1000))).toMatchObject({ allowed: false, retryAfterSeconds: 59 });
  });

  it("une tentative refusée n'est pas comptée : attendre le délai annoncé suffit", async () => {
    const r = rule({ limit: 1 });
    await consumeRateLimits(db, [r], at(0));
    for (let i = 1; i <= 5; i += 1) expect((await consumeRateLimits(db, [r], at(i * MINUTE))).allowed).toBe(false);
    expect((await consumeRateLimits(db, [r], at(15 * MINUTE))).allowed).toBe(true);
  });

  it("chaque clé et chaque usage ont leur compte", async () => {
    const r = rule({ limit: 1 });
    await consumeRateLimits(db, [r], at(0));
    expect((await consumeRateLimits(db, [{ ...r, key: "198.51.100.9" }], at(0))).allowed).toBe(true);
    expect((await consumeRateLimits(db, [{ ...r, bucket: `${r.bucket}.autre` }], at(0))).allowed).toBe(true);
    expect((await consumeRateLimits(db, [r], at(0))).allowed).toBe(false);
  });

  it("une tentative soumise à deux règles (adresse et compte) n'est comptée nulle part si l'une la refuse", async () => {
    const ip = rule({ limit: 5 });
    const account = rule({ limit: 1, key: `planner-${randomUUID()}@symbola.test` });
    await consumeRateLimits(db, [account], at(0));
    expect(await consumeRateLimits(db, [ip, account], at(MINUTE))).toMatchObject({ allowed: false, bucket: account.bucket });
    const ipRows = await db.select().from(rateLimitEvents).where(eq(rateLimitEvents.keyHash, rateLimitKeyHash(ip.bucket, ip.key)));
    expect(ipRows).toHaveLength(0);
  });

  it("la clé n'est jamais gardée en clair", async () => {
    const r = rule({ key: `planner-${randomUUID()}@symbola.test` });
    await consumeRateLimits(db, [r], at(0));
    const rows = await db.select().from(rateLimitEvents).where(eq(rateLimitEvents.bucket, r.bucket));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(r.key);
  });

  it("des tentatives simultanées ne dépassent pas la limite", async () => {
    const r = rule({ limit: 5 });
    const decisions = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimits(db, [r], at(0))));
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5);
  });

  it("la purge oublie les tentatives anciennes", async () => {
    const r = rule({ limit: 10 });
    await consumeRateLimits(db, [r], new Date("2020-01-01T00:00:00Z"));
    await consumeRateLimits(db, [r], new Date("2020-01-03T00:00:00Z"));
    expect(await purgeRateLimitEvents(db, new Date("2020-01-02T00:00:00Z"))).toBeGreaterThanOrEqual(1);
    const rows = await db.select().from(rateLimitEvents).where(eq(rateLimitEvents.bucket, r.bucket));
    expect(rows.map((row) => row.createdAt.toISOString())).toEqual(["2020-01-03T00:00:00.000Z"]);
  });
});
