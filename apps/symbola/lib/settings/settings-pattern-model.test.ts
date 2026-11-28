import { describe, expect, it } from "vitest";
import { SAVED_VISIBLE_MS, changedFieldNames, leaveDecision, leavesScreen, saveBarState, savedTimeLabel } from "./settings-pattern-model";

const LABELS = { city: "Ville", contactPhone: "Téléphone", address: "Adresse" };

describe("UX-09 — Patron d'un écran de réglage : la barre d'enregistrement d'un formulaire lié (lot 74h, D7, G8)", () => {
  it("nomme les champs modifiés, dans l'ordre de la fiche, sans compter les champs cachés ni les espaces", () => {
    const baseline = { city: "Annecy", contactPhone: "06 00 00 00 01", address: "12 rue des Lilas", version: "1" };
    const current = { city: "Annecy-le-Vieux", contactPhone: "06 00 00 00 02", address: " 12 rue des Lilas ", version: "2" };
    expect(changedFieldNames(baseline, current, LABELS)).toEqual(["city", "contactPhone"]);
    const state = saveBarState({ changed: ["city", "contactPhone"], fieldLabels: LABELS, savedAt: null, pressedWithoutChange: false });
    expect(state).toEqual({ kind: "changed", count: 2, fields: ["Ville", "Téléphone"] });
  });

  it("dit « Rien à enregistrer » sans changement, et le redit quand on appuie quand même (bouton jamais grisé)", () => {
    expect(saveBarState({ changed: [], fieldLabels: LABELS, savedAt: null, pressedWithoutChange: false })).toEqual({ kind: "nothing" });
    expect(saveBarState({ changed: [], fieldLabels: LABELS, savedAt: null, pressedWithoutChange: true })).toEqual({ kind: "nothingToSave" });
  });

  it("dit l'heure du dernier enregistrement, à l'heure de Paris", () => {
    const at = new Date("2026-11-25T09:42:00Z");
    expect(saveBarState({ changed: [], fieldLabels: LABELS, savedAt: at, pressedWithoutChange: false })).toEqual({ kind: "saved", at });
    expect(savedTimeLabel(at, "fr")).toBe("10:42");
    // Passage à l'heure d'été (dernier dimanche de mars) : 9 h 42 UTC vaut 11 h 42 à Paris.
    expect(savedTimeLabel(new Date("2027-03-28T09:42:00Z"), "fr")).toBe("11:42");
  });

  it("pose la question à la sortie seulement s'il reste des modifications (règle M1)", () => {
    expect(leaveDecision([])).toBe("leave");
    expect(leaveDecision(["city"])).toBe("confirm");
  });

  it("une ancre de la même page ne quitte pas l'écran ; une autre adresse, si", () => {
    const here = "http://localhost:3000/parametres/entreprise";
    expect(leavesScreen(here, "#tva")).toBe(false);
    expect(leavesScreen(here, "/parametres/entreprise#tva")).toBe(false);
    expect(leavesScreen(here, "/parametres/mentions")).toBe(true);
    expect(leavesScreen(here, "/parametres/entreprise?onglet=x")).toBe(true);
    expect(leavesScreen(here, "https://exemple.test/")).toBe(true);
  });
});

describe("UX-09 — « ✓ Enregistré » à côté d'un réglage isolé (lot 74h, D7)", () => {
  it("reste affiché quelques secondes, puis s'efface", () => {
    expect(SAVED_VISIBLE_MS).toBeGreaterThanOrEqual(2000);
    expect(SAVED_VISIBLE_MS).toBeLessThanOrEqual(6000);
  });
});
