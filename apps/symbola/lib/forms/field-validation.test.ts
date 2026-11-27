// Lot 70b (UX-10, NFR-16, HUB-19 ; P-18, C-04) — la validation écrite par Symbola : les mêmes schémas
// Zod côté écran et côté serveur, un message par champ (clé de traduction), dans l'ordre du formulaire.
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import en from "@symbola/i18n/messages/en.json";
import { fieldErrors, formValues } from "./field-validation";
import { taskFieldsSchema } from "./task-fields";
import { newEventFieldsSchema } from "./new-event-fields";
import { postponeFieldsSchema } from "./postpone-fields";

describe("UX-10 — Erreurs de saisie écrites par Symbola (lot 70b)", () => {
  it("une tâche envoyée vide donne deux erreurs, nom puis échéance, chacune avec sa phrase", () => {
    const errors = fieldErrors(taskFieldsSchema, { label: "  ", dueDate: "" });
    expect(errors).toEqual([
      { field: "label", key: "taskLabelRequired" },
      { field: "dueDate", key: "dueDateRequired" },
    ]);
  });

  it("une date mal écrite est dite au format jj/mm/aaaa", () => {
    expect(fieldErrors(taskFieldsSchema, { label: "Réserver la navette", dueDate: "2027-13-45" })).toEqual([{ field: "dueDate", key: "dateInvalid" }]);
    expect(fieldErrors(taskFieldsSchema, { label: "Réserver la navette", dueDate: "12/06/2027" })).toEqual([{ field: "dueDate", key: "dateInvalid" }]);
  });

  it("une tâche bien remplie passe, et le nom est trop long au-delà de 300 caractères", () => {
    expect(fieldErrors(taskFieldsSchema, { label: "Réserver la navette", dueDate: "2027-06-12" })).toEqual([]);
    expect(fieldErrors(taskFieldsSchema, { label: "x".repeat(301), dueDate: "2027-06-12" })).toEqual([{ field: "label", key: "taskLabelTooLong" }]);
  });

  it("Nouvel évènement : sans réponse à « Où en est-il ? » ni nom, les deux erreurs sont dites, dans l'ordre (lot 70e)", () => {
    expect(fieldErrors(newEventFieldsSchema, { standing: "", name: "  " })).toEqual([
      { field: "standing", key: "standingRequired" },
      { field: "name", key: "eventNameRequired" },
    ]);
    expect(fieldErrors(newEventFieldsSchema, { standing: "signed", name: "Léa & Maxime" })).toEqual([]);
    expect(fieldErrors(newEventFieldsSchema, { standing: "import", name: "Léa & Maxime" })).toEqual([{ field: "standing", key: "standingRequired" }]);
  });

  it("Changer la date : une date est demandée", () => {
    expect(fieldErrors(postponeFieldsSchema, { dueDate: "" })).toEqual([{ field: "dueDate", key: "dueDateRequired" }]);
    expect(fieldErrors(postponeFieldsSchema, { dueDate: "2027-06-12" })).toEqual([]);
  });

  it("les valeurs d'un formulaire sont lues en texte, les fichiers ignorés", () => {
    const data = new FormData();
    data.set("label", "Réserver");
    data.set("dueDate", "2027-06-12");
    expect(formValues(data)).toEqual({ label: "Réserver", dueDate: "2027-06-12" });
  });

  it("chaque message existe en français et en anglais (C1)", () => {
    const keys = ["taskLabelRequired", "taskLabelTooLong", "dueDateRequired", "dateInvalid", "standingRequired", "eventNameRequired", "summary", "summaryLink", "errorPrefix"];
    for (const key of keys) {
      expect((fr as { Validation: Record<string, string> }).Validation[key], `fr ${key}`).toBeTruthy();
      expect((en as { Validation: Record<string, string> }).Validation[key], `en ${key}`).toBeTruthy();
    }
    expect((fr as { Validation: Record<string, string> }).Validation.taskLabelRequired).toBe("Donnez un nom à la tâche, par exemple « Réserver la navette ».");
  });
});
