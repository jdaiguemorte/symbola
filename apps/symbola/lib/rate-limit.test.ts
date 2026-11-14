// Lot 16 (L16-SEC-02, ADR 0044) — règles de limitation de débit et adresse du
// client.
import { describe, expect, it } from "vitest";
import { clientIpFrom, RATE_LIMITS, rateLimitRules } from "./rate-limit";

describe("L16-SEC-02 — Limitation de débit : règles et adresse du client", () => {
  it("l'adresse du client est la dernière de X-Forwarded-For, celle qu'a vue le proxy", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // Une adresse inventée par le client, devant, ne compte pas.
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " 2001:db8::1 " }))).toBe("2001:db8::1");
  });

  it("sans proxy devant l'app, pas d'adresse : seule la limite par compte s'applique", () => {
    expect(clientIpFrom(new Headers())).toBeNull();
    // Next.js pose l'adresse de la connexion quand l'en-tête manque : une adresse de bouclage.
    for (const loopback of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) expect(clientIpFrom(new Headers({ "x-forwarded-for": loopback }))).toBeNull();
    expect(rateLimitRules("login", { ip: null, account: "planner@symbola.test" })).toEqual([
      { bucket: "login.account", key: "planner@symbola.test", ...RATE_LIMITS.login.account },
    ]);
  });

  it("chaque tentative compte pour l'adresse et pour le compte ; l'e-mail est compté sans casse ni espaces", () => {
    expect(rateLimitRules("login", { ip: "203.0.113.7", account: "  Planner@Symbola.TEST " })).toEqual([
      { bucket: "login.ip", key: "203.0.113.7", ...RATE_LIMITS.login.ip },
      { bucket: "login.account", key: "planner@symbola.test", ...RATE_LIMITS.login.account },
    ]);
  });

  it("demande de lien de connexion, recherche, envoi de fichier et liens personnels ont chacun leurs limites", () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(["linkCode", "linkOpen", "linkRenewal", "login", "search", "upload"]);
    for (const { ip, account } of Object.values(RATE_LIMITS)) {
      expect(account.limit).toBeLessThanOrEqual(ip.limit);
      expect(ip.windowMs).toBeGreaterThan(0);
    }
  });
});
