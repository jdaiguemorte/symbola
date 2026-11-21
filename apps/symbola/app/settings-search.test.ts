import { describe, expect, it } from "vitest";
import { activeSettingsItem, filterSettingsGroups, plainText } from "./settings-search";

const GROUPS = [
  { label: "Mon entreprise", items: [{ href: "/parametres", label: "Entreprise et TVA" }, { href: "/parametres/journal", label: "Journal d'activité" }] },
  { label: "Événements", items: [{ href: "/events/parametres", label: "Lignes du budget" }, { href: "/events/parametres/types", label: "Types d'événements" }, { href: "/events/modeles-evenement", label: "Modèles d'évènement" }] },
  { label: "Ventes", items: [{ href: "/devis/catalogue", label: "Catalogue" }, { href: "/devis/parametres", label: "Devis et factures" }] },
];

describe("UX-13 — Menu des Paramètres : « Chercher un réglage » (lot 62b, décision D2)", () => {
  it("filtre les rubriques par leur nom, sans tenir compte des accents ni de la casse", () => {
    const found = filterSettingsGroups(GROUPS, "EVENEMENT");
    expect(found.map((group) => group.label)).toEqual(["Événements"]);
    expect(found[0]!.items.map((item) => item.label)).toEqual(["Types d'événements", "Modèles d'évènement"]);
  });

  it("chaque mot tapé doit se trouver dans le nom ; un groupe sans rubrique trouvée disparaît", () => {
    expect(filterSettingsGroups(GROUPS, "types evenements").flatMap((group) => group.items.map((item) => item.href))).toEqual(["/events/parametres/types"]);
    expect(filterSettingsGroups(GROUPS, "d'activite").flatMap((group) => group.items.map((item) => item.href))).toEqual(["/parametres/journal"]);
    expect(filterSettingsGroups(GROUPS, "zzz")).toEqual([]);
  });

  it("une recherche vide rend tout le menu", () => {
    expect(filterSettingsGroups(GROUPS, "   ")).toBe(GROUPS);
  });

  it("la rubrique ouverte est celle dont l'adresse est la plus précise", () => {
    expect(activeSettingsItem(GROUPS, "/events/parametres/types")?.label).toBe("Types d'événements");
    expect(activeSettingsItem(GROUPS, "/events/parametres")?.label).toBe("Lignes du budget");
    expect(activeSettingsItem(GROUPS, "/parametres/journal")?.label).toBe("Journal d'activité");
    expect(activeSettingsItem(GROUPS, "/devis")).toBeUndefined();
  });

  it("le texte comparé n'a ni accent, ni apostrophe, ni majuscule", () => {
    expect(plainText("  Modèles d’Évènement ")).toBe("modeles d evenement");
  });
});
