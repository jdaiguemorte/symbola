// Lot 71a (HUB-14, BUD-01 ; spécification du lot 71, § 5.1) — rien n'est fondu : dans un même fichier,
// chaque ligne du fichier est une ligne du budget. Contre le budget existant, une ligne de même poste et
// de même détail reste celle que l'import met à jour (doublon à décider au paquet 71d). Règle pure.
import { describe, expect, it } from "vitest";
import { pickTargetLine } from "./import";

const line = (id: string, label: string, position: number) => ({ id, label, position });

describe("HUB-14 — Lignes de budget jamais fondues dans un même fichier (lot 71a)", () => {
  it("deux lignes du fichier au même poste et au même détail donnent deux lignes : la seconde ne réécrit pas la première", () => {
    const written = new Set<string>();
    const first = pickTargetLine([], "Vins", written);
    expect(first).toEqual({ line: null, position: 0 });
    // La première ligne du fichier a créé « l1 ».
    written.add("l1");
    expect(pickTargetLine([line("l1", "Vins", 0)], "Vins", written)).toEqual({ line: null, position: 1 });
  });

  it("trois lignes « Traiteur » de détails différents restent trois lignes", () => {
    const written = new Set<string>();
    const lines: ReturnType<typeof line>[] = [];
    for (const [index, label] of ["Vin d'honneur et dîner, 110 couverts", "Brunch du dimanche, 60 couverts", "Vins et champagne"].entries()) {
      const target = pickTargetLine(lines, label, written);
      expect(target.line).toBeNull();
      lines.push(line(`l${index}`, label, target.position));
      written.add(`l${index}`);
    }
    expect(lines.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it("une ligne déjà au budget (avant l'import), de même détail, reste celle que l'import met à jour ; sans détail, la première libre", () => {
    const existing = [line("a", "Location du domaine", 0), line("b", "Chambres des témoins", 1)];
    expect(pickTargetLine(existing, "chambres des témoins", new Set())).toEqual({ line: existing[1], position: 2 });
    expect(pickTargetLine(existing, null, new Set())).toEqual({ line: existing[0], position: 0 });
    expect(pickTargetLine(existing, null, new Set(["a"]))).toEqual({ line: existing[1], position: 0 });
    expect(pickTargetLine(existing, null, new Set(["a", "b"]))).toEqual({ line: null, position: 2 });
  });
});
