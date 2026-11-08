// SEC-03 (lot 16, ADR 0038) — appareil de confiance, contre un vrai PostgreSQL :
// après un code validé avec « se souvenir de cet appareil », ce navigateur est
// dispensé du code pendant 90 jours (décision de Julien du 08/11/2026). Horloge
// simulée par le paramètre `now` (veille et lendemain de l'échéance).
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { requestPasswordReset, resetPassword, resetUserMfa } from "./recovery";
import {
  confirmTotp,
  countTrustedDevices,
  createOrganization,
  createUser,
  forgetTrustedDevices,
  login,
  requireUser,
  setupTotp,
  type LoginOptions,
} from "./service";

const { sql, db } = createAppConnection();
const PASSWORD = "mot-de-passe-de-la-planner";
const DAY = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await sql.end();
});

function codeAt(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp });
}

async function account(role: "owner" | "admin" = "owner") {
  const organization = role === "admin" ? null : await createOrganization(db, `Org ${randomUUID()}`);
  const email = `sec03-${randomUUID()}@symbola.test`;
  const user = await createUser(db, { organizationId: organization?.id ?? null, email, password: PASSWORD, role });
  return { user, email };
}

async function passwordStep(email: string, options: LoginOptions = {}) {
  const result = await login(db, email, PASSWORD, options);
  if (result.outcome !== "success") throw new Error("connexion attendue");
  return result;
}

// Configure la double authentification et la valide, en retenant ou non l'appareil.
async function withMfa(rememberDevice: boolean, role: "owner" | "admin" = "owner", at = Date.now()) {
  const { user, email } = await account(role);
  const first = await passwordStep(email);
  const { secret } = await setupTotp(db, user.id);
  const confirmed = await confirmTotp(db, { sessionToken: first.sessionToken, token: codeAt(secret, at), now: new Date(at), rememberDevice });
  if (confirmed.outcome !== "confirmed") throw new Error("validation attendue");
  return { user, email, secret, deviceToken: confirmed.deviceToken };
}

describe("SEC-03 — Appareil de confiance (90 jours)", () => {
  it("une validation avec « se souvenir de cet appareil » dispense du code aux connexions suivantes sur cet appareil", async () => {
    const { email, deviceToken } = await withMfa(true);
    expect(deviceToken).toEqual(expect.any(String));

    const next = await passwordStep(email, { trustedDeviceToken: deviceToken });
    expect(next.requiresMfa).toBe(false);
    expect((await requireUser(db, next.sessionToken)).status).toBe("authenticated");
  });

  it("sans la case cochée, aucun appareil n'est retenu et le code est redemandé", async () => {
    const { email, deviceToken } = await withMfa(false);
    expect(deviceToken).toBeUndefined();
    const next = await passwordStep(email);
    expect(next.requiresMfa).toBe(true);
    expect((await requireUser(db, next.sessionToken)).status).toBe("mfa_required");
  });

  it("le code est redemandé au bout de 90 jours : dispensé la veille de l'échéance, redemandé le lendemain", async () => {
    const t0 = Date.now();
    const { email, deviceToken } = await withMfa(true, "owner", t0);

    expect((await passwordStep(email, { trustedDeviceToken: deviceToken, now: new Date(t0 + 89 * DAY) })).requiresMfa).toBe(false);
    expect((await passwordStep(email, { trustedDeviceToken: deviceToken, now: new Date(t0 + 91 * DAY) })).requiresMfa).toBe(true);
  });

  it("l'appareil retenu par un compte ne dispense pas un autre compte (isolation)", async () => {
    const first = await withMfa(true);
    const other = await withMfa(false);
    expect((await passwordStep(other.email, { trustedDeviceToken: first.deviceToken })).requiresMfa).toBe(true);
    expect((await passwordStep(first.email, { trustedDeviceToken: "jeton-inconnu" })).requiresMfa).toBe(true);
  });

  it("jamais pour l'Admin : son code est demandé à chaque connexion", async () => {
    const { email, deviceToken } = await withMfa(true, "admin");
    expect(deviceToken).toBeUndefined();
    expect((await passwordStep(email)).requiresMfa).toBe(true);
  });

  it("« oublier mes appareils » les révoque tous, et le compte voit combien il en a", async () => {
    const { user, email, deviceToken } = await withMfa(true);
    expect(await countTrustedDevices(db, user.id)).toBe(1);

    expect(await forgetTrustedDevices(db, user.id)).toBe(1);
    expect(await countTrustedDevices(db, user.id)).toBe(0);
    expect((await passwordStep(email, { trustedDeviceToken: deviceToken })).requiresMfa).toBe(true);
  });

  it("une réinitialisation du mot de passe révoque les appareils de confiance", async () => {
    const { email, deviceToken } = await withMfa(true);
    const request = await requestPasswordReset(db, email);
    if (!request) throw new Error("lien attendu");
    expect(await resetPassword(db, { token: request.token, password: PASSWORD })).toBe("success");
    expect((await passwordStep(email, { trustedDeviceToken: deviceToken })).requiresMfa).toBe(true);
  });

  it("une réinitialisation de la double authentification par l'Admin révoque les appareils de confiance", async () => {
    const { user, deviceToken, email } = await withMfa(true);
    await resetUserMfa(db, user.id);
    expect(await countTrustedDevices(db, user.id)).toBe(0);
    expect((await passwordStep(email, { trustedDeviceToken: deviceToken })).requiresMfa).toBe(true);
  });
});
