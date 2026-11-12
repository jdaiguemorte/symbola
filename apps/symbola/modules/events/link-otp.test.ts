// Lot 26b (POR-01 ; ADR 0053, décision D6) — règles pures du code à usage
// unique : six chiffres, haché par lien, dix minutes, cinq essais (horloge simulée).
import { describe, expect, it } from "vitest";
import {
  hashLinkCode,
  isLinkCodeUsable,
  LINK_CODE_MAX_ATTEMPTS,
  LINK_CODE_TTL_MS,
  linkCodeExpiresAt,
  maskEmail,
  newLinkCode,
  normalizeLinkCode,
  sameLinkCodeHash,
} from "./link-otp";

const LINK_A = "7ec37e00-0000-4000-8000-00000000000a";
const LINK_B = "7ec37e00-0000-4000-8000-00000000000b";

describe("POR-01, lot 26b — Code à usage unique à l'ouverture", () => {
  it("un code a six chiffres, zéros de tête compris, tiré au hasard", () => {
    const codes = new Set(Array.from({ length: 200 }, () => newLinkCode()));
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(190);
  });

  it("seul le haché est gardé ; le même code n'a pas le même haché sur deux liens", () => {
    const hash = hashLinkCode(LINK_A, "042317");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("042317");
    expect(hashLinkCode(LINK_B, "042317")).not.toBe(hash);
    expect(sameLinkCodeHash(hash, hashLinkCode(LINK_A, "042317"))).toBe(true);
    expect(sameLinkCodeHash(hash, hashLinkCode(LINK_A, "042318"))).toBe(false);
    expect(sameLinkCodeHash(hash, "")).toBe(false);
  });

  it("la saisie tolère espaces et tirets, refuse le reste", () => {
    expect(normalizeLinkCode(" 042 317 ")).toBe("042317");
    expect(normalizeLinkCode("042-317")).toBe("042317");
    expect(normalizeLinkCode("42317")).toBeNull();
    expect(normalizeLinkCode("04231a")).toBeNull();
    expect(normalizeLinkCode("0423170")).toBeNull();
  });

  it("valable dix minutes : juste avant l'échéance oui, à l'échéance non (horloge simulée)", () => {
    const sentAt = new Date("2027-03-28T00:55:00Z"); // nuit du passage à l'heure d'été
    const expiresAt = linkCodeExpiresAt(sentAt);
    expect(expiresAt.getTime() - sentAt.getTime()).toBe(LINK_CODE_TTL_MS);
    expect(isLinkCodeUsable({ consumedAt: null, expiresAt, attempts: 0 }, new Date(expiresAt.getTime() - 1))).toBe(true);
    expect(isLinkCodeUsable({ consumedAt: null, expiresAt, attempts: 0 }, expiresAt)).toBe(false);
  });

  it("cinq essais au plus, un seul usage", () => {
    const expiresAt = new Date("2027-06-12T10:10:00Z");
    const now = new Date("2027-06-12T10:01:00Z");
    expect(LINK_CODE_MAX_ATTEMPTS).toBe(5);
    expect(isLinkCodeUsable({ consumedAt: null, expiresAt, attempts: 4 }, now)).toBe(true);
    expect(isLinkCodeUsable({ consumedAt: null, expiresAt, attempts: 5 }, now)).toBe(false);
    expect(isLinkCodeUsable({ consumedAt: now, expiresAt, attempts: 1 }, now)).toBe(false);
  });

  it("l'adresse où part le code est montrée masquée", () => {
    expect(maskEmail("karim@traiteur.example")).toBe("k•••@traiteur.example");
    expect(maskEmail("sans-arobase")).toBe("•••");
  });
});
