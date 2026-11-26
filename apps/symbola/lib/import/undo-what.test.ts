// Lot 69 (UX-10, HUB-14 ; C-66 de l'audit UX) — la phrase de l'annulation d'un import.
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "@symbola/i18n/messages/en.json";
import frMessages from "@symbola/i18n/messages/fr.json";

describe("UX-10, HUB-14 — La phrase de l'annulation d'un import se lit dans tous les cas (C-66, lot 69)", () => {
  const say = (locale: "fr" | "en", created: number, updated: number) =>
    createTranslator({ locale, messages: locale === "fr" ? frMessages : enMessages, namespace: "Import" })("undoWhat", { created, updated });

  it("fr : rien, un créé, des mis à jour, un mélange", () => {
    expect(say("fr", 0, 0)).toBe("L'annulation ne supprime rien.");
    expect(say("fr", 1, 0)).toBe("L'annulation supprime l'élément créé.");
    expect(say("fr", 0, 1)).toBe("L'annulation remet l'élément mis à jour comme avant.");
    expect(say("fr", 0, 2)).toBe("L'annulation remet les 2 éléments mis à jour comme avant.");
    expect(say("fr", 3, 1)).toBe("L'annulation supprime les 3 éléments créés et remet l'élément mis à jour comme avant.");
    expect(say("fr", 3, 2)).toBe("L'annulation supprime les 3 éléments créés et remet les 2 éléments mis à jour comme avant.");
  });

  it("en : même lecture", () => {
    expect(say("en", 0, 0)).toBe("Undoing deletes nothing.");
    expect(say("en", 1, 0)).toBe("Undoing deletes the created item.");
    expect(say("en", 0, 2)).toBe("Undoing restores the 2 updated items as they were.");
    expect(say("en", 3, 1)).toBe("Undoing deletes the 3 created items and restores the updated item as it was.");
  });

  it("aucune phrase ne se termine par « rien d'autre » ou « nothing else »", () => {
    for (const [created, updated] of [[0, 0], [1, 0], [0, 2], [3, 1]] as const) {
      expect(say("fr", created, updated)).not.toMatch(/rien d'autre/);
      expect(say("en", created, updated)).not.toMatch(/nothing else/);
    }
  });
});
