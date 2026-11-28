// Lot 71d (HUB-14, UX-07 ; spécification du lot 71, § 0 et § 5.4 ; maquette 08) — les mots des nombres,
// de « Doublons », du bilan et du retrait : ceux de la maquette, en français et en anglais ; « engagé »
// ne s'affiche jamais (le réel est « réel selon votre fichier »).
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "@symbola/i18n/messages/en.json";
import frMessages from "@symbola/i18n/messages/fr.json";

const NAMESPACES = ["ImportFigures", "ImportDoublons", "ImportBilan", "ImportWithdraw"] as const;

const leaves = (value: unknown, path = ""): [string, string][] =>
  typeof value === "string" ? [[path, value]] : Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));

describe("HUB-14 — Les mots du bilan d'un import (lot 71d)", () => {
  const fr = createTranslator({ locale: "fr", messages: frMessages, namespace: "ImportFigures" });

  it("les nombres de budget.csv, dans les mots de la maquette", () => {
    expect(fr("lines", { lines: 14, slots: 9, newSlots: 1 })).toBe("14 lignes dans 9 postes, dont 1 nouveau");
    expect(fr("real", { missing: 8 })).toBe("de réel selon votre fichier (8 lignes non renseignées)");
    expect(fr("paid", { count: 6 })).toBe("réglés : 6 acomptes");
    expect(fr("toPay", { count: 5 })).toBe("à payer : 5 soldes");
    expect(fr("vendors", { count: 7, outside: 0 })).toBe("7 prestataires retenus (tous dans votre carnet)");
    expect(fr("notDoneAfter", { overdue: 0 })).toBe("aucune échéance en retard, aucune relance, aucune tâche créée");
  });

  it("« engagé » ne s'affiche jamais ; chaque texte existe en français et en anglais", () => {
    for (const namespace of NAMESPACES) {
      const frLeaves = leaves((frMessages as Record<string, unknown>)[namespace]);
      const enLeaves = leaves((enMessages as Record<string, unknown>)[namespace]);
      expect(frLeaves.map(([key]) => key).sort()).toEqual(enLeaves.map(([key]) => key).sort());
      for (const [, text] of frLeaves) expect(text.toLowerCase()).not.toMatch(/engag/);
      for (const [, text] of enLeaves) expect(text.toLowerCase()).not.toMatch(/commit/);
    }
  });

  it("la fenêtre de retrait dit ce qui part et ce qui reste, et nomme la case des éléments modifiés", () => {
    const withdraw = createTranslator({ locale: "fr", messages: frMessages, namespace: "ImportWithdraw" });
    expect(withdraw("title", { file: "budget.csv" })).toBe("Retirer l'import « budget.csv » ?");
    expect(withdraw("forceModified", { count: 2 })).toBe("Retirer aussi les 2 éléments modifiés depuis");
    expect(withdraw("staying.restoredSlots", { count: 1, slots: "« Tenues »" })).toBe("le poste « Tenues », remis « à trouver »");
  });
});
