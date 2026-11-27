import { describe, expect, it } from "vitest";
import { EVENT_STANDINGS, parseStanding, statusForStanding } from "./new-event-standing";

describe("EVT-01, EVT-05 — « Nouvel évènement » : où en est-il ? (lot 70e, D8, M13, A10)", () => {
  it("deux réponses seulement : une demande en cours, signé en préparation", () => {
    expect(EVENT_STANDINGS).toEqual(["enquiry", "signed"]);
  });

  it("le statut créé suit la réponse : Option pour une demande, Confirmé pour un évènement signé", () => {
    expect(statusForStanding("enquiry")).toBe("option");
    expect(statusForStanding("signed")).toBe("confirmed");
  });

  it("aucune réponse n'est choisie d'avance : une valeur vide ou inconnue ne donne rien", () => {
    expect(parseStanding("")).toBeNull();
    expect(parseStanding(undefined)).toBeNull();
    expect(parseStanding("import")).toBeNull();
    expect(parseStanding("enquiry")).toBe("enquiry");
    expect(parseStanding("signed")).toBe("signed");
  });
});
