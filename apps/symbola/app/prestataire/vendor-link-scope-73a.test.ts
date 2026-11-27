// Lot 73a (SEC-14 à SEC-17, POR-10 ; spécification du lot 73, § 4.5 et § 5.1, abus) — l'espace d'un
// prestataire par son lien ne lit rien de ce que ce paquet ajoute pour la planner : ni le carnet et l'état
// résumé de ses pièces, ni les compteurs, ni les mariages où il est retenu, ni l'ajout à un mariage ou son
// annulation, ni la relance notée. Il garde ses pièces demandées (règle actuelle du lot 47). Contrôle sur
// les sources de app/prestataire/, sans base.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname);
const FORBIDDEN = [
  "findVendors",
  "summarizeVendorDocuments",
  "documentState",
  "countWorkedWithByVendor",
  "listUpcomingRetainedEventsByVendor",
  "addVendorToEventSlot",
  "addVendorsToEvent",
  "undoVendorAddition",
  "listEventsForVendorAddition",
  "undoVendorReminder",
  "requestUsualVendorDocuments",
  "setVendorDocumentKindUsage",
  "listLastVendorReminders",
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("SEC-14 — Le lien d'un prestataire ne lit rien du carnet de la planner (lot 73a)", () => {
  it("aucun fichier de l'espace du prestataire n'appelle les fonctions du lot 73a", () => {
    const files = sources(ROOT);
    expect(files.length).toBeGreaterThan(5);
    const found = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return FORBIDDEN.filter((name) => new RegExp(`\\b${name}\\b`).test(text)).map((name) => `${file.slice(ROOT.length + 1)} : ${name}`);
    });
    expect(found).toEqual([]);
  });

  it("ses pièces demandées restent la seule chose qu'il lit de ses pièces", () => {
    const text = sources(ROOT).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(text).toMatch(/\blistRequestedVendorDocuments\b/);
    expect(text).not.toMatch(/\blistVendorDocuments\b/);
  });
});
