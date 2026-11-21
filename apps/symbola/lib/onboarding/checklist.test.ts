// Lot 33b (PAR-01, étape 6 ; D11) — liste de prise en main : actions des modules non souscrits
// retirées, disparition une fois tout fait. Lot 63a (HUB-11 ; recette du 21/11/2026) : deux
// actions seulement ; le devis, l'import des contacts et l'invitation du client sont des tutoriels.
import { describe, expect, it } from "vitest";
import { ONBOARDING_CHECKLIST_KEYS } from "@symbola/starter-templates";
import { TUTORIALS } from "@/lib/help/catalog";
import { buildChecklist } from "./checklist";

const all = { essentials: true, first_vendor: true };
const none = { essentials: false, first_vendor: false };

describe("HUB-11 — Pour bien démarrer, l'indispensable seulement (lot 63a)", () => {
  it("deux actions : régler l'essentiel, puis ajouter un premier prestataire", () => {
    expect(ONBOARDING_CHECKLIST_KEYS).toEqual(["essentials", "first_vendor"]);
    expect(buildChecklist({ tools: [], available: all, done: none })).toEqual([
      { key: "essentials", href: "/parametres", done: false },
      { key: "first_vendor", href: "/prestataires/nouveau", done: false },
    ]);
    // Un outil remplacé ne fait plus remonter une action retirée.
    expect(buildChecklist({ tools: ["spreadsheet"], available: all, done: none })!.map((item) => item.key)).toEqual(["essentials", "first_vendor"]);
  });

  it("le devis, l'import des contacts et l'invitation du client restent proposés en tutoriels", () => {
    const keys = TUTORIALS.map((tutorial) => tutorial.key);
    expect(keys).toEqual(expect.arrayContaining(["quote-signature", "import", "client-space"]));
  });

  it("chaque action se coche d'elle-même, et la liste disparaît une fois tout faite", () => {
    const partly = buildChecklist({ tools: [], available: all, done: { ...none, essentials: true } })!;
    expect(partly.filter((item) => item.done).map((item) => item.key)).toEqual(["essentials"]);
    expect(buildChecklist({ tools: [], available: all, done: all })).toBeNull();
  });

  it("ARC-06 — sans le carnet de prestataires, l'action n'apparaît pas et ne bloque pas la fin de la liste", () => {
    const withoutVendors = { ...all, first_vendor: false };
    expect(buildChecklist({ tools: [], available: withoutVendors, done: none })!.map((item) => item.key)).toEqual(["essentials"]);
    expect(buildChecklist({ tools: [], available: withoutVendors, done: { essentials: true, first_vendor: false } })).toBeNull();
  });
});
