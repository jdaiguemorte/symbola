// Lot 32a, réécrit au lot 72a (HUB-08, UX-01, UX-06, EVT-02 ; décisions A1 et A2 de la note 09 du lot 68)
// — tri des urgences, sans base : les retards d'abord (le plus ancien en tête), puis tout le reste par
// date, quel que soit qui agit ; un point est une ligne ; horizon de quatorze jours, à l'horloge simulée
// (veille, jour même, lendemain, quatorzième et quinzième jour, passage à l'heure d'été).
import { describe, expect, it } from "vitest";
import { daysUntil, nextActionFor, rankToday, type TodayItem } from "./rank";

const TODAY = "2027-04-05";

function item(key: string, overrides: Partial<TodayItem> = {}): TodayItem {
  return { key, kind: "task", eventId: "e1", eventNames: "Léa & Maxime", title: key, dueOn: null, since: null, actor: { kind: "you" }, href: `/x/${key}`, ...overrides };
}

const keys = (entries: { key: string }[]) => entries.map((entry) => entry.key);

describe("HUB-08 — Les retards d'abord, puis tout le reste par date (lot 72a, A2, critère 3)", () => {
  it("les retards du plus ancien au plus récent, puis le reste par date, quel que soit qui agit", () => {
    const ranked = rankToday(
      [
        item("à-venir-loin", { dueOn: "2027-04-15" }),
        item("retard-2j", { dueOn: "2027-04-03" }),
        item("aujourd-hui", { dueOn: TODAY }),
        item("attente-récente", { actor: { kind: "client" }, since: "2027-04-04" }),
        item("retard-5j", { dueOn: "2027-03-31", actor: { kind: "vendor", name: "Studio Lumière" } }),
        item("à-venir-proche", { dueOn: "2027-04-06" }),
        item("attente-ancienne", { actor: { kind: "client" }, since: "2027-03-30" }),
      ],
      TODAY,
    );
    expect(keys(ranked.all)).toEqual(["retard-5j", "retard-2j", "attente-ancienne", "attente-récente", "aujourd-hui", "à-venir-proche", "à-venir-loin"]);
    expect(ranked.all[0]).toMatchObject({ group: "overdue", daysLate: 5 });
  });

  it("« Valider le faire-part » (3 déc., attend les mariés) vient après « Rappeler la mère de la mariée » (26 nov., vous)", () => {
    const ranked = rankToday([item("Valider le faire-part", { kind: "client_task", actor: { kind: "client" }, dueOn: "2026-12-03" }), item("Rappeler la mère de la mariée", { dueOn: "2026-11-26" })], "2026-11-25");
    expect(keys(ranked.all)).toEqual(["Rappeler la mère de la mariée", "Valider le faire-part"]);
  });

  it("une attente sans échéance se range à sa date de début ; une ligne sans date (une alerte du radar) au jour même", () => {
    const ranked = rankToday([item("demain", { dueOn: "2027-04-06" }), item("alerte", { kind: "watch" }), item("attente", { actor: { kind: "client" }, since: "2027-04-07" }), item("hier-commencée", { actor: { kind: "client" }, since: "2027-04-04" })], TODAY);
    expect(keys(ranked.all)).toEqual(["hier-commencée", "alerte", "demain", "attente"]);
  });

  it("veille, jour même, lendemain, quatorzième et quinzième jour : la veille en retard, le quinzième hors de l'horizon", () => {
    const ranked = rankToday([item("j+15", { dueOn: "2027-04-20" }), item("j+14", { dueOn: "2027-04-19" }), item("lendemain", { dueOn: "2027-04-06" }), item("jour", { dueOn: TODAY }), item("veille", { dueOn: "2027-04-04" })], TODAY);
    expect(keys(ranked.all)).toEqual(["veille", "jour", "lendemain", "j+14"]);
    expect(ranked.all.map((entry) => entry.group)).toEqual(["overdue", "today", "upcoming", "upcoming"]);
    expect(ranked.all[0]).toMatchObject({ daysLate: 1 });
  });

  it("passage à l'heure d'été (nuit du 27 au 28 mars 2027) : les jours se comptent en jours calendaires", () => {
    const ranked = rankToday([item("j+14", { dueOn: "2027-04-10" }), item("j+15", { dueOn: "2027-04-11" }), item("veille", { dueOn: "2027-03-26" })], "2027-03-27");
    expect(keys(ranked.all)).toEqual(["veille", "j+14"]);
  });
});

describe("HUB-08, UX-01 — Un point est une ligne (lot 72a, A1, critères 1 et 2)", () => {
  it("points = toutes les lignes de l'horizon ; « dont N en retard » compte les retards de toutes natures", () => {
    const ranked = rankToday(
      [
        item("tâche-retard", { dueOn: "2027-04-01" }),
        item("paiement-retard", { kind: "client_payment", actor: { kind: "client" }, dueOn: "2027-04-02", eventId: "e2" }),
        item("aujourd-hui", { dueOn: TODAY }),
        item("attente", { actor: { kind: "client" } }),
        item("à-venir", { dueOn: "2027-04-10" }),
        item("hors-évènement", { eventId: null, dueOn: "2027-04-08" }),
        item("trop-loin", { dueOn: "2027-05-30" }),
      ],
      TODAY,
    );
    expect(ranked.points).toBe(6);
    expect(ranked.late).toBe(2);
    expect(ranked.pointsByEvent.get("e1")).toBe(4);
    expect(ranked.lateByEvent.get("e1")).toBe(1);
    expect(ranked.pointsByEvent.get("e2")).toBe(1);
    expect(ranked.lateByEvent.get("e2")).toBe(1);
    // « Mes évènements » répartit le même total (la ligne hors évènement à part).
    expect([...ranked.pointsByEvent.values()].reduce((sum, count) => sum + count, 0) + 1).toBe(ranked.points);
  });

  it("la prochaine action d'un évènement est sa première ligne", () => {
    const ranked = rankToday([item("autre", { eventId: "e2", dueOn: "2027-04-01" }), item("mien-à-venir", { dueOn: "2027-04-08" }), item("mien-attente", { actor: { kind: "client" }, since: "2027-04-02" })], TODAY);
    expect(nextActionFor(ranked, "e1")?.key).toBe("mien-attente");
    expect(nextActionFor(ranked, "e3")).toBeNull();
  });
});

describe("EVT-02 — Compte à rebours avant le jour J (lot 32a)", () => {
  it("en jours calendaires de Paris, la veille, le jour même et après ; le passage à l'heure d'été ne change rien", () => {
    expect(daysUntil("2027-06-12", TODAY)).toBe(68);
    expect(daysUntil("2027-04-06", TODAY)).toBe(1);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil("2027-04-01", TODAY)).toBe(-4);
    // Nuit du 27 au 28 mars 2027 : passage à l'heure d'été.
    expect(daysUntil("2027-03-29", "2027-03-27")).toBe(2);
  });
});
