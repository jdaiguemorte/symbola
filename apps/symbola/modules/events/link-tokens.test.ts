// Lot 26a (SEC-14, SEC-15, POR-10 ; ADR 0053) — règles pures des liens
// personnels, avec une horloge simulée : veille, jour même, lendemain à minuit
// à Paris, passages à l'heure d'été et d'hiver.
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  formatLinkToken,
  hashLinkSecret,
  isLinkExpired,
  linkExpiresOn,
  linkSessionExpiresAt,
  linkStatus,
  linkValidUntil,
  newLinkSecret,
  normalizeLinkRights,
  parisStartOfDay,
  parseLinkToken,
} from "./link-tokens";

describe("SEC-14 — Jeton de lien personnel", () => {
  it("un secret de 256 bits, différent à chaque fois, dont seul le haché SHA-256 est gardé", () => {
    const first = newLinkSecret();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(newLinkSecret()).not.toBe(first);
    expect(hashLinkSecret(first)).toBe(createHash("sha256").update(first).digest("hex"));
  });

  it("« <organisation>.<secret> » se relit ; tout autre format est refusé", () => {
    const organizationId = randomUUID();
    const secret = newLinkSecret();
    expect(parseLinkToken(formatLinkToken(organizationId, secret))).toEqual({ organizationId, secret });
    expect(parseLinkToken(`pas-un-uuid.${secret}`)).toBeNull();
    expect(parseLinkToken(`${organizationId}.court`)).toBeNull();
    expect(parseLinkToken(`${organizationId}.${secret}.de-trop`)).toBeNull();
    expect(parseLinkToken("")).toBeNull();
  });
});

describe("SEC-15 — Expiration des liens personnels", () => {
  const createdAt = new Date("2026-11-12T22:30:00Z");

  it("30 jours après l'événement pour un client, 7 pour un prestataire ; une date choisie l'emporte", () => {
    expect(linkExpiresOn({ audience: "client", customExpiresOn: null, eventDate: "2027-06-12", createdAt })).toBe("2027-07-12");
    expect(linkExpiresOn({ audience: "vendor", customExpiresOn: null, eventDate: "2027-06-12", createdAt })).toBe("2027-06-19");
    expect(linkExpiresOn({ audience: "client", customExpiresOn: "2027-06-30", eventDate: "2027-06-12", createdAt })).toBe("2027-06-30");
  });

  it("sans date d'événement : 180 jours après le jour de création à Paris", () => {
    // 22 h 30 UTC le 12/11 : 23 h 30 à Paris, toujours le 12/11.
    expect(linkExpiresOn({ audience: "client", customExpiresOn: null, eventDate: null, createdAt })).toBe("2027-05-11");
  });

  it("valable jusqu'à la fin de son dernier jour, à Paris : veille, jour même, lendemain", () => {
    expect(isLinkExpired("2027-07-12", new Date("2027-07-11T12:00:00Z"))).toBe(false);
    expect(isLinkExpired("2027-07-12", new Date("2027-07-12T21:59:59Z"))).toBe(false);
    expect(isLinkExpired("2027-07-12", new Date("2027-07-12T22:00:00Z"))).toBe(true);
    expect(linkValidUntil("2027-07-12")).toEqual(new Date("2027-07-12T22:00:00Z"));
  });

  it("minuit à Paris autour des changements d'heure (28 mars et 31 octobre 2027)", () => {
    expect(parisStartOfDay("2027-03-28")).toEqual(new Date("2027-03-27T23:00:00Z"));
    expect(parisStartOfDay("2027-03-29")).toEqual(new Date("2027-03-28T22:00:00Z"));
    expect(parisStartOfDay("2027-10-31")).toEqual(new Date("2027-10-30T22:00:00Z"));
    expect(parisStartOfDay("2027-11-01")).toEqual(new Date("2027-10-31T23:00:00Z"));
    expect(isLinkExpired("2027-10-31", new Date("2027-10-31T22:59:59Z"))).toBe(false);
    expect(isLinkExpired("2027-10-31", new Date("2027-10-31T23:00:00Z"))).toBe(true);
  });

  it("décision D7 : une session dure 30 jours sans visite, jamais au-delà du lien", () => {
    const now = new Date("2027-01-01T10:00:00Z");
    expect(linkSessionExpiresAt("2027-07-12", now)).toEqual(new Date("2027-01-31T10:00:00Z"));
    expect(linkSessionExpiresAt("2027-01-10", now)).toEqual(new Date("2027-01-10T23:00:00Z"));
  });

  it("un lien retiré l'est pour de bon ; sinon actif ou expiré selon le jour", () => {
    const now = new Date("2027-07-20T10:00:00Z");
    expect(linkStatus({ revokedAt: new Date(), expiresOn: "2027-12-31" }, now)).toBe("revoked");
    expect(linkStatus({ revokedAt: null, expiresOn: "2027-07-12" }, now)).toBe("expired");
    expect(linkStatus({ revokedAt: null, expiresOn: "2027-07-20" }, now)).toBe("active");
  });
});

describe("POR-10 — Rien n'est partagé par défaut", () => {
  it("seules les rubriques connues, dans l'ordre du portail ; des catégories seulement pour un budget limité", () => {
    const slot = randomUUID();
    expect(normalizeLinkRights({ rubrics: ["budget", "tasks", "tout" as never], budgetScope: "selected", sharedSlotIds: [slot, slot, "pas-un-uuid"] })).toEqual({
      rubrics: ["tasks", "budget"],
      budgetScope: "selected",
      sharedSlotIds: [slot],
    });
    expect(normalizeLinkRights({ rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [slot] })).toEqual({ rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] });
    expect(normalizeLinkRights({ rubrics: ["tasks"], budgetScope: "selected", sharedSlotIds: [slot] })).toEqual({ rubrics: ["tasks"], budgetScope: "selected", sharedSlotIds: [] });
    expect(normalizeLinkRights({ rubrics: [], budgetScope: "all", sharedSlotIds: [] }).rubrics).toEqual([]);
  });
});
