import { describe, expect, it } from "vitest";
import { foldSearchText, likeWord, searchWords } from "./search";

describe("AIDE-08 — repli des termes de recherche", () => {
  it("ignore accents et majuscules", () => {
    expect(foldSearchText("Théo & Zoé ÉLODIE")).toBe("theo & zoe elodie");
  });
  it("découpe en mots, refuse un terme d'un seul caractère", () => {
    expect(searchWords("  Marion   Julien ")).toEqual(["marion", "julien"]);
    expect(searchWords("a")).toEqual([]);
  });
  it("échappe les jokers du LIKE", () => {
    expect(likeWord("50%_x")).toBe("%50\\%\\_x%");
  });
});
