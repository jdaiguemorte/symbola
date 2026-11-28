// Lot 72f (EVT-07, UX-01 ; spécification du lot 72, § 5.6) — les règles de la liste des évènements.
import { describe, expect, it } from "vitest";
import {
  countdown,
  daysUntil,
  matchesPhase,
  parsePhase,
  parsePlanner,
  parseSort,
  periodOf,
  sameDayCounts,
  sortEvents,
  sortHref,
  statusesFor,
  statusWord,
  taskCell,
} from "./events-list";

const event = (id: string, eventDate: string | null, status: "option" | "confirmed" | "closed" | "postponed" | "cancelled" = "confirmed", isDemo = false) => ({ id, eventDate, status, isDemo });

describe("EVT-07 — « 2 le même jour » dans la date (critère 3)", () => {
  it("deux évènements le même jour disent 2, trois disent 3 ; un évènement seul ne dit rien", () => {
    const counts = sameDayCounts([event("a", "2027-06-12"), event("b", "2027-06-12"), event("c", "2027-09-18"), event("d", "2027-09-18"), event("e", "2027-09-18"), event("f", "2027-05-08")]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(2);
    expect(counts.get("c")).toBe(3);
    expect(counts.get("f")).toBeUndefined();
  });

  it("comme la charge des mois : ni démonstration, ni annulé, ni clôturé, ni sans date", () => {
    const counts = sameDayCounts([event("a", "2027-06-12"), event("b", "2027-06-12", "cancelled"), event("c", "2027-06-12", "closed"), event("d", "2027-06-12", "confirmed", true), event("e", null), event("f", null)]);
    expect(counts.size).toBe(0);
  });

  it("une option et un signé le même jour comptent tous les deux", () => {
    const counts = sameDayCounts([event("a", "2027-06-12", "option"), event("b", "2027-06-12", "confirmed")]);
    expect(counts.get("a")).toBe(2);
  });
});

describe("EVT-07 — le compte à rebours de la date, en jours civils", () => {
  it("aujourd'hui, demain, dans N jours, hier, il y a N jours", () => {
    expect(countdown("2026-11-25", "2026-11-25")).toEqual({ key: "countdownToday", count: 0 });
    expect(countdown("2026-11-25", "2026-11-26")).toEqual({ key: "countdownTomorrow", count: 1 });
    expect(countdown("2026-11-25", "2027-01-03")).toEqual({ key: "countdownIn", count: 39 });
    expect(countdown("2026-11-25", "2026-11-24")).toEqual({ key: "countdownYesterday", count: 1 });
    expect(countdown("2026-11-25", "2026-11-01")).toEqual({ key: "countdownAgo", count: 24 });
  });

  it("le passage à l'heure d'été ni d'hiver ne décale le compte (veille, jour même, lendemain)", () => {
    // Heure d'été en France : dimanche 28 mars 2027 ; heure d'hiver : dimanche 31 octobre 2027.
    expect(daysUntil("2027-03-27", "2027-03-28")).toBe(1);
    expect(daysUntil("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysUntil("2027-03-28", "2027-03-28")).toBe(0);
    expect(daysUntil("2027-10-30", "2027-11-01")).toBe(2);
    expect(daysUntil("2026-11-25", "2027-06-12")).toBe(199);
  });
});

describe("EVT-07, UX-01 — la colonne « Tâches faites » (C-14, E7)", () => {
  it("une demande sans tâche dit « Demande : pas de tâches », un signé sans tâche « Pas encore de tâches »", () => {
    expect(taskCell("option", { done: 0, total: 0, late: 0 })).toEqual({ kind: "request" });
    expect(taskCell("confirmed", undefined)).toEqual({ kind: "none" });
    expect(taskCell("postponed", { done: 0, total: 0, late: 0 })).toEqual({ kind: "none" });
  });

  it("des tâches : faites sur total, et les retards", () => {
    expect(taskCell("confirmed", { done: 14, total: 20, late: 2 })).toEqual({ kind: "progress", done: 14, total: 20, late: 2 });
    expect(taskCell("option", { done: 0, total: 3, late: 0 })).toEqual({ kind: "progress", done: 0, total: 3, late: 0 });
  });
});

describe("EVT-05, EVT-07 — le statut dit avec les mots de la frise", () => {
  it("les quatre étapes, puis Reporté et Annulé", () => {
    expect(statusWord("option")).toEqual({ from: "frise", key: "timeline.request" });
    expect(statusWord("confirmed")).toEqual({ from: "frise", key: "timeline.signed" });
    expect(statusWord("day_of")).toEqual({ from: "frise", key: "timeline.day_of" });
    expect(statusWord("closed")).toEqual({ from: "frise", key: "timeline.closed" });
    expect(statusWord("postponed")).toEqual({ from: "liste", key: "statusPostponed" });
    expect(statusWord("cancelled")).toEqual({ from: "liste", key: "statusCancelled" });
  });

  it("le filtre « Statut » suit la période ; un statut inconnu ou d'une autre période est ignoré", () => {
    expect(parsePhase("day_of", "upcoming")).toBe("day_of");
    expect(parsePhase("closed", "upcoming")).toBeUndefined();
    expect(parsePhase("cancelled", "past")).toBe("cancelled");
    expect(parsePhase("in_preparation", "upcoming")).toBeUndefined();
    expect(parsePhase("'; drop table", "archived")).toBeUndefined();
    expect(periodOf("termines")).toBe("past");
    expect(periodOf("archives")).toBe("archived");
    expect(periodOf("n'importe")).toBe("upcoming");
  });

  it("« Jour J » se demande comme un signé, puis se trie sur la phase", () => {
    expect(statusesFor("upcoming", "day_of")).toEqual(["confirmed"]);
    expect(statusesFor("upcoming", undefined)).toEqual(["option", "confirmed", "postponed"]);
    expect(statusesFor("past", undefined)).toEqual(["closed", "cancelled"]);
    expect(statusesFor("archived", undefined)).toBeUndefined();
    expect(matchesPhase({ phase: "confirmed" }, "day_of")).toBe(false);
    expect(matchesPhase({ phase: "day_of" }, "day_of")).toBe(true);
    expect(matchesPhase({ phase: "day_of" }, undefined)).toBe(true);
  });
});

describe("EVT-07, UX-13 — le tri par en-tête de colonne (procédé du carnet, lot 73b)", () => {
  const rows = [
    { id: "1", name: "Léa & Maxime", eventDate: "2027-06-12", phase: "confirmed" as const, taskProgress: { done: 14, total: 20, late: 2 } },
    { id: "2", name: "Baptême de Gabin", eventDate: "2027-01-03", phase: "confirmed" as const, taskProgress: { done: 9, total: 12, late: 0 } },
    { id: "3", name: "Inès & Paul", eventDate: "2027-09-18", phase: "option" as const, taskProgress: { done: 0, total: 0, late: 0 } },
    { id: "4", name: "Chloé & Samuel", eventDate: null, phase: "postponed" as const, taskProgress: { done: 4, total: 38, late: 0 } },
  ];
  const names = (sorted: typeof rows) => sorted.map((row) => row.name);
  const nameOf = (row: (typeof rows)[number]) => row.name;

  it("par défaut, par date, les dates à définir en dernier", () => {
    expect(names(sortEvents(rows, parseSort(undefined, undefined), nameOf, "fr"))).toEqual(["Baptême de Gabin", "Léa & Maxime", "Inès & Paul", "Chloé & Samuel"]);
  });

  it("par nom, par statut (ordre de la frise), par tâches faites (retards d'abord, sans tâche en dernier)", () => {
    expect(names(sortEvents(rows, parseSort("evenement", undefined), nameOf, "fr"))).toEqual(["Baptême de Gabin", "Chloé & Samuel", "Inès & Paul", "Léa & Maxime"]);
    expect(names(sortEvents(rows, parseSort("statut", undefined), nameOf, "fr"))).toEqual(["Inès & Paul", "Baptême de Gabin", "Léa & Maxime", "Chloé & Samuel"]);
    expect(names(sortEvents(rows, parseSort("taches", undefined), nameOf, "fr"))).toEqual(["Léa & Maxime", "Chloé & Samuel", "Baptême de Gabin", "Inès & Paul"]);
  });

  it("un second clic inverse ; un tri ou un sens inconnu est ignoré, sans erreur", () => {
    expect(names(sortEvents(rows, parseSort("evenement", "desc"), nameOf, "fr"))[0]).toBe("Léa & Maxime");
    expect(parseSort("prix", "haut")).toEqual({ key: "date", direction: "asc", natural: true });
    expect(parseSort("date", "desc")).toEqual({ key: "date", direction: "desc", natural: false });
  });

  it("l'adresse d'un en-tête garde les filtres et la période, repart des premières lignes", () => {
    const current = parseSort(undefined, undefined);
    expect(sortHref("/events", { tab: "termines", search: "Léa", tout: "1", tri: undefined }, current, "evenement")).toBe("/events?tab=termines&search=L%C3%A9a&tri=evenement");
    expect(sortHref("/events", {}, current, "date")).toBe("/events?sens=desc");
    expect(sortHref("/events", { tri: "date", sens: "desc" }, parseSort("date", "desc"), "date")).toBe("/events");
  });
});

describe("EVT-06, PAR-10 — le filtre « Planner principal » d'une agence", () => {
  it("seule une planner principale d'un évènement visible est retenue ; un inconnu est ignoré", () => {
    const leads = new Set(["u1", "u2"]);
    expect(parsePlanner("u1", leads)).toBe("u1");
    expect(parsePlanner("u-autre-organisation", leads)).toBeUndefined();
    expect(parsePlanner(undefined, leads)).toBeUndefined();
  });
});
