// Lot 43 (BUD-11 ; D9) — calendrier des sorties d'argent : mois par mois, échéances de la planner et
// des prestataires, filtrées par payeur.
import { describe, expect, it } from "vitest";
import { buildCashCalendar, type CashEntry } from "./cash-calendar";

const entries: CashEntry[] = [
  { id: "p1", source: "planner", label: "Acompte", counterpart: "Atelier Camille R.", amountCents: 162000, dueOn: "2027-01-20", payerId: "couple", status: "upcoming" },
  { id: "v1", source: "vendor", label: "Acompte traiteur", counterpart: "Traiteur Dupont", amountCents: 288000, dueOn: "2027-01-05", payerId: "famille-lea", status: "declared" },
  { id: "v2", source: "vendor", label: "Solde fleurs", counterpart: "Fleurs & Co", amountCents: 90000, dueOn: "2027-05-30", payerId: "couple", status: "upcoming" },
  { id: "p2", source: "planner", label: "Solde", counterpart: "Atelier Camille R.", amountCents: 378000, dueOn: "2027-05-12", payerId: "couple", status: "paid" },
];

describe("BUD-11 — Calendrier des sorties d'argent, mois par mois", () => {
  it("regroupe par mois dans l'ordre, chaque mois par date, avec son total", () => {
    const calendar = buildCashCalendar(entries, { payerId: null });
    expect(calendar.map((month) => month.month)).toEqual(["2027-01", "2027-05"]);
    expect(calendar[0]!.entries.map((entry) => entry.id)).toEqual(["v1", "p1"]);
    expect(calendar[0]!.totalCents).toBe(450000);
    expect(calendar[1]!.entries.map((entry) => entry.id)).toEqual(["p2", "v2"]);
  });

  it("le reste à sortir du mois ne compte pas ce qui est déjà réglé", () => {
    const calendar = buildCashCalendar(entries, { payerId: null });
    expect(calendar[1]!.remainingCents).toBe(90000);
  });

  it("filtré par payeur : seulement ses échéances", () => {
    const calendar = buildCashCalendar(entries, { payerId: "famille-lea" });
    expect(calendar).toHaveLength(1);
    expect(calendar[0]!.entries.map((entry) => entry.id)).toEqual(["v1"]);
  });
});
