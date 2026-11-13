// Lot 32a (HUB-08, UX-01, UX-06, EVT-02 ; décisions D2 et D4) — tri des urgences, sans base : quatre
// groupes (en retard, aujourd'hui, attend un tiers, à venir), « À traiter en premier », horizon de
// quatorze jours, qui doit agir ; compte à rebours avant le jour J.
import { describe, expect, it } from "vitest";
import { daysUntil, nextActionFor, rankToday, type TodayItem } from "./rank";

const TODAY = "2027-04-05";

function item(key: string, overrides: Partial<TodayItem> = {}): TodayItem {
  return { key, kind: "task", eventId: "e1", eventNames: "Léa & Maxime", title: key, dueOn: null, since: null, actor: { kind: "you" }, href: `/x/${key}`, ...overrides };
}

describe("HUB-08 / UX-01 — Urgences triées, tous évènements confondus (lot 32a, D2)", () => {
  it("quatre groupes dans l'ordre : en retard (le plus en retard d'abord), aujourd'hui, attend un tiers (le plus ancien d'abord), à venir (par date)", () => {
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
    expect(ranked.groups.overdue.map((entry) => entry.key)).toEqual(["retard-5j", "retard-2j"]);
    expect(ranked.groups.today.map((entry) => entry.key)).toEqual(["aujourd-hui"]);
    expect(ranked.groups.waiting.map((entry) => entry.key)).toEqual(["attente-ancienne", "attente-récente"]);
    expect(ranked.groups.upcoming.map((entry) => entry.key)).toEqual(["à-venir-proche", "à-venir-loin"]);
    expect(ranked.groups.overdue[0]).toMatchObject({ group: "overdue", daysLate: 5 });
  });

  it("« À traiter en premier » : les trois premiers, tous groupes confondus", () => {
    const ranked = rankToday(
      [item("attente", { actor: { kind: "client" }, since: "2027-03-30" }), item("à-venir", { dueOn: "2027-04-07" }), item("retard", { dueOn: "2027-04-02" }), item("autre-attente", { actor: { kind: "client" }, dueOn: "2027-04-09" })],
      TODAY,
    );
    expect(ranked.first.map((entry) => entry.key)).toEqual(["retard", "attente", "autre-attente"]);
  });

  it("au-delà de quatorze jours, une échéance n'apparaît pas ; une attente sans date reste", () => {
    const ranked = rankToday(
      [item("j+14", { dueOn: "2027-04-19" }), item("j+15", { dueOn: "2027-04-20" }), item("tiers-j+15", { actor: { kind: "client" }, dueOn: "2027-04-20" }), item("attente", { actor: { kind: "vendor", name: "Studio Lumière" } })],
      TODAY,
    );
    expect(ranked.all.map((entry) => entry.key)).toEqual(["attente", "j+14"]);
  });

  it("ce qui vous revient sans date est à faire aujourd'hui ; l'échéance d'un tiers à venir est une attente (UX-06, D4)", () => {
    const ranked = rankToday([item("à-confirmer", { since: "2027-04-01" }), item("paiement-client", { actor: { kind: "client" }, dueOn: "2027-04-09" })], TODAY);
    expect(ranked.groups.today.map((entry) => entry.key)).toEqual(["à-confirmer"]);
    expect(ranked.groups.waiting.map((entry) => entry.key)).toEqual(["paiement-client"]);
  });

  it("le nombre de points qui demandent attention : en retard, aujourd'hui et attentes, pas l'à-venir", () => {
    const ranked = rankToday([item("r", { dueOn: "2027-04-01" }), item("a", { dueOn: TODAY }), item("w", { actor: { kind: "client" } }), item("u", { dueOn: "2027-04-10" })], TODAY);
    expect(ranked.attentionCount).toBe(3);
    expect(ranked.attentionByEvent.get("e1")).toBe(3);
  });

  it("veille, jour même et lendemain : la veille est en retard d'un jour, le lendemain à venir", () => {
    const ranked = rankToday([item("veille", { dueOn: "2027-04-04" }), item("jour", { dueOn: TODAY }), item("lendemain", { dueOn: "2027-04-06" })], TODAY);
    expect(ranked.all.map((entry) => [entry.key, entry.group])).toEqual([
      ["veille", "overdue"],
      ["jour", "today"],
      ["lendemain", "upcoming"],
    ]);
    expect(ranked.all[0]).toMatchObject({ daysLate: 1 });
  });

  it("la prochaine action d'un évènement est son premier élément", () => {
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
