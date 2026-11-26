// Lot 63a (PRE-01, PRE-11 ; recette du 21/11/2026) — filtres actifs du carnet en pastilles
// retirables, et « Effacer les filtres » qui garde la famille, le type et la vue.
import { describe, expect, it } from "vitest";
import { activeFilters, clearFiltersHref, parseBookFilters, vendorBookEmptyState, type ActiveFilterLabels } from "./filters";

const TAG = "11111111-1111-4111-8111-111111111111";
const FAMILY = "22222222-2222-4222-8222-222222222222";
const labels: ActiveFilterLabels = {
  text: (text) => `« ${text} »`,
  around: (place, km) => `${place}, ${km} km`,
  workedWith: "Déjà travaillé ensemble",
  rating: (rating) => `Au moins ${rating} sur 5`,
  unplaced: "À placer",
  tag: (tagId) => (tagId === TAG ? "Bohème" : null),
  field: () => null,
};

describe("PRE-01, PRE-11 — Filtres actifs et remise à zéro (lot 63a)", () => {
  const query = { famille: FAMILY, vue: "carte", q: "verdier", autour: "Lyon", rayon: "25", deja: "1", note: "4", etiquette: TAG };
  const filters = parseBookFilters(query, []);

  it("chaque filtre actif devient une pastille, dont le lien le retire seul", () => {
    const chips = activeFilters("/prestataires", query, filters, labels);
    expect(chips.map((chip) => chip.label)).toEqual(["« verdier »", "Lyon, 25 km", "Déjà travaillé ensemble", "Au moins 4 sur 5", "Bohème"]);
    const around = new URLSearchParams(chips.find((chip) => chip.key === "autour")!.href.split("?")[1]);
    expect(around.has("autour")).toBe(false);
    expect(around.has("rayon")).toBe(false);
    expect(around.get("q")).toBe("verdier");
  });

  it("« Effacer les filtres » retire les filtres de la barre, et garde famille et vue", () => {
    const params = new URLSearchParams(clearFiltersHref("/prestataires", query, filters).split("?")[1]);
    expect(Object.fromEntries(params)).toEqual({ famille: FAMILY, vue: "carte" });
  });

  it("sans filtre, aucune pastille", () => {
    expect(activeFilters("/prestataires", { famille: FAMILY }, parseBookFilters({ famille: FAMILY }, []), labels)).toEqual([]);
  });
});

describe("UX-08, UX-10 — Le carnet vide ne parle pas de filtres (C-69, lot 69)", () => {
  it("aucune fiche et aucun type : on invite à créer des types ou à ajouter un prestataire", () => {
    expect(vendorBookEmptyState({ total: 0, results: 0, types: 0 })).toBe("noTypes");
  });
  it("aucune fiche mais des types : le carnet est vide, jamais « filtres »", () => {
    expect(vendorBookEmptyState({ total: 0, results: 0, types: 9 })).toBe("book");
  });
  it("douze fiches et un filtre qui n'en garde aucune : « filtres »", () => {
    expect(vendorBookEmptyState({ total: 12, results: 0, types: 9 })).toBe("filters");
  });
  it("des résultats : rien à dire", () => {
    expect(vendorBookEmptyState({ total: 12, results: 3, types: 9 })).toBeNull();
  });
});
