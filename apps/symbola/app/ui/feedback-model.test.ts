// Lot 70b (UX-07, UX-15, NFR-16 ; M5, M6) — le message de retour : un seul à la fois, dix secondes
// quand on peut défaire, cinq sinon, le temps arrêté sous la souris ou le focus.
import { describe, expect, it } from "vitest";
import { FEEDBACK_SHORT_MS, FEEDBACK_UNDO_MS, durationFor, initialFeedback, isExpired, pauseFeedback, remainingMs, resumeFeedback, showFeedback, type FeedbackMessage } from "./feedback-model";

const done: FeedbackMessage = { id: "a", tone: "info", title: "Tâche faite : Choisir le fleuriste", action: { kind: "undo", label: "Annuler" } };
const saved: FeedbackMessage = { id: "b", tone: "info", title: "Tâche enregistrée : Choisir le fleuriste" };
const failed: FeedbackMessage = { id: "c", tone: "error", title: "la tâche n'a pas été enregistrée", action: { kind: "retry", label: "Réessayer" } };

describe("UX-07 — Message de retour : une place, une forme (lot 70b)", () => {
  it("dure dix secondes quand on peut défaire, cinq sinon", () => {
    expect(durationFor(done)).toBe(FEEDBACK_UNDO_MS);
    expect(FEEDBACK_UNDO_MS).toBe(10_000);
    expect(durationFor(saved)).toBe(FEEDBACK_SHORT_MS);
    expect(FEEDBACK_SHORT_MS).toBe(5_000);
  });

  it("une erreur qu'on peut réessayer reste dix secondes, le temps de lire et de cliquer", () => {
    expect(durationFor(failed)).toBe(FEEDBACK_UNDO_MS);
  });

  it("un seul message à la fois : le suivant remplace le précédent et relance son temps", () => {
    let state = showFeedback(initialFeedback, done, 1_000);
    state = showFeedback(state, saved, 4_000);
    expect(state.message?.id).toBe("b");
    expect(remainingMs(state, 4_000)).toBe(FEEDBACK_SHORT_MS);
  });

  it("le temps s'écoule puis le message disparaît", () => {
    const state = showFeedback(initialFeedback, done, 0);
    expect(remainingMs(state, 3_000)).toBe(7_000);
    expect(isExpired(state, 9_999)).toBe(false);
    expect(isExpired(state, 10_000)).toBe(true);
  });

  it("le temps s'arrête sous la souris ou le focus, et reprend où il en était", () => {
    let state = showFeedback(initialFeedback, done, 0);
    state = pauseFeedback(state, 4_000);
    expect(remainingMs(state, 60_000)).toBe(6_000);
    expect(isExpired(state, 60_000)).toBe(false);
    state = resumeFeedback(state, 60_000);
    expect(remainingMs(state, 62_000)).toBe(4_000);
    expect(isExpired(state, 66_000)).toBe(true);
  });

  it("deux pauses (souris puis focus) ne comptent qu'une fois ; reprendre sans pause ne change rien", () => {
    let state = showFeedback(initialFeedback, done, 0);
    state = pauseFeedback(state, 2_000);
    state = pauseFeedback(state, 5_000);
    expect(remainingMs(state, 5_000)).toBe(8_000);
    const running = showFeedback(initialFeedback, saved, 0);
    expect(resumeFeedback(running, 1_000)).toBe(running);
  });

  it("sans message, rien ne s'écoule", () => {
    expect(remainingMs(initialFeedback, 1_000)).toBe(0);
    expect(isExpired(initialFeedback, 1_000)).toBe(true);
    expect(pauseFeedback(initialFeedback, 1_000)).toBe(initialFeedback);
  });
});
