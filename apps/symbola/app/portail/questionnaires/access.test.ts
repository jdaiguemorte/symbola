import { describe, expect, it } from "vitest";
import { questionnairesRubricOpen } from "./access";

describe("POR-07, POR-10 — Rubrique « Questionnaires » du portail (SEC-36)", () => {
  const rights = (rubrics: string[]) => ({ rubrics, budgetScope: "all", sharedSlotIds: [] }) as never;

  it("fermée par défaut : un lien sans la rubrique ne l'ouvre pas", () => {
    expect(questionnairesRubricOpen({ audience: "client", rights: rights(["tasks", "program"]) })).toBe(false);
  });

  it("ouverte pour le lien du client à qui un questionnaire a été envoyé", () => {
    expect(questionnairesRubricOpen({ audience: "client", rights: rights(["questionnaires"]) })).toBe(true);
  });

  it("jamais pour le lien d'un prestataire ou d'un invité, même avec la rubrique", () => {
    expect(questionnairesRubricOpen({ audience: "vendor", rights: rights(["questionnaires"]) })).toBe(false);
    expect(questionnairesRubricOpen({ audience: "guest", rights: rights(["questionnaires"]) })).toBe(false);
  });
});
