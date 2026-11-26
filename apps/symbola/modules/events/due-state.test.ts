// Lot 70a (UX-06, CHR-05, UX-01 ; M10, Q47-4 ; ADR 0118) — l'état d'échéance d'une tâche, un seul calcul
// pour tous les écrans, avec une horloge simulée : veille, jour même, lendemain, septième et huitième
// jour, seuil réglé, passage à l'heure d'été et à l'heure d'hiver (dates à Paris).
import { describe, expect, it } from "vitest";
import { dueStateAt, taskDueState, DEFAULT_SOON_DAYS } from "./due-state";

describe("UX-06, CHR-05 — État d'échéance d'une tâche (critère 6 du paquet 70a)", () => {
  const today = "2027-03-10";

  it("en retard avant aujourd'hui, avec le nombre de jours", () => {
    expect(taskDueState({ dueDate: "2027-03-09", done: false }, today)).toEqual({ kind: "late", days: 1 });
    expect(taskDueState({ dueDate: "2027-03-06", done: false }, today)).toEqual({ kind: "late", days: 4 });
  });

  it("aujourd'hui le jour même, demain le lendemain", () => {
    expect(taskDueState({ dueDate: today, done: false }, today)).toEqual({ kind: "today" });
    expect(taskDueState({ dueDate: "2027-03-11", done: false }, today)).toEqual({ kind: "tomorrow" });
  });

  it("bientôt jusqu'au septième jour par défaut, plus tard à partir du huitième", () => {
    expect(DEFAULT_SOON_DAYS).toBe(7);
    expect(taskDueState({ dueDate: "2027-03-12", done: false }, today)).toEqual({ kind: "soon", days: 2 });
    expect(taskDueState({ dueDate: "2027-03-17", done: false }, today)).toEqual({ kind: "soon", days: 7 });
    expect(taskDueState({ dueDate: "2027-03-18", done: false }, today)).toEqual({ kind: "later", days: 8 });
  });

  it("le seuil réglé par l'organisation déplace « Bientôt »", () => {
    expect(taskDueState({ dueDate: "2027-03-13", done: false }, today, 3)).toEqual({ kind: "soon", days: 3 });
    expect(taskDueState({ dueDate: "2027-03-14", done: false }, today, 3)).toEqual({ kind: "later", days: 4 });
    // Seuil d'un jour : demain reste « Demain », il n'y a plus de « Bientôt ».
    expect(taskDueState({ dueDate: "2027-03-12", done: false }, today, 1)).toEqual({ kind: "later", days: 2 });
  });

  it("une tâche faite n'a pas d'état d'échéance, même en retard", () => {
    expect(taskDueState({ dueDate: "2027-01-01", done: true }, today)).toBeNull();
  });

  it("refuse une date mal formée plutôt que de mentir", () => {
    expect(() => taskDueState({ dueDate: "10/03/2027", done: false }, today)).toThrow(RangeError);
    expect(() => taskDueState({ dueDate: today, done: false }, "2027-3-10")).toThrow(RangeError);
  });

  it("horloge simulée : la veille à 23 h 59 et le jour même à 0 h 01, à Paris", () => {
    const due = { dueDate: "2027-03-10", done: false };
    expect(dueStateAt(due, new Date("2027-03-09T22:59:00Z"))).toEqual({ kind: "tomorrow" });
    expect(dueStateAt(due, new Date("2027-03-09T23:01:00Z"))).toEqual({ kind: "today" });
    expect(dueStateAt(due, new Date("2027-03-10T23:01:00Z"))).toEqual({ kind: "late", days: 1 });
  });

  it("passage à l'heure d'été (28 mars 2027) : un jour reste un jour", () => {
    const due = { dueDate: "2027-03-28", done: false };
    // Samedi 27 à 23 h 30 (heure d'hiver, UTC+1) : demain.
    expect(dueStateAt(due, new Date("2027-03-27T22:30:00Z"))).toEqual({ kind: "tomorrow" });
    // Dimanche 28 à 0 h 30 (encore UTC+1) puis à 3 h 30 (UTC+2) : aujourd'hui.
    expect(dueStateAt(due, new Date("2027-03-27T23:30:00Z"))).toEqual({ kind: "today" });
    expect(dueStateAt(due, new Date("2027-03-28T01:30:00Z"))).toEqual({ kind: "today" });
    // Dimanche 28 à 23 h 30 (UTC+2) : toujours aujourd'hui ; lundi 29 à 0 h 30 : en retard d'un jour.
    expect(dueStateAt(due, new Date("2027-03-28T21:30:00Z"))).toEqual({ kind: "today" });
    expect(dueStateAt(due, new Date("2027-03-28T22:30:00Z"))).toEqual({ kind: "late", days: 1 });
    // Sept jours après la veille du changement d'heure : toujours « Bientôt », pas de jour perdu.
    expect(dueStateAt({ dueDate: "2027-04-03", done: false }, new Date("2027-03-27T12:00:00Z"))).toEqual({ kind: "soon", days: 7 });
  });

  it("passage à l'heure d'hiver (31 octobre 2027) : un jour reste un jour", () => {
    expect(dueStateAt({ dueDate: "2027-11-01", done: false }, new Date("2027-10-31T22:59:00Z"))).toEqual({ kind: "tomorrow" });
    expect(dueStateAt({ dueDate: "2027-11-01", done: false }, new Date("2027-10-31T23:01:00Z"))).toEqual({ kind: "today" });
  });
});
