// SEC-14 (socle des lots 46 et 49) — le jeton des liens personnels vit dans
// packages/auth ; le module events le réexporte à l'identique.
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatLinkToken, hashLinkSecret, newLinkSecret, parseLinkToken } from "./link-token";

describe("SEC-14 — Jeton de lien personnel commun aux modules", () => {
  it("un secret de 256 bits, différent à chaque fois, dont seul le haché SHA-256 est gardé", () => {
    const first = newLinkSecret();
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(newLinkSecret()).not.toBe(first);
    expect(hashLinkSecret(first)).toBe(createHash("sha256").update(first).digest("hex"));
  });

  it("« <organisation>.<secret> » se relit ; tout autre format est refusé", () => {
    const organizationId = randomUUID();
    const secret = newLinkSecret();
    expect(parseLinkToken(` ${formatLinkToken(organizationId, secret)} `)).toEqual({ organizationId, secret });
    expect(parseLinkToken(`pas-un-uuid.${secret}`)).toBeNull();
    expect(parseLinkToken(`${organizationId}.court`)).toBeNull();
    expect(parseLinkToken(`${organizationId}.${secret}.de-trop`)).toBeNull();
  });
});
