import { describe, expect, it } from "vitest";
import { linkCookieOptions } from "./link-cookie";
import { secureCookies } from "./cookie-security";
import { sessionCookieOptions } from "./session-cookie";

describe("SEC-05, NFR-18 — un cookie part en « Secure » en production, sauf sur le banc d'essai http://localhost (lot 40c)", () => {
  it("en production derrière HTTPS : Secure", () => {
    expect(secureCookies("production", "https://app.symbola.fr")).toBe(true);
    expect(sessionCookieOptions("production", "https://app.symbola.fr").secure).toBe(true);
    expect(linkCookieOptions(3600, "production", "https://staging.symbola.fr").secure).toBe(true);
  });

  it("app compilée sur le banc d'essai local ou la CI (http://localhost, 127.0.0.1, [::1]) : sans Secure, que WebKit refuserait", () => {
    for (const url of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
      expect(secureCookies("production", url)).toBe(false);
    }
    expect(sessionCookieOptions("production", "http://localhost:3000").secure).toBe(false);
  });

  it("abus : une adresse en HTTP qui n'est pas locale, ou qui imite localhost, garde Secure", () => {
    for (const url of ["http://app.symbola.fr", "http://localhost.evil.fr", "http://localhost@evil.fr", "https://localhost:3000"]) {
      expect(secureCookies("production", url)).toBe(true);
    }
  });

  it("sans adresse publique (variable absente ou vide), ou avec une adresse illisible, en production : Secure", () => {
    expect(secureCookies("production", undefined)).toBe(true);
    expect(secureCookies("production", "")).toBe(true);
    expect(secureCookies("production", "pas une adresse")).toBe(true);
  });

  it("hors production (développement, tests) : sans Secure, comme avant", () => {
    expect(secureCookies("development", "https://app.symbola.fr")).toBe(false);
    expect(secureCookies("test", "http://localhost:3000")).toBe(false);
  });
});
