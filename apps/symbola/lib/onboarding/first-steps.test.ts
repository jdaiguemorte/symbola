// Lot 72b (HUB-11, AIDE-04 ; spécification du lot 72, § 5.2 et J5 ; maquette 13 du lot 68) — « Pour bien
// démarrer » devient une ligne en bas de l'accueil : « 1 sur 2 · reste : … », l'étape suivante, « Masquer ».
import { describe, expect, it } from "vitest";
import { firstStepsLine } from "./first-steps";

const essentials = { key: "essentials" as const, href: "/demarrage/essentiel", done: false };
const vendor = { key: "first_vendor" as const, href: "/prestataires/nouveau", done: false };

describe("AIDE-04, HUB-11 — Pour bien démarrer, une ligne qu'on masque (lot 72b, critère 5)", () => {
  it("« 0 sur 2 », ce qui reste dans l'ordre, et l'étape suivante", () => {
    expect(firstStepsLine([essentials, vendor], false)).toEqual({ done: 0, total: 2, remaining: ["essentials", "first_vendor"], next: essentials });
  });

  it("une étape faite sort de « reste » ; l'étape suivante est la première qui reste", () => {
    expect(firstStepsLine([{ ...essentials, done: true }, vendor], false)).toEqual({ done: 1, total: 2, remaining: ["first_vendor"], next: vendor });
  });

  it("masquée par la personne, ou tout fait (liste absente) : plus rien sur l'accueil", () => {
    expect(firstStepsLine([essentials, vendor], true)).toBeNull();
    expect(firstStepsLine(null, false)).toBeNull();
  });
});
