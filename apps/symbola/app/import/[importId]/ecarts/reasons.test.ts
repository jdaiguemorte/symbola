// Lot 67a (HUB-14 ; recette du 24/11/2026, R03) — le motif d'un champ obligatoire vide nomme la
// colonne du fichier à remplir, quand le champ a une colonne.
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import { reasonText } from "./reasons";

const messages = fr.Import as unknown as Record<string, unknown>;
function t(key: string, values: Record<string, string> = {}): string {
  const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages) as string;
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => values[name] ?? "");
}

describe("HUB-14 — Motif d'une ligne rejetée (lot 67a)", () => {
  it("nomme la colonne du fichier restée vide, puis le champ obligatoire", () => {
    expect(reasonText(t, { fieldKey: "slotLabel", code: "required_missing", value: "", column: "Poste" })).toBe("la colonne « Poste » est vide (champ obligatoire « Ligne du budget »)");
  });

  it("sans colonne rattachée au champ, garde le motif d'origine", () => {
    expect(reasonText(t, { fieldKey: "slotLabel", code: "required_missing", value: "" })).toBe("Ligne du budget : champ obligatoire manquant");
  });
});
