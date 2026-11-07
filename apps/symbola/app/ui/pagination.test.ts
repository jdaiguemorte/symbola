import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const items = Array.from({ length: 45 }, (_, index) => index + 1);

describe("HUB-17 — Pagination des listes de la console", () => {
  it("affiche 20 éléments par page, la première par défaut", () => {
    const page = paginate(items, undefined);
    expect(page.items).toEqual(items.slice(0, 20));
    expect(page).toMatchObject({ page: 1, pageCount: 3, total: 45 });
  });

  it("la dernière page garde le reste", () => {
    expect(paginate(items, "3").items).toEqual([41, 42, 43, 44, 45]);
  });

  it("une page hors bornes ou illisible revient dans les bornes, sans erreur", () => {
    expect(paginate(items, "99").page).toBe(3);
    expect(paginate(items, "0").page).toBe(1);
    expect(paginate(items, "abc").page).toBe(1);
  });

  it("une liste vide a une seule page, vide", () => {
    expect(paginate([], "2")).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});
