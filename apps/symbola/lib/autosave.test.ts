// Lot 39b (UX-09 ; D8 ; ADR 0074) — fusion d'un enregistrement automatique avec ce qu'une autre
// personne a enregistré entre-temps : jamais d'écrasement silencieux.
import { describe, expect, it } from "vitest";
import { mergeEdits, parseBaseline, sameValues } from "./autosave";

const FIELDS = ["style", "notes", "guestsEstimated"] as const;

describe("UX-09 — Conflit d'édition signalé, jamais écrasé en silence", () => {
  it("un champ que je n'ai pas touché prend la valeur enregistrée entre-temps ; le mien garde ma valeur", () => {
    const baseline = { style: "Bohème", notes: "", guestsEstimated: "80" };
    const mine = { style: "Bohème chic", notes: "", guestsEstimated: "80" };
    const stored = { style: "Bohème", notes: "Prévoir un plan B", guestsEstimated: "90" };
    expect(mergeEdits(FIELDS, baseline, mine, stored)).toEqual({ merged: { style: "Bohème chic", notes: "Prévoir un plan B", guestsEstimated: "90" }, conflicts: [] });
  });

  it("un champ changé des deux côtés, différemment, est un conflit", () => {
    const baseline = { style: "Bohème", notes: "", guestsEstimated: "80" };
    const mine = { style: "Champêtre", notes: "", guestsEstimated: "80" };
    const stored = { style: "Industriel", notes: "", guestsEstimated: "80" };
    expect(mergeEdits(FIELDS, baseline, mine, stored).conflicts).toEqual(["style"]);
  });

  it("la même valeur des deux côtés n'est pas un conflit", () => {
    const baseline = { style: "Bohème", notes: "", guestsEstimated: "80" };
    const both = { style: "Champêtre", notes: "", guestsEstimated: "80" };
    expect(mergeEdits(FIELDS, baseline, both, both)).toEqual({ merged: both, conflicts: [] });
  });

  it("les valeurs de départ venues de l'écran ne gardent que les champs de la fiche, en texte", () => {
    expect(parseBaseline(JSON.stringify({ style: "Bohème", notes: 3, intrus: "x" }), FIELDS)).toEqual({ style: "Bohème", notes: "", guestsEstimated: "" });
    expect(parseBaseline("pas du json", FIELDS)).toBeNull();
    expect(parseBaseline(JSON.stringify(["style"]), FIELDS)).toBeNull();
    expect(sameValues(FIELDS, { style: "a" }, { style: "a", notes: "" })).toBe(true);
  });
});
