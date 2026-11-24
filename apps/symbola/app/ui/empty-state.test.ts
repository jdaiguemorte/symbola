// Lot 67c (UX-08 ; recette du 24/11/2026, R08) — le bouton principal d'un écran vide fait quelque
// chose. Un lien vers une ancre de la même page, quand la cible est déjà sous les yeux, ne fait rien
// (« Créer un modèle » qui pointait le bouton juste dessous). Une ancre n'est admise que si elle mène
// à un formulaire plus bas dans la page, et l'écran est alors nommé ici.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "..");
// Écran → pourquoi son ancre est une vraie action.
const ANCHORS_ALLOWED: Record<string, string> = {
  "events/[id]/documents-tab.tsx": "la zone de dépôt est plus bas dans l'onglet, sous la liste des dossiers",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sources(full);
    return /\.tsx$/.test(name) ? [full] : [];
  });
}

describe("UX-08 — Le bouton d'un écran vide fait quelque chose (lot 67c)", () => {
  it("aucun écran vide n'a pour action un lien vers une ancre de sa page, hors cas nommés", () => {
    const offenders = sources(APP)
      .filter((file) => /<EmptyState\b[^>]*actionHref="#/s.test(readFileSync(file, "utf-8")))
      .map((file) => path.relative(APP, file));
    expect(offenders.filter((file) => !(file in ANCHORS_ALLOWED))).toEqual([]);
    expect(Object.keys(ANCHORS_ALLOWED).filter((file) => !offenders.includes(file))).toEqual([]);
  });
});
