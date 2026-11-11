// Lot 11 (ADR 0031 § 7) — fond de carte : chemins permis et plages lues.
import { afterEach, describe, expect, it } from "vitest";
import { parseRange, resolveTileFile } from "./tiles";

const previous = process.env.MAP_TILES_DIR;
afterEach(() => {
  process.env.MAP_TILES_DIR = previous;
});

describe("L11-PRE-04 — Fond de carte servi par l'app", () => {
  it("ne sert que le fichier PMTiles et les polices, jamais en dehors du dossier", () => {
    process.env.MAP_TILES_DIR = "/srv/carte";
    expect(resolveTileFile(["france.pmtiles"])).toBe("/srv/carte/france.pmtiles");
    expect(resolveTileFile(["fonts", "Noto Sans Regular", "0-255.pbf"])).toBe("/srv/carte/fonts/Noto Sans Regular/0-255.pbf");
    expect(resolveTileFile(["..", "etc", "passwd"])).toBeNull();
    expect(resolveTileFile(["fonts", "..%2F..%2Fetc", "0-255.pbf"])).toBeNull();
    expect(resolveTileFile(["autre.pmtiles"])).toBeNull();
    process.env.MAP_TILES_DIR = "";
    expect(resolveTileFile(["france.pmtiles"])).toBeNull();
  });

  it("lit une plage d'octets, en refuse une impossible", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=0-500", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=200-300", 100)).toBe("invalid");
    expect(parseRange("bytes=5-1", 100)).toBe("invalid");
    expect(parseRange("items=0-1", 100)).toBe("invalid");
  });
});
