// Lot 71d (HUB-14, UX-07 ; spécification du lot 71, § 5.4, critères 2 et 4 ; maquette 08, P-16) — l'étape
// « Doublons » d'un budget : les choix qui restent, nommés dans l'ordre de l'écran, chacun avec son lien ;
// « Continuer » répond toujours et mène au premier. Aucun choix n'est fait à la place de la planner.
import { describe, expect, it } from "vitest";
import { doublonsContinueHref, pendingDoublonsChoices, type DoublonsChoicesInput } from "./doublons-rules";

const input: DoublonsChoicesInput = {
  splitRows: [
    { rowIndex: 7, fileSlot: "Photo et vidéo", decided: false },
    { rowIndex: 8, fileSlot: "Photo et vidéo", decided: false },
  ],
  unusedSlots: [
    { slotId: "s-tenues", label: "Tenues", decision: null },
    { slotId: "s-deco", label: "Décoration", decision: "keep" },
  ],
  vendors: [
    { name: "Domaine de la Roche Fictive", decision: "found" },
    { name: "Élodie Beauté", decision: "proposed" },
  ],
};

describe("HUB-14 — « Doublons » : les choix qui restent (lot 71d)", () => {
  it("critère 4 : les choix restants sont nommés dans l'ordre de l'écran (poste réparti, poste sans ligne, doublon possible)", () => {
    expect(pendingDoublonsChoices(input).map((choice) => [choice.kind, choice.label])).toEqual([
      ["split", "Photo et vidéo"],
      ["slot", "Tenues"],
      ["vendor", "Élodie Beauté"],
    ]);
  });

  it("critère 4 : « Continuer » mène au premier choix restant, par son lien", () => {
    const choices = pendingDoublonsChoices(input);
    expect(choices.map((choice) => choice.anchor)).toEqual(["poste-7", "poste-vide-s-tenues", "prestataire-1"]);
    expect(doublonsContinueHref("/import/i-1/rapprochements", choices)).toBe("/import/i-1/rapprochements?reste=1#poste-7");
  });

  it("critère 2 : un poste de départ sans ligne attend « garder » ou « retirer » ; décidé, il ne reste plus", () => {
    const decided = { ...input, unusedSlots: input.unusedSlots.map((slot) => ({ ...slot, decision: "remove" as const })) };
    expect(pendingDoublonsChoices(decided).some((choice) => choice.kind === "slot")).toBe(false);
  });

  it("un poste réparti dont une ligne est décidée et l'autre non reste un choix ; tout décidé, « Continuer » passe", () => {
    const partly = { ...input, splitRows: [{ ...input.splitRows[0]!, decided: true }, input.splitRows[1]!] };
    expect(pendingDoublonsChoices(partly)[0]).toMatchObject({ kind: "split", anchor: "poste-7" });
    const done: DoublonsChoicesInput = { splitRows: [], unusedSlots: [], vendors: [{ name: "Élodie Beauté", decision: "same" }] };
    expect(pendingDoublonsChoices(done)).toEqual([]);
    expect(doublonsContinueHref("/import/i-1/rapprochements", [])).toBeNull();
  });
});
