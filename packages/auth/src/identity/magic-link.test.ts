// Lot 33 (SEC-07) — lien magique scellé : rien de lisible dans l'adresse, et un lien altéré,
// d'une autre clé, non scellé ou échu ne s'ouvre pas.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAGIC_LINK_TTL_SECONDS } from "./management";
import { openMagicLink, sealMagicLink } from "./magic-link";

const key = randomBytes(32);
const payload = { email: "camille@example.test", token: "jeton-unique", expiresAt: 1_000_000 };

describe("SEC-07 — Lien magique scellé", () => {
  it("se rouvre à l'identique avant son échéance, sans rien de lisible dans le lien", () => {
    const link = sealMagicLink(payload, key);
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(link).not.toContain("camille");
    expect(Buffer.from(link, "base64url").toString("utf8")).not.toContain("camille");
    expect(openMagicLink(link, key, 999_999)).toEqual(payload);
  });

  it("ne s'ouvre plus à son échéance ni après", () => {
    const link = sealMagicLink(payload, key);
    expect(openMagicLink(link, key, 1_000_000)).toBeNull();
    expect(openMagicLink(link, key, 2_000_000)).toBeNull();
  });

  it("valable quinze minutes à l'horloge simulée : ouvert à 14 min 59 s, refusé à 15 min 01 s", () => {
    // 01 h 59 min 30 s à Paris, trente secondes avant le passage à l'heure d'été : l'échéance
    // se compte en millisecondes UTC, le changement d'heure n'y change rien.
    const sentAt = Date.UTC(2026, 2, 29, 0, 59, 30);
    const link = sealMagicLink({ ...payload, expiresAt: sentAt + MAGIC_LINK_TTL_SECONDS * 1000 }, key);
    expect(openMagicLink(link, key, sentAt + (14 * 60 + 59) * 1000)).not.toBeNull();
    expect(openMagicLink(link, key, sentAt + (15 * 60 + 1) * 1000)).toBeNull();
  });

  it("refuse un lien altéré, scellé avec une autre clé, non scellé ou illisible", () => {
    const link = sealMagicLink(payload, key);
    // Un caractère du milieu (octets chiffrés), pas le remplissage base64 de la fin, que le
    // décodage ignore sans toucher à l'étiquette d'authentification.
    const middle = Math.floor(link.length / 2);
    const tampered = `${link.slice(0, middle)}${link[middle] === "A" ? "B" : "A"}${link.slice(middle + 1)}`;
    expect(openMagicLink(tampered, key, 0)).toBeNull();
    expect(openMagicLink(link, randomBytes(32), 0)).toBeNull();
    expect(openMagicLink(Buffer.from(JSON.stringify(payload)).toString("base64url"), key, 0)).toBeNull();
    expect(openMagicLink("%%%", key, 0)).toBeNull();
  });
});
