import { describe, expect, it } from "vitest";
import { anonymizedEmail, idsOfKind, monthStart } from "./erasure";

describe("RGPD-03 — Outils d'anonymisation", () => {
  it("date généralisée au 1er du mois, e-mail de remplacement non réversible et jamais deux fois le même", () => {
    expect(monthStart("2027-06-12")).toBe("2027-06-01");
    expect(anonymizedEmail()).toMatch(/^anonymise-[0-9a-f-]{36}@anonymise\.invalid$/);
    expect(anonymizedEmail()).not.toBe(anonymizedEmail());
  });

  it("ne garde que les identifiants bien formés de la nature demandée, sans doublon", () => {
    const id = "6f1c2b9e-1d2a-4c3b-9a8f-1234567890ab";
    expect(idsOfKind([{ kind: "task", recordId: id }, { kind: "task", recordId: id }, { kind: "task", recordId: "x' OR 1=1" }, { kind: "event", recordId: id }], "task")).toEqual([id]);
  });
});
