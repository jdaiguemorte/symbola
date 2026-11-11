// Lot 24b — SEC-22 (décision D5) : plafond d'e-mails par organisation et par
// heure, compté sur une fenêtre glissante. PostgreSQL réel, horloge simulée.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { consumeOrganizationMailQuota, mailHourlyCap, organizationMailQuotaStatus } from "./mail-quota";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const T0 = new Date("2027-04-10T10:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe("SEC-22 — Plafond d'envois par organisation et par heure", () => {
  it("le plafond par défaut vient des réglages de la plateforme : 100 e-mails par heure", async () => {
    expect(await mailHourlyCap(db)).toBe(100);
  });

  it("au-delà du plafond, l'envoi est refusé jusqu'à ce qu'une place se libère ; l'état le dit", async () => {
    const organizationId = randomUUID();
    for (let minute = 0; minute < 3; minute += 1) expect(await consumeOrganizationMailQuota(db, organizationId, { cap: 3, now: at(minute) })).toEqual({ allowed: true });
    expect(await consumeOrganizationMailQuota(db, organizationId, { cap: 3, now: at(10) })).toMatchObject({ allowed: false, retryAfterSeconds: 50 * 60 });
    expect(await organizationMailQuotaStatus(db, organizationId, { cap: 3, now: at(10) })).toEqual({ cap: 3, sent: 3, reached: true, resumesAt: at(60) });
    expect((await consumeOrganizationMailQuota(db, organizationId, { cap: 3, now: at(60) })).allowed).toBe(true);
  });

  it("le plafond d'une organisation ne compte pas les envois d'une autre", async () => {
    const full = randomUUID();
    for (let index = 0; index < 2; index += 1) await consumeOrganizationMailQuota(db, full, { cap: 2, now: at(index) });
    expect((await consumeOrganizationMailQuota(db, full, { cap: 2, now: at(5) })).allowed).toBe(false);
    expect((await consumeOrganizationMailQuota(db, randomUUID(), { cap: 2, now: at(5) })).allowed).toBe(true);
  });
});
