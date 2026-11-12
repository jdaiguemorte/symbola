// Lot 29a (ARC-09, JRJ-02 ; ADR 0064, décision D4) — échéance de la copie du jour J, avec
// une horloge simulée, et accord des noms avec le service worker.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DAY_CACHE,
  DAY_COPY_SUFFIX,
  DAY_STATIC_CACHE,
  OFFLINE_PAGE_PATH,
  assetsInUse,
  copiesToPurge,
  dayCopyExpiresAt,
  isDayCopyExpired,
  parisMidnight,
  parseDayCopy,
  staticAssetsIn,
  type DayCopy,
} from "./day-copy";

const EVENT = "7ec37e00-0000-4000-8000-000000000001";
const USER = "7ec37e00-0000-4000-8000-0000000000aa";
const OTHER_USER = "7ec37e00-0000-4000-8000-0000000000bb";

function copy(overrides: Partial<DayCopy> = {}): DayCopy {
  return {
    version: 1,
    eventId: EVENT,
    userId: USER,
    title: "Léa & Hugo",
    eventDate: "2026-06-20",
    expiresAt: dayCopyExpiresAt("2026-06-20").toISOString(),
    syncedAt: "2026-06-19T16:42:00.000Z",
    pages: [`/jour-j/${EVENT}`],
    documents: [`/jour-j/${EVENT}/programme`],
    assets: ["/_next/static/chunks/main.js"],
    ...overrides,
  };
}

describe("ARC-09 — La copie du jour J s'efface le lendemain de l'évènement à minuit (D4)", () => {
  it("minuit à Paris, en heure d'été comme en heure d'hiver", () => {
    expect(parisMidnight("2026-06-22").toISOString()).toBe("2026-06-21T22:00:00.000Z");
    expect(parisMidnight("2026-12-12").toISOString()).toBe("2026-12-11T23:00:00.000Z");
  });

  it("jours du changement d'heure : minuit reste avant le changement", () => {
    // Passage à l'heure d'été le 29 mars 2026, à l'heure d'hiver le 25 octobre 2026.
    expect(parisMidnight("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(parisMidnight("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("la veille, le jour même et le lendemain : la copie est lisible ; le surlendemain, elle est périmée", () => {
    const expiresAt = dayCopyExpiresAt("2026-06-20");
    expect(expiresAt.toISOString()).toBe("2026-06-21T22:00:00.000Z");
    expect(isDayCopyExpired(expiresAt, new Date("2026-06-19T20:00:00+02:00"))).toBe(false);
    expect(isDayCopyExpired(expiresAt, new Date("2026-06-20T16:40:00+02:00"))).toBe(false);
    expect(isDayCopyExpired(expiresAt, new Date("2026-06-21T23:59:59+02:00"))).toBe(false);
    expect(isDayCopyExpired(expiresAt, new Date("2026-06-22T00:00:00+02:00"))).toBe(true);
  });

  it("évènement la veille du passage à l'heure d'hiver : l'échéance tombe à minuit, heure d'hiver", () => {
    const expiresAt = dayCopyExpiresAt("2026-10-24");
    expect(expiresAt.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(isDayCopyExpired(expiresAt, new Date("2026-10-25T23:59:00+01:00"))).toBe(false);
    expect(isDayCopyExpired(expiresAt, new Date("2026-10-26T00:00:00+01:00"))).toBe(true);
  });

  it("une date invalide est refusée", () => {
    expect(() => parisMidnight("2026-02-30")).toThrow(RangeError);
  });
});

describe("ARC-09 — Copies effacées à l'ouverture d'un écran (D4)", () => {
  const now = new Date("2026-06-20T10:00:00+02:00");

  it("la copie d'un autre compte s'efface ; la sienne reste", () => {
    const mine = copy();
    const theirs = copy({ eventId: "7ec37e00-0000-4000-8000-000000000002", userId: OTHER_USER });
    expect(copiesToPurge([mine, theirs], { userId: USER, now })).toEqual([theirs]);
  });

  it("une copie périmée s'efface, même sans compte connu (page « Hors ligne »)", () => {
    const old = copy({ eventDate: "2026-06-01", expiresAt: dayCopyExpiresAt("2026-06-01").toISOString() });
    const theirs = copy({ userId: OTHER_USER });
    expect(copiesToPurge([old, theirs], { userId: null, now })).toEqual([old]);
  });

  it("les fichiers de l'application gardés sont ceux des copies restantes", () => {
    const first = copy({ assets: ["/_next/static/a.js", "/_next/static/b.css"] });
    const second = copy({ assets: ["/_next/static/b.css", "/_next/static/c.js"] });
    expect([...assetsInUse([first, second])].sort()).toEqual(["/_next/static/a.js", "/_next/static/b.css", "/_next/static/c.js"]);
  });
});

describe("ARC-09 — Fichiers de l'application copiés avec une page", () => {
  it("scripts, feuilles de style, polices et morceaux cités dans les données de rendu, sans doublon", () => {
    const html = [
      '<link rel="stylesheet" href="/_next/static/css/a1b2.css" data-precedence="next"/>',
      '<link rel="preload" href="/_next/static/media/inter.p.woff2" as="font"/>',
      '<script src="/_next/static/chunks/webpack-1.js" async=""></script>',
      '<script src="/_next/static/chunks/webpack-1.js" async=""></script>',
      '<script>self.__next_f.push([1,"I[\\"/_next/static/chunks/app/hors-ligne/page-9f.js\\"]"])</script>',
      '<a href="/events">ailleurs</a>',
    ].join("");
    expect(staticAssetsIn(html)).toEqual([
      "/_next/static/css/a1b2.css",
      "/_next/static/media/inter.p.woff2",
      "/_next/static/chunks/webpack-1.js",
      "/_next/static/chunks/app/hors-ligne/page-9f.js",
    ]);
  });
});

describe("ARC-09 — Fiche de la copie", () => {
  it("une fiche bien formée se relit ; une fiche abîmée compte comme absente", () => {
    expect(parseDayCopy(copy())).toEqual(copy());
    expect(parseDayCopy({ ...copy(), version: 2 })).toBeNull();
    expect(parseDayCopy({ ...copy(), pages: ["https://ailleurs.example/x"] })).toBeNull();
    expect(parseDayCopy(null)).toBeNull();
  });
});

describe("ARC-09 — Le service worker emploie les mêmes noms", () => {
  const worker = readFileSync(resolve(import.meta.dirname, "..", "..", "public", "sw.js"), "utf8");

  it.each([
    ["DAY_CACHE", DAY_CACHE],
    ["DAY_STATIC_CACHE", DAY_STATIC_CACHE],
    ["OFFLINE_PAGE_PATH", OFFLINE_PAGE_PATH],
    ["DAY_COPY_SUFFIX", DAY_COPY_SUFFIX],
  ])("%s", (name, value) => {
    expect(worker).toContain(`const ${name} = "${value}";`);
  });
});
