// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 4.4 et § 5.4, critère 5 ; maquette 08,
// « Les nombres, d'un écran à l'autre ») — une seule fonction de compte pour « Vérifier », le bilan et la
// page de reprise. Les nombres attendus sont ceux du fichier fictif `tableur-planner/budget.csv`.
import { describe, expect, it } from "vitest";
import { importFigures, type ImportFigureBudgetLine } from "./counts";

const line = (input: Partial<ImportFigureBudgetLine> & { slotKey: string }): ImportFigureBudgetLine => ({
  newSlot: false,
  plannedCents: null,
  realCents: null,
  paidCents: null,
  payments: [],
  vendorKey: null,
  vendorInCarnet: false,
  ...input,
});

const deposit = (amountCents: number, dueOn: string, paid = true) => ({ amountCents, dueOn, paid });

// Les 14 lignes de budget.csv, rangées comme à l'étape « Doublons » (acomptes payés : « Oui »).
const budgetCsv: ImportFigureBudgetLine[] = [
  line({ slotKey: "venue", plannedCents: 650_000, realCents: 650_000, payments: [deposit(195_000, "2026-09-15"), deposit(455_000, "2027-02-20", false)], vendorKey: "domaine", vendorInCarnet: true }),
  line({ slotKey: "venue", plannedCents: 84_000, vendorKey: "domaine", vendorInCarnet: true }),
  line({ slotKey: "caterer", plannedCents: 1_320_000, realCents: 1_364_000, payments: [deposit(400_000, "2026-10-02"), deposit(964_000, "2027-03-06", false)], vendorKey: "bellerive", vendorInCarnet: true }),
  line({ slotKey: "caterer", plannedCents: 210_000, vendorKey: "bellerive", vendorInCarnet: true }),
  line({ slotKey: "caterer", plannedCents: 180_000 }),
  line({ slotKey: "florist", plannedCents: 240_000, realCents: 225_000, payments: [deposit(67_500, "2026-10-20"), deposit(157_500, "2027-03-13", false)], vendorKey: "pivoine", vendorInCarnet: true }),
  line({ slotKey: "florist", plannedCents: 32_000, vendorKey: "pivoine", vendorInCarnet: true }),
  line({ slotKey: "photographer", plannedCents: 290_000, realCents: 290_000, payments: [deposit(87_000, "2026-09-05"), deposit(203_000, "2027-03-20", false)], vendorKey: "clair-obscur", vendorInCarnet: true }),
  line({ slotKey: "videographer", plannedCents: 220_000 }),
  line({ slotKey: "music", plannedCents: 140_000, realCents: 140_000, payments: [deposit(42_000, "2026-11-12"), deposit(98_000, "2027-03-20", false)], vendorKey: "nuit-blanche", vendorInCarnet: true }),
  line({ slotKey: "music", plannedCents: 65_000 }),
  line({ slotKey: "stationery", plannedCents: 78_000, realCents: 81_200, payments: [deposit(81_200, "2026-10-30")], vendorKey: "papier-plie", vendorInCarnet: true }),
  line({ slotKey: "transport", plannedCents: 90_000 }),
  line({ slotKey: "hair", plannedCents: 46_000, vendorKey: "elodie", vendorInCarnet: true }),
];

const TODAY = "2026-11-25";

describe("HUB-14 — Une seule fonction de compte (lot 71d, importFigures)", () => {
  it("critère 5 : budget.csv donne les nombres de « Vérifier » et du bilan (14 lignes, 36 450,00 € prévus, 27 502,00 € réels, 8 727,00 € réglés, 18 775,00 € à payer, 7 prestataires)", () => {
    const figures = importFigures({ kind: "budget", lines: budgetCsv }, TODAY);
    expect(figures).toEqual({
      kind: "budget",
      lines: 14,
      slots: 9,
      newSlots: 0,
      plannedCents: 3_645_000,
      realCents: 2_750_200,
      // Un réel vide est « non renseigné », jamais 0 € (C-55) : six lignes ont un réel, huit n'en ont pas.
      realMissing: 8,
      paidCents: 872_700,
      paidCount: 6,
      toPayCents: 1_877_500,
      toPayCount: 5,
      toPayFrom: "2027-02-20",
      toPayTo: "2027-03-20",
      overdue: 0,
      vendors: 7,
      vendorsOutsideCarnet: 0,
    });
  });

  it("à payer = réel − réglé, ligne par ligne, et ne compte jamais un réel non renseigné", () => {
    const figures = importFigures({ kind: "budget", lines: budgetCsv }, TODAY);
    if (figures.kind !== "budget") throw new Error("budget attendu");
    expect(figures.toPayCents).toBe(figures.realCents - figures.paidCents);
  });

  it("« Non » aux acomptes : les acomptes passés sont en retard, rien n'est réglé", () => {
    const unpaid = budgetCsv.map((entry) => ({ ...entry, payments: entry.payments.map((payment) => ({ ...payment, paid: false })) }));
    const figures = importFigures({ kind: "budget", lines: unpaid }, TODAY);
    if (figures.kind !== "budget") throw new Error("budget attendu");
    expect(figures.paidCents).toBe(0);
    expect(figures.toPayCents).toBe(2_750_200);
    expect(figures.overdue).toBe(6);
  });

  it("une échéance due aujourd'hui n'est pas en retard ; la veille, si", () => {
    const one = [line({ slotKey: "venue", realCents: 10_000, payments: [deposit(10_000, TODAY, false)] })];
    expect(importFigures({ kind: "budget", lines: one }, TODAY)).toMatchObject({ overdue: 0, toPayCount: 1 });
    expect(importFigures({ kind: "budget", lines: one }, "2026-11-26")).toMatchObject({ overdue: 1 });
  });

  it("un poste nouveau compte une fois, quel que soit le nombre de ses lignes ; un réglé sans échéance compte comme un acompte", () => {
    const lines = [
      line({ slotKey: "new:papeterie", newSlot: true, plannedCents: 50_000, realCents: 50_000, paidCents: 20_000 }),
      line({ slotKey: "new:papeterie", newSlot: true, plannedCents: 10_000 }),
      line({ slotKey: "venue", plannedCents: 1_000, vendorKey: "x" }),
    ];
    expect(importFigures({ kind: "budget", lines }, TODAY)).toMatchObject({ slots: 2, newSlots: 1, paidCents: 20_000, paidCount: 1, toPayCents: 30_000, toPayCount: 1, toPayFrom: null, vendors: 1, vendorsOutsideCarnet: 1 });
  });

  it("les nombres ne dépendent pas de l'ordre des lignes, et restent des centimes entiers", () => {
    const forward = importFigures({ kind: "budget", lines: budgetCsv }, TODAY);
    const backward = importFigures({ kind: "budget", lines: [...budgetCsv].reverse() }, TODAY);
    expect(backward).toEqual(forward);
    for (const value of Object.values(forward)) if (typeof value === "number") expect(Number.isSafeInteger(value)).toBe(true);
  });

  it("un montant qui n'est pas un entier de centimes est refusé", () => {
    expect(() => importFigures({ kind: "budget", lines: [line({ slotKey: "venue", plannedCents: 10.5 })] }, TODAY)).toThrow();
  });

  it("les autres sortes de fichier comptent leurs lignes", () => {
    expect(importFigures({ kind: "rows", rows: 17 }, TODAY)).toEqual({ kind: "rows", rows: 17 });
  });
});
