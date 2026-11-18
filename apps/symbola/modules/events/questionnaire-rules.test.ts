import { describe, expect, it } from "vitest";
import type { QuestionnaireQuestion } from "@symbola/contracts";
import { AnswerInvalidError, cleanAnswer, cleanQuestion, cleanQuestions, isSensitiveQuestion, parseAmountCents, portalQuestions, prefillPlan, QuestionInvalidError, unansweredCount, type EventFieldValues } from "./questionnaire-rules";

const emptyEvent: EventFieldValues = { event_date: null, guests: null, budget: null, venue: null, city: null, style: null, event_type: null };

function question(overrides: Partial<QuestionnaireQuestion> = {}): QuestionnaireQuestion {
  return { key: "guests", label: "Combien d'invités ?", help: null, nature: "number", choices: [], eventField: "guests", ...overrides };
}

describe("POR-07 — Questionnaires : questions et réponses", () => {
  it("une question a un intitulé, une nature connue, des choix pour les natures à choix ; pas de question « fichier » (D8)", () => {
    expect(cleanQuestion({ label: "  Votre  style ? ", nature: "single_choice", choices: ["Bohème", "Classique", "Bohème"], eventField: "style" })).toMatchObject({ label: "Votre style ?", choices: ["Bohème", "Classique"], eventField: "style" });
    expect(() => cleanQuestion({ label: "Photos d'inspiration", nature: "file" })).toThrow(QuestionInvalidError);
    expect(() => cleanQuestion({ label: "Style", nature: "single_choice", choices: ["Un seul"] })).toThrow(/choices/);
    expect(() => cleanQuestion({ label: "", nature: "short_text" })).toThrow(/label/);
  });

  it("le champ alimenté doit aller avec la nature (la date avec une date, les invités avec un nombre, le budget avec un montant)", () => {
    expect(cleanQuestion({ label: "Date", nature: "date", eventField: "event_date" }).eventField).toBe("event_date");
    expect(() => cleanQuestion({ label: "Date", nature: "short_text", eventField: "event_date" })).toThrow(/field/);
    expect(() => cleanQuestion({ label: "Budget", nature: "number", eventField: "budget" })).toThrow(/field/);
    expect(() => cleanQuestion({ label: "X", nature: "short_text", eventField: "religion" })).toThrow(/field/);
  });

  it("les clés des questions sont uniques dans un modèle ; un modèle a au moins une question", () => {
    const questions = cleanQuestions([
      { key: "music", label: "Première danse", nature: "short_text" },
      { key: "music", label: "Entrée", nature: "short_text" },
    ]);
    expect(new Set(questions.map((item) => item.key)).size).toBe(2);
    expect(() => cleanQuestions([])).toThrow(/empty/);
  });

  it("chaque réponse est contrôlée selon la nature de sa question", () => {
    expect(cleanAnswer(question(), "140")).toBe(140);
    expect(() => cleanAnswer(question(), "beaucoup")).toThrow(AnswerInvalidError);
    expect(cleanAnswer(question({ nature: "date", eventField: "event_date" }), "2027-06-12")).toBe("2027-06-12");
    expect(() => cleanAnswer(question({ nature: "date" }), "2027-02-30")).toThrow(/date/);
    expect(cleanAnswer(question({ nature: "amount", eventField: "budget" }), "25 000,50 €")).toBe(2_500_050);
    expect(cleanAnswer(question({ nature: "multiple_choice", choices: ["Rock", "Jazz", "Soul"] }), ["Soul", "Rock"])).toEqual(["Rock", "Soul"]);
    expect(() => cleanAnswer(question({ nature: "single_choice", choices: ["A", "B"] }), "C")).toThrow(/choice/);
    expect(cleanAnswer(question({ nature: "short_text" }), "   ")).toBeNull();
    expect(() => cleanAnswer(question({ nature: "short_text" }), "x".repeat(301))).toThrow(/too_long/);
  });

  it("un montant en euros se lit en centimes, sans virgule flottante", () => {
    expect(parseAmountCents("12000")).toBe(1_200_000);
    expect(parseAmountCents("0,1")).toBe(10);
    expect(parseAmountCents("12,345")).toBeNull();
    expect(parseAmountCents("-5")).toBeNull();
  });

  it("DPO : une question sur la santé ou la religion est signalée", () => {
    const words = ["santé", "religion", "allergie"];
    expect(isSensitiveQuestion("Avez-vous des ALLERGIES ?", words)).toBe(true);
    expect(isSensitiveQuestion("Quelle est votre religion ?", words)).toBe(true);
    expect(isSensitiveQuestion("Votre première danse ?", words)).toBe(false);
  });
});

describe("CRM-09 — Aucune réponse n'est redemandée ensuite", () => {
  const questions = [question(), question({ key: "date", label: "Date ?", nature: "date", eventField: "event_date" }), question({ key: "first-dance", label: "Première danse ?", nature: "short_text", eventField: null })];

  it("une question déjà répondue dans un autre questionnaire n'est pas reposée ; un champ connu est proposé pré-rempli", () => {
    const view = portalQuestions(questions, new Map(), [{ key: "other-guests", eventField: "guests", value: 120 }], { ...emptyEvent, event_date: "2027-06-12" });
    expect(view[0]).toMatchObject({ key: "guests", answeredElsewhere: true, suggestion: null, answer: null });
    expect(view[1]).toMatchObject({ key: "date", answeredElsewhere: false, suggestion: "2027-06-12" });
    expect(view[2]).toMatchObject({ answeredElsewhere: false, suggestion: null });
    expect(unansweredCount(view)).toBe(2);
  });

  it("la réponse de la personne passe avant tout (reprise là où elle s'était arrêtée)", () => {
    const view = portalQuestions(questions, new Map([["guests", 140]]), [{ key: "guests", eventField: "guests", value: 120 }], emptyEvent);
    expect(view[0]).toMatchObject({ answer: 140, answeredElsewhere: false });
  });
});

describe("CRM-09 — Préremplissage de l'évènement (D7)", () => {
  it("un champ vide se remplit ; un champ égal ne demande rien ; un écart est montré à la planner", () => {
    const plan = prefillPlan(
      [
        { key: "guests", label: "Invités", eventField: "guests", value: 140, resolution: null },
        { key: "date", label: "Date", eventField: "event_date", value: "2027-06-12", resolution: null },
        { key: "city", label: "Ville", eventField: "city", value: "lyon", resolution: null },
        { key: "style", label: "Style", eventField: "style", value: "Bohème", resolution: "kept" },
      ],
      { ...emptyEvent, guests: 120, city: "Lyon", style: "Classique" },
    );
    expect(plan.fill).toEqual([{ key: "date", eventField: "event_date", value: "2027-06-12" }]);
    expect(plan.same).toEqual(["city"]);
    expect(plan.differences).toEqual([{ key: "guests", label: "Invités", eventField: "guests", answer: 140, current: 120 }]);
  });

  it("deux réponses différentes pour un même champ vide : la première remplit, la seconde est un écart", () => {
    const plan = prefillPlan(
      [
        { key: "a", label: "A", eventField: "guests", value: 100, resolution: null },
        { key: "b", label: "B", eventField: "guests", value: 150, resolution: null },
      ],
      emptyEvent,
    );
    expect(plan.fill).toHaveLength(1);
    expect(plan.differences).toEqual([{ key: "b", label: "B", eventField: "guests", answer: 150, current: 100 }]);
  });
});
