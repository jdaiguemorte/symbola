import { describe, expect, it } from "vitest";
import { readPastDueAnswers } from "./past-due-form";

const ID = "0b9a8f43-5a3e-4b7e-9c41-0f7a3c2d1e00";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("EVT-01 — Réponses de l'étape « Les échéances déjà passées » (lot 74b, B7)", () => {
  it("lit une réponse par tâche et la répartition ; 4 semaines sans étape", () => {
    expect(readPastDueAnswers(form([[`pastDue:${ID}`, "done"], ["pastDueSpread", "8w"], ["name", "Léa & Maxime"]]))).toEqual({ spread: "8w", answers: { [ID]: "done" } });
    expect(readPastDueAnswers(form([]))).toEqual({ spread: "4w", answers: {} });
  });

  it("refuse une réponse inconnue, un identifiant qui n'en est pas un, une répartition inconnue", () => {
    expect(readPastDueAnswers(form([[`pastDue:${ID}`, "late"]]))).toBeNull();
    expect(readPastDueAnswers(form([["pastDue:1 or 1=1", "done"]]))).toBeNull();
    expect(readPastDueAnswers(form([["pastDueSpread", "3w"]]))).toBeNull();
  });
});
