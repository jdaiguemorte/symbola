// Lot 74a (HUB-09, HUB-10, PAR-01 ; C-68, D6, B1 à B6, R3 ; page 22 des maquettes du lot 68) — l'enchaînement
// des questions de l'assistant de démarrage et l'issue de sa fin. Règles pures, sans base.
import { describe, expect, it } from "vitest";
import { questionDisplay, questionsLeft, nextQuestion, previousQuestion, readyOutcome, reachableQuestion, isVatAnswer, vatAnswerEffect, isOngoingAnswer } from "./questionnaire";

describe("HUB-09 — Questionnaire d'accueil : l'enchaînement des cinq questions (lot 74a)", () => {
  it("critère 5 — la question des outils ne suit que « Oui » ; « Non » mène à la TVA", () => {
    expect(nextQuestion(1, null)).toBe(2);
    expect(nextQuestion(2, null)).toBe(3);
    expect(nextQuestion(3, "yes")).toBe(4);
    expect(nextQuestion(3, "no")).toBe(5);
    expect(nextQuestion(4, "yes")).toBe(5);
    expect(nextQuestion(5, "yes")).toBeNull();
    expect(nextQuestion(5, "no")).toBeNull();
  });

  it("critère 5 — après « Non », la TVA est comptée « 4 sur 4 » ; après « Oui », « 5 sur 5 »", () => {
    expect(questionDisplay(5, "no")).toEqual({ number: 4, total: 4 });
    expect(questionDisplay(5, "yes")).toEqual({ number: 5, total: 5 });
    expect(questionDisplay(4, "yes")).toEqual({ number: 4, total: 5 });
    // Tant que la question 3 n'a pas de réponse, le compte est de cinq (« ne bouge pas »).
    expect(questionDisplay(3, null)).toEqual({ number: 3, total: 5 });
    expect(questionDisplay(1, null)).toEqual({ number: 1, total: 5 });
  });

  it("« Question précédente » saute la question des outils après « Non »", () => {
    expect(previousQuestion(5, "no")).toBe(3);
    expect(previousQuestion(5, "yes")).toBe(4);
    expect(previousQuestion(4, "yes")).toBe(3);
    expect(previousQuestion(2, null)).toBe(1);
    expect(previousQuestion(1, null)).toBeNull();
  });

  it("une question déjà vue se rouvre, jamais une question d'après ; la question des outils jamais après « Non »", () => {
    expect(reachableQuestion(2, 4, "yes")).toBe(2);
    expect(reachableQuestion(5, 4, "yes")).toBe(4);
    expect(reachableQuestion(null, 4, "yes")).toBe(4);
    expect(reachableQuestion(4, 5, "no")).toBe(5);
    expect(reachableQuestion(0, 3, null)).toBe(3);
    expect(reachableQuestion(Number.NaN, 3, null)).toBe(3);
  });

  it("critère 2 — le reste se compte d'après les questions qui se posent : 2 sur 5 après la question 3", () => {
    expect(questionsLeft(4, "yes")).toEqual({ left: 2, total: 5 });
    expect(questionsLeft(5, "no")).toEqual({ left: 1, total: 4 });
    expect(questionsLeft(2, null)).toEqual({ left: 4, total: 5 });
    expect(questionsLeft(1, null)).toEqual({ left: 5, total: 5 });
  });

  it("les réponses de fait se lisent par leur clé, toute autre est refusée", () => {
    expect(isOngoingAnswer("yes")).toBe(true);
    expect(isOngoingAnswer("no")).toBe(true);
    expect(isOngoingAnswer("")).toBe(false);
    expect(isOngoingAnswer("peut-être")).toBe(false);
    expect(isVatAnswer("no")).toBe(true);
    expect(isVatAnswer("yes")).toBe(true);
    expect(isVatAnswer("unknown")).toBe(true);
    expect(isVatAnswer("franchise")).toBe(false);
  });

  it("critère 9 — « Non » pose la franchise, « Oui » l'assujettissement, « Je ne sais pas encore » la franchise et le drapeau", () => {
    expect(vatAnswerEffect("no")).toEqual({ regime: "franchise", pending: false });
    expect(vatAnswerEffect("yes")).toEqual({ regime: "assujetti", pending: false });
    expect(vatAnswerEffect("unknown")).toEqual({ regime: "franchise", pending: true });
  });
});

describe("HUB-10 / PAR-01 — « Votre espace est prêt » : un seul premier pas selon les réponses (lot 74a, critère 7)", () => {
  it("« Non, je pars de zéro » : « Créer votre premier mariage »", () => {
    expect(readyOutcome("no", [])).toBe("create");
    // Une réponse « Oui » oubliée ne garde pas ses outils : « Non » l'emporte.
    expect(readyOutcome("no", ["spreadsheet"])).toBe("create");
  });

  it("« Oui » et un tableur ou un autre logiciel : « Reprendre un mariage en cours »", () => {
    expect(readyOutcome("yes", ["spreadsheet"])).toBe("takeover");
    expect(readyOutcome("yes", ["paper", "other_software"])).toBe("takeover");
  });

  it("« Oui » et le papier, un traitement de texte ou l'agenda seulement : « Entrer un mariage en cours »", () => {
    expect(readyOutcome("yes", ["paper"])).toBe("enter");
    expect(readyOutcome("yes", ["word_processor", "email_calendar"])).toBe("enter");
  });

  it("parcours non choisi (question 3 sans réponse) : la création, sauf un outil d'où l'on reprend", () => {
    expect(readyOutcome(null, [])).toBe("create");
    expect(readyOutcome(null, ["paper"])).toBe("create");
    expect(readyOutcome(null, ["spreadsheet"])).toBe("takeover");
  });
});
