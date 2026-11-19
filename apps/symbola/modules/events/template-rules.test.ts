import { describe, expect, it } from "vitest";
import { cleanTemplateName, dueDateFor, eventTemplateContentSchema, findTemplatePersonalData, type EventTemplateContent } from "./template-rules";

const content: EventTemplateContent = {
  version: 1,
  tasks: [{ label: "Réserver le lieu", offsetDays: -300, responsible: "planner", isMilestone: true }],
  program: [{ startTime: "15:00", endTime: "16:00", label: "Cérémonie laïque", location: null }],
  slots: [{ label: "Traiteur", icon: null, notRequired: false, lines: [{ label: "Menu" }] }],
  questionnaires: [],
  vendors: [],
};

describe("EVT-08 — Duplication et modèle d'évènement (lot 58)", () => {
  it("un modèle de structures seulement passe le contrôle", () => {
    expect(eventTemplateContentSchema.parse(content)).toEqual(content);
    expect(findTemplatePersonalData("Mariage champêtre", content, [{ firstName: "Léa", lastName: "Martin" }])).toEqual([]);
  });

  it("D5 : le contrôle refuse un e-mail, un téléphone ou le nom d'un client dans un texte copié, et dit où il se trouve", () => {
    const withData: EventTemplateContent = {
      ...content,
      tasks: [...content.tasks, { label: "Rappeler Léa au 06 12 34 56 78", offsetDays: -10, responsible: "planner", isMilestone: false }],
      program: [{ ...content.program[0]!, location: "Écrire à lea.martin@example.test" }],
      slots: [{ ...content.slots[0]!, lines: [{ label: "Gâteau des Martin" }] }],
    };
    expect(findTemplatePersonalData("Mariage champêtre", withData, [{ firstName: "Léa", lastName: "Martin" }])).toEqual([
      { place: "task", label: "Rappeler Léa au 06 12 34 56 78", kind: "phone" },
      { place: "task", label: "Rappeler Léa au 06 12 34 56 78", kind: "client_name" },
      { place: "program", label: "Cérémonie laïque", kind: "email" },
      { place: "program", label: "Cérémonie laïque", kind: "client_name" },
      { place: "budget_line", label: "Gâteau des Martin", kind: "client_name" },
    ]);
    expect(findTemplatePersonalData("Mariage Martin", content, [{ firstName: "Léa", lastName: "Martin" }])).toEqual([{ place: "name", label: "Mariage Martin", kind: "client_name" }]);
  });

  it("les dates se recalculent depuis la nouvelle date (passage à l'heure d'été et année bissextile compris) ; sans date, l'échéance attend", () => {
    expect(dueDateFor("2028-03-26", -1)).toBe("2028-03-25");
    expect(dueDateFor("2028-03-01", -1)).toBe("2028-02-29");
    expect(dueDateFor("2028-06-17", 0)).toBe("2028-06-17");
    expect(dueDateFor(null, -30)).toBeNull();
    expect(dueDateFor("2028-06-17", null)).toBeNull();
  });

  it("le nom d'un modèle est requis et limité", () => {
    expect(cleanTemplateName("  Mariage   champêtre ")).toBe("Mariage champêtre");
    expect(() => cleanTemplateName(" ")).toThrow();
  });
});
