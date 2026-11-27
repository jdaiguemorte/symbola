import { describe, expect, it } from "vitest";
import { changedFields, closeDecision, copyDraft, createDraft, draftOf, dueFromDaysBefore, daysBeforeEvent, repetitionOffered, type TaskDraft } from "./task-panel-model";

const EVENT = "00000000-0000-4000-8000-0000000000e1";

const existing: TaskDraft = {
  label: "Choisir le fleuriste",
  eventId: EVENT,
  dueDate: "2026-11-29",
  responsible: "clients",
  categoryId: "",
  note: "",
  priority: "normal",
  recurrence: "",
};

describe("CHR-02, UX-09 — Le panneau d'une tâche : enregistrer, fermer (lot 70c, M1)", () => {
  it("sans changement, « Fermer » ferme tout de suite", () => {
    expect(changedFields(existing, { ...existing })).toEqual([]);
    expect(closeDecision(existing, { ...existing })).toBe("close");
  });

  it("avec des changements, « Fermer » demande « Fermer sans enregistrer ? » et nomme les champs changés", () => {
    const current = { ...existing, note: "Trois devis demandés", dueDate: "2026-11-30" };
    expect(changedFields(existing, current)).toEqual(["dueDate", "note"]);
    expect(closeDecision(existing, current)).toBe("confirm");
  });

  it("des espaces ajoutés autour du titre ne comptent pas comme un changement", () => {
    expect(changedFields(existing, { ...existing, label: "  Choisir le fleuriste " })).toEqual([]);
  });

  it("lit la tâche existante (personne, catégorie, note, priorité, répétition)", () => {
    expect(
      draftOf({ label: "TVA", eventId: null, dueDate: "2026-12-01", responsibleValue: "member:x", categoryId: null, note: null, priority: "high", recurrence: "quarterly" }),
    ).toEqual({ label: "TVA", eventId: "", dueDate: "2026-12-01", responsible: "member:x", categoryId: "", note: "", priority: "high", recurrence: "quarterly" });
  });
});

describe("CHR-02, CHR-10 — Nouvelle tâche, avec ou sans évènement (lot 70c)", () => {
  it("sans évènement choisi, la répétition est proposée ; avec un évènement, non", () => {
    expect(repetitionOffered(createDraft({ eventId: null, responsible: "member:me" }))).toBe(true);
    expect(repetitionOffered(createDraft({ eventId: EVENT, responsible: "member:me" }))).toBe(false);
  });

  it("depuis la fiche, l'évènement est déjà choisi ; la tâche est à qui la crée (A3)", () => {
    const draft = createDraft({ eventId: EVENT, responsible: "member:me" });
    expect(draft.eventId).toBe(EVENT);
    expect(draft.responsible).toBe("member:me");
    expect(draft.dueDate).toBe("");
  });

  it("une tâche créée vide de changements se ferme sans question", () => {
    const draft = createDraft({ eventId: EVENT, responsible: "member:me" });
    expect(closeDecision(draft, { ...draft })).toBe("close");
    expect(closeDecision(draft, { ...draft, label: "Réserver la navette" })).toBe("confirm");
  });

  it("« Dupliquer la tâche » copie titre, évènement, personne, catégorie, note ; échéance vide (A22)", () => {
    expect(copyDraft({ ...existing, categoryId: "c1", note: "n", priority: "high", recurrence: "" })).toEqual({ ...existing, categoryId: "c1", note: "n", dueDate: "", priority: "normal", recurrence: "" });
  });

  it("« {n} jours avant le jour J » donne la date, et inversement (A8)", () => {
    expect(dueFromDaysBefore("2027-06-12", 195)).toBe("2026-11-29");
    expect(dueFromDaysBefore("2027-06-12", 0)).toBe("2027-06-12");
    expect(daysBeforeEvent("2027-06-12", "2026-11-29")).toBe(195);
    expect(daysBeforeEvent("2027-06-12", "2027-06-20")).toBe(-8);
  });
});
