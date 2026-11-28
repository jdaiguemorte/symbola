import { describe, expect, it } from "vitest";
import { changedDetails, dateEditable, DETAILS_RUBRICS, firstErrorRubric, parseEventDetails, rubricOf } from "./event-details";

const raw = {
  eventDate: "2027-06-12",
  timeZone: "Europe/Paris",
  venueName: "Manoir des Aulnes",
  venueCity: "Poitiers",
  busyMode: "type",
  startDayOffset: "-1",
  startTime: "09:00",
  endDayOffset: "1",
  endTime: "18:00",
  guestsEstimated: "120",
  guestsConfirmed: "",
  wantedBudget: "40 000,00",
  style: "Champêtre",
  notes: "Maxime est allergique aux fruits à coque.",
  notesConfidential: "",
  eventTypeId: "6f1c2d3e-4b5a-4c6d-8e7f-901234567890",
  prospectSourceId: "",
};

const context = { dateEditable: true, notesReadable: true };

describe("EVT-03 — « Modifier les informations » : cinq rubriques, un seul « Enregistrer » (lot 72e, critère 4)", () => {
  it("cinq rubriques, dans l'ordre de la maquette 16", () => {
    expect(DETAILS_RUBRICS).toEqual(["dates", "clients", "guests", "style", "origin"]);
  });
  it("chaque champ appartient à sa rubrique (une erreur mène au champ)", () => {
    expect(rubricOf("eventDate")).toBe("dates");
    expect(rubricOf("endTime")).toBe("dates");
    expect(rubricOf("wantedBudget")).toBe("guests");
    expect(rubricOf("notes")).toBe("style");
    expect(rubricOf("prospectSourceId")).toBe("origin");
  });
  it("lit toutes les rubriques d'un coup : montants en centimes, nombres, textes nettoyés, vides à null", () => {
    const parsed = parseEventDetails(raw, context);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.values).toEqual({
      eventDate: "2027-06-12",
      timeZone: "Europe/Paris",
      venueName: "Manoir des Aulnes",
      venueCity: "Poitiers",
      busyRule: null,
      guestsEstimated: 120,
      guestsConfirmed: null,
      wantedBudgetCents: 4_000_000,
      style: "Champêtre",
      notes: { text: "Maxime est allergique aux fruits à coque.", confidential: false },
      eventTypeId: "6f1c2d3e-4b5a-4c6d-8e7f-901234567890",
      prospectSourceId: null,
    });
  });
  it("l'agenda réglé pour l'évènement porte sa règle ; « selon le type » n'en porte aucune", () => {
    const parsed = parseEventDetails({ ...raw, busyMode: "event" }, context);
    expect(parsed.ok && parsed.values.busyRule).toEqual({ startDayOffset: -1, startTime: "09:00", endDayOffset: 1, endTime: "18:00" });
  });
  it("une erreur dans une rubrique n'enregistre rien et nomme le champ ; la première rubrique en erreur s'ouvre", () => {
    const parsed = parseEventDetails({ ...raw, guestsEstimated: "cent vingt", wantedBudget: "-3", busyMode: "event", endTime: "25:00" }, context);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual({ guestsEstimated: "count", wantedBudget: "amount", endTime: "time" });
    expect(firstErrorRubric(parsed.errors)).toBe("dates");
  });
  it("la date d'un évènement signé ne s'y modifie pas : le champ envoyé est ignoré", () => {
    const parsed = parseEventDetails({ ...raw, eventDate: "2028-01-01" }, { ...context, dateEditable: false });
    expect(parsed.ok && parsed.values.eventDate).toBeUndefined();
  });
  it("une date mal formée est refusée ; vide, elle reste « à définir »", () => {
    const bad = parseEventDetails({ ...raw, eventDate: "12/06/2027" }, context);
    expect(bad.ok ? null : bad.errors).toEqual({ eventDate: "date" });
    const empty = parseEventDetails({ ...raw, eventDate: "" }, context);
    expect(empty.ok && empty.values.eventDate).toBeNull();
  });
  it("des notes que la personne ne peut pas lire ne sont ni lues ni réécrites", () => {
    const parsed = parseEventDetails({ ...raw, notes: "écrasé" }, { ...context, notesReadable: false });
    expect(parsed.ok && parsed.values.notes).toBeUndefined();
  });
  it("des notes cochées confidentielles le restent ; un texte trop long est refusé", () => {
    const sealed = parseEventDetails({ ...raw, notesConfidential: "on" }, context);
    expect(sealed.ok && sealed.values.notes).toEqual({ text: "Maxime est allergique aux fruits à coque.", confidential: true });
    const long = parseEventDetails({ ...raw, style: "x".repeat(2001) }, context);
    expect(long.ok ? null : long.errors).toEqual({ style: "tooLong" });
  });
  it("un fuseau inconnu ou un type absent sont refusés sous leur champ", () => {
    const parsed = parseEventDetails({ ...raw, timeZone: "Mars/Olympus", eventTypeId: "" }, context);
    expect(parsed.ok ? null : parsed.errors).toEqual({ timeZone: "timeZone", eventTypeId: "required" });
  });
});

describe("UX-09 — « Fermer » avec des changements demande « Fermer sans enregistrer ? » (lot 72e, critère 5)", () => {
  it("aucun changement : rien à dire", () => {
    expect(changedDetails(raw, { ...raw })).toEqual([]);
  });
  it("les rubriques changées, dans leur ordre (pour la question de la fenêtre)", () => {
    expect(changedDetails(raw, { ...raw, style: "Bohème", venueCity: "Niort" })).toEqual(["dates", "style"]);
  });
  it("un espace ajouté au bout d'un champ n'est pas un changement", () => {
    expect(changedDetails(raw, { ...raw, style: "Champêtre " })).toEqual([]);
  });
});

describe("EVT-05 — La date se change ici pour une demande, un report ou un évènement sans date ; sinon on reporte", () => {
  it("demande, report, ou date encore à fixer : champ modifiable", () => {
    expect(dateEditable({ status: "option", eventDate: "2027-06-12", archived: false })).toBe(true);
    expect(dateEditable({ status: "postponed", eventDate: null, archived: false })).toBe(true);
    expect(dateEditable({ status: "confirmed", eventDate: null, archived: false })).toBe(true);
  });
  it("signé avec une date, clôturé, annulé ou archivé : en lecture", () => {
    expect(dateEditable({ status: "confirmed", eventDate: "2027-06-12", archived: false })).toBe(false);
    expect(dateEditable({ status: "closed", eventDate: "2027-06-12", archived: false })).toBe(false);
    expect(dateEditable({ status: "cancelled", eventDate: null, archived: false })).toBe(false);
    expect(dateEditable({ status: "option", eventDate: null, archived: true })).toBe(false);
  });
});
