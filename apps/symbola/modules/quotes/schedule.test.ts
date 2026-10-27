// DEV-03 — règles de l'échéancier : montants (fixes ou en pourcentage du
// TTC), solde, dépassement du total, retard et regroupement par mois, en
// heure de Paris, avec une horloge simulée.
import { describe, expect, it } from "vitest";
import { groupByMonth, isOverdue, parisToday, resolveSchedule } from "./schedule";

describe("DEV-03 — Échéancier : montants et solde", () => {
  it("un acompte en pourcentage se calcule sur le total TTC ; le solde est le reste", () => {
    const resolved = resolveSchedule(
      [
        { amountCents: null, percentageBasisPoints: 3000 },
        { amountCents: 50000, percentageBasisPoints: null },
      ],
      300000,
    );
    expect(resolved.amounts).toEqual([90000, 50000]);
    expect(resolved.balanceCents).toBe(160000);
    expect(resolved.exceedsTotal).toBe(false);
  });

  it("étant donné des acomptes dont la somme dépasse le total, alors l'échéancier est signalé en dépassement", () => {
    const resolved = resolveSchedule(
      [
        { amountCents: 200000, percentageBasisPoints: null },
        { amountCents: null, percentageBasisPoints: 5000 },
      ],
      300000,
    );
    expect(resolved.exceedsTotal).toBe(true);
    expect(resolved.balanceCents).toBe(-50000);
  });

  it("recalcul quand le total change : le pourcentage suit, le montant fixe reste", () => {
    const items = [
      { amountCents: null, percentageBasisPoints: 3000 },
      { amountCents: 50000, percentageBasisPoints: null },
    ];
    expect(resolveSchedule(items, 100000).amounts).toEqual([30000, 50000]);
    expect(resolveSchedule(items, 60000)).toMatchObject({ amounts: [18000, 50000], exceedsTotal: true });
  });

  it("arrondi au centime, demi vers le haut ; la somme égale au total n'est pas un dépassement", () => {
    expect(resolveSchedule([{ amountCents: null, percentageBasisPoints: 3333 }], 100001).amounts).toEqual([33330]);
    expect(resolveSchedule([{ amountCents: null, percentageBasisPoints: 10000 }], 100001)).toMatchObject({
      balanceCents: 0,
      exceedsTotal: false,
    });
  });
});

describe("DEV-03 — Échéance en retard (heure de Paris, horloge simulée)", () => {
  const due = "2027-06-15";

  it("la veille et le jour même : pas en retard ; le lendemain : en retard", () => {
    expect(isOverdue(due, new Date("2027-06-14T21:59:00Z"))).toBe(false); // 14 juin, 23 h 59 à Paris
    expect(isOverdue(due, new Date("2027-06-15T21:59:00Z"))).toBe(false); // 15 juin, 23 h 59 à Paris
    expect(isOverdue(due, new Date("2027-06-15T22:00:00Z"))).toBe(true); // 16 juin, 0 h à Paris
  });

  it("le jour calendaire suit Paris, pas UTC, y compris au passage à l'heure d'été et d'hiver", () => {
    // Nuit du 27 au 28 mars 2027 (passage à l'heure d'été) : 23 h 30 UTC = 0 h 30 à Paris le 28.
    expect(parisToday(new Date("2027-03-27T23:30:00Z"))).toBe("2027-03-28");
    expect(isOverdue("2027-03-27", new Date("2027-03-27T23:30:00Z"))).toBe(true);
    // Nuit du 30 au 31 octobre 2027 (passage à l'heure d'hiver) : 22 h 30 UTC = 0 h 30 le 31.
    expect(parisToday(new Date("2027-10-30T22:30:00Z"))).toBe("2027-10-31");
    expect(parisToday(new Date("2027-10-30T21:30:00Z"))).toBe("2027-10-30");
  });
});

describe("DEV-03 — Total par mois", () => {
  it("regroupe par mois d'échéance, dans l'ordre chronologique", () => {
    expect(
      groupByMonth([
        { dueDate: "2027-07-01", amountCents: 1000 },
        { dueDate: "2027-06-30", amountCents: 500 },
        { dueDate: "2027-06-01", amountCents: 250 },
      ]),
    ).toEqual([
      { month: "2027-06", totalCents: 750 },
      { month: "2027-07", totalCents: 1000 },
    ]);
  });
});
