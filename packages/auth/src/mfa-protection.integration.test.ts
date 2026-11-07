// SEC-01 (lot 16, ADR 0037) — code de double authentification protégé, contre
// un vrai PostgreSQL : limite d'essais par compte, anti-rejeu, nouveau jeton de
// session à la validation, secret chiffré au repos. Horloge simulée par le
// paramètre `now` (veille et fin du verrouillage).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { resetUserMfa } from "./recovery";
import { isSealedTotpSecret } from "./secret-box";
import {
  confirmTotp,
  createOrganization,
  createUser,
  login,
  requireUser,
  resumeTotpSetup,
  sealLegacyTotpSecrets,
  setupTotp,
  unsealTotpSecrets,
} from "./service";

const { sql, db } = createAppConnection();
const PASSWORD = "mot-de-passe-de-la-planner";
const MINUTE = 60_000;

afterAll(async () => {
  await sql.end();
});

function codeAt(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp });
}

// Un code faux à coup sûr pour ce secret à cet instant (fenêtre de ±1 période).
function wrongCodeAt(secret: string, timestamp: number): string {
  const valid = new Set([-30_000, 0, 30_000].map((offset) => codeAt(secret, timestamp + offset)));
  for (let n = 0; ; n++) {
    const candidate = String(n).padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
}

async function newSession(email: string): Promise<string> {
  const result = await login(db, email, PASSWORD);
  if (result.outcome !== "success") throw new Error("connexion attendue");
  return result.sessionToken;
}

// Une planner dont la double authentification est configurée, et une session
// en attente du code.
async function plannerWithMfa(at: number) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const email = `sec01-${randomUUID()}@symbola.test`;
  const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
  const first = await newSession(email);
  const { secret } = await setupTotp(db, user.id);
  const confirmed = await confirmTotp(db, { sessionToken: first, token: codeAt(secret, at - 2 * MINUTE), now: new Date(at - 2 * MINUTE) });
  if (confirmed.outcome !== "confirmed") throw new Error("configuration attendue");
  return { user, email, secret, sessionToken: await newSession(email) };
}

async function stored(userId: string) {
  const [row] = await db
    .select({ totpSecret: users.totpSecret, mfaFailedAttempts: users.mfaFailedAttempts, mfaLockedUntil: users.mfaLockedUntil, totpLastUsedStep: users.totpLastUsedStep })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) throw new Error("compte introuvable");
  return row;
}

describe("SEC-01 — Code de double authentification protégé", () => {
  it("5 codes faux verrouillent la double authentification 15 minutes et préviennent le titulaire ; même un code juste est alors refusé", async () => {
    const t0 = Date.now();
    const { email, secret, sessionToken } = await plannerWithMfa(t0);

    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) })).toEqual({ outcome: "invalid" });
    }
    const fifth = await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) });
    expect(fifth).toEqual({ outcome: "locked", notify: { email, language: null } });

    // Le titulaire n'est prévenu qu'une fois ; le bon code ne passe plus.
    const later = t0 + MINUTE;
    expect(await confirmTotp(db, { sessionToken, token: codeAt(secret, later), now: new Date(later) })).toEqual({ outcome: "locked", notify: null });
    expect((await requireUser(db, sessionToken)).status).toBe("mfa_required");
  });

  it("le verrouillage dure 15 minutes : refusé la veille de sa fin, levé ensuite", async () => {
    const t0 = Date.now();
    const { secret, sessionToken } = await plannerWithMfa(t0);
    for (let attempt = 1; attempt <= 5; attempt++) await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) });

    const justBefore = t0 + 15 * MINUTE - 1_000;
    expect((await confirmTotp(db, { sessionToken, token: codeAt(secret, justBefore), now: new Date(justBefore) })).outcome).toBe("locked");
    const justAfter = t0 + 15 * MINUTE + 1_000;
    expect((await confirmTotp(db, { sessionToken, token: codeAt(secret, justAfter), now: new Date(justAfter) })).outcome).toBe("confirmed");
  });

  it("une nouvelle connexion par mot de passe ne remet pas le compteur à zéro", async () => {
    const t0 = Date.now();
    const { email, secret, sessionToken } = await plannerWithMfa(t0);
    for (let attempt = 1; attempt <= 4; attempt++) await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) });

    const fresh = await newSession(email);
    expect((await confirmTotp(db, { sessionToken: fresh, token: wrongCodeAt(secret, t0), now: new Date(t0) })).outcome).toBe("locked");
  });

  it("un code juste remet le compteur à zéro", async () => {
    const t0 = Date.now();
    const { user, email, secret, sessionToken } = await plannerWithMfa(t0);
    for (let attempt = 1; attempt <= 4; attempt++) await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) });
    expect((await confirmTotp(db, { sessionToken, token: codeAt(secret, t0), now: new Date(t0) })).outcome).toBe("confirmed");
    expect((await stored(user.id)).mfaFailedAttempts).toBe(0);

    const fresh = await newSession(email);
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect((await confirmTotp(db, { sessionToken: fresh, token: wrongCodeAt(secret, t0), now: new Date(t0) })).outcome).toBe("invalid");
    }
  });

  it("un code déjà accepté est refusé s'il est rejoué ; le code suivant passe", async () => {
    const t0 = Date.now();
    const { email, secret, sessionToken } = await plannerWithMfa(t0);
    const code = codeAt(secret, t0);
    expect((await confirmTotp(db, { sessionToken, token: code, now: new Date(t0) })).outcome).toBe("confirmed");

    const replay = await newSession(email);
    expect(await confirmTotp(db, { sessionToken: replay, token: code, now: new Date(t0 + 5_000) })).toEqual({ outcome: "invalid" });
    const next = t0 + 30_000;
    expect((await confirmTotp(db, { sessionToken: replay, token: codeAt(secret, next), now: new Date(next) })).outcome).toBe("confirmed");
  });

  it("la validation émet un nouveau jeton de session et révoque l'ancien", async () => {
    const t0 = Date.now();
    const { sessionToken, secret } = await plannerWithMfa(t0);
    const result = await confirmTotp(db, { sessionToken, token: codeAt(secret, t0), now: new Date(t0) });
    if (result.outcome !== "confirmed") throw new Error("validation attendue");

    expect(result.sessionToken).not.toBe(sessionToken);
    expect((await requireUser(db, sessionToken)).status).toBe("unauthenticated");
    expect((await requireUser(db, result.sessionToken)).status).toBe("authenticated");
  });

  it("le secret est enregistré chiffré, jamais en clair, et la configuration reprend avec la même clé", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email: `sec01-${randomUUID()}@symbola.test`, password: PASSWORD, role: "owner" });
    const { secret } = await resumeTotpSetup(db, user.id);

    const raw = (await stored(user.id)).totpSecret ?? "";
    expect(isSealedTotpSecret(raw)).toBe(true);
    expect(raw).not.toContain(secret);
    expect((await resumeTotpSetup(db, user.id)).secret).toBe(secret);
  });

  it("un secret enregistré en clair avant le lot 16 reste accepté, puis est chiffré", async () => {
    const t0 = Date.now();
    const { user, secret, sessionToken } = await plannerWithMfa(t0);
    await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));

    expect((await confirmTotp(db, { sessionToken, token: codeAt(secret, t0), now: new Date(t0) })).outcome).toBe("confirmed");
    expect(isSealedTotpSecret((await stored(user.id)).totpSecret ?? "")).toBe(true);
  });

  it("les secrets en clair se chiffrent en une fois, et se remettent en clair pour un retour arrière", async () => {
    const t0 = Date.now();
    const first = await plannerWithMfa(t0);
    const second = await plannerWithMfa(t0);
    for (const planner of [first, second]) await db.update(users).set({ totpSecret: planner.secret }).where(eq(users.id, planner.user.id));
    const userIds = [first.user.id, second.user.id];

    expect(await sealLegacyTotpSecrets(db, { userIds })).toBe(2);
    for (const planner of [first, second]) expect(isSealedTotpSecret((await stored(planner.user.id)).totpSecret ?? "")).toBe(true);
    expect(await sealLegacyTotpSecrets(db, { userIds })).toBe(0);

    expect(await unsealTotpSecrets(db, { userIds })).toBe(2);
    for (const planner of [first, second]) expect((await stored(planner.user.id)).totpSecret).toBe(planner.secret);
  });

  it("réinitialiser la double authentification (Admin) efface aussi le compteur, le verrouillage et le dernier code", async () => {
    const t0 = Date.now();
    const { user, secret, sessionToken } = await plannerWithMfa(t0);
    for (let attempt = 1; attempt <= 5; attempt++) await confirmTotp(db, { sessionToken, token: wrongCodeAt(secret, t0), now: new Date(t0) });
    expect((await stored(user.id)).mfaLockedUntil).not.toBeNull();

    await resetUserMfa(db, user.id);
    expect(await stored(user.id)).toEqual({ totpSecret: null, mfaFailedAttempts: 0, mfaLockedUntil: null, totpLastUsedStep: null });
  });
});
