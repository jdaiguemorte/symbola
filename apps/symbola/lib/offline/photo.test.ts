// Lot 51 (JRJ-06, JRJ-07 ; ADR 0091) — une photo prise sur le lieu est réduite sur le téléphone avant
// d'entrer dans la file (2 000 px de côté), sans être agrandie.
import { describe, expect, it } from "vitest";
import { scaledSize } from "./photo";

describe("JRJ-06 — photo réduite sur le téléphone", () => {
  it("le plus grand côté est ramené à la limite, en gardant les proportions ; une petite photo reste telle quelle", () => {
    expect(scaledSize(4032, 3024, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(scaledSize(3024, 4032, 2000)).toEqual({ width: 1500, height: 2000 });
    expect(scaledSize(1200, 800, 2000)).toEqual({ width: 1200, height: 800 });
    expect(scaledSize(0, 0, 2000)).toEqual({ width: 1, height: 1 });
  });
});
