// Lot 11 (ADR 0031) : MapLibre 6 charge son « worker » depuis un fichier à
// part. Copié dans public/ avant dev et build, il est servi par l'app comme
// tout fichier statique (même origine, CSP worker-src 'self').
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre", "maplibre-gl-worker.js");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
