// Lot 11 (ADR 0031 § 7) — fond de carte posé par Julien dans MAP_TILES_DIR :
// un extrait PMTiles (france.pmtiles) et ses polices (fonts/<police>/<plage>.pbf).
// Chemins vérifiés : seuls ces fichiers peuvent être lus, jamais en dehors
// du dossier.
import { stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export const TILES_FILE = "france.pmtiles";
const FONT_PATH = /^fonts\/[A-Za-z0-9 _-]{1,80}\/\d{1,5}-\d{1,5}\.pbf$/;

export function mapTilesDir(): string | null {
  // Validée au démarrage par @symbola/env (chaîne, vide par défaut).
  const dir = (process.env.MAP_TILES_DIR ?? "").trim();
  return dir ? resolve(dir) : null;
}

// Fichier du fond de carte demandé, ou null s'il n'est pas permis.
export function resolveTileFile(segments: string[]): string | null {
  const dir = mapTilesDir();
  if (!dir) return null;
  const relative = segments.map((segment) => decodeURIComponent(segment)).join("/");
  if (relative !== TILES_FILE && !FONT_PATH.test(relative)) return null;
  const full = resolve(join(dir, relative));
  return full.startsWith(dir + sep) ? full : null;
}

export async function mapAssets(): Promise<{ tiles: boolean; glyphs: boolean }> {
  const dir = mapTilesDir();
  if (!dir) return { tiles: false, glyphs: false };
  const exists = async (path: string) => {
    try {
      return (await stat(path)).isFile() || (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  };
  return { tiles: await exists(join(dir, TILES_FILE)), glyphs: await exists(join(dir, "fonts")) };
}

// En-tête Range « bytes=début-fin » (une seule plage), borné à la taille.
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return "invalid";
  return { start, end };
}
