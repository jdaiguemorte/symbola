import { starterPackageTravelRule } from "@symbola/starter-templates";
import { describe, expect, it } from "vitest";
import { commissionAmountCents, detectPackageTravel, franchiseAlert, isCommissionShown, plannerFeeCents, splitBySupplyMode } from "./planner-money";

describe("BUD-08 — Honoraires de la planner (forfait, pourcentage ou mixte)", () => {
  it("forfait, pourcentage de la base choisie, ou les deux, au centime (arrondi demi vers le haut)", () => {
    expect(plannerFeeCents({ kind: "flat", flatCents: 350_000, percentBasisPoints: null, base: "estimated" }, { estimatedCents: 4_000_000, committedCents: 3_000_000 })).toBe(350_000);
    expect(plannerFeeCents({ kind: "percent", flatCents: null, percentBasisPoints: 1250, base: "committed" }, { estimatedCents: 4_000_000, committedCents: 3_000_001 })).toBe(375_000);
    expect(plannerFeeCents({ kind: "mixed", flatCents: 100_000, percentBasisPoints: 500, base: "estimated" }, { estimatedCents: 4_000_000, committedCents: 0 })).toBe(300_000);
  });
});

describe("PRE-07 / JUR-10 — Commissions et affichage au client (réponse 4 de l'avocat, D6)", () => {
  it("en montant ou en pourcentage d'une base", () => {
    expect(commissionAmountCents({ amountCents: 45_000, percentBasisPoints: null, baseCents: null })).toBe(45_000);
    expect(commissionAmountCents({ amountCents: null, percentBasisPoints: 1000, baseCents: 960_005 })).toBe(96_001);
    expect(commissionAmountCents({ amountCents: null, percentBasisPoints: 1000, baseCents: null })).toBe(0);
  });

  it("affichée d'office à un client particulier, sans case pour la masquer ; au choix pour un professionnel", () => {
    expect(isCommissionShown("individual", { shownToClient: false })).toBe(true);
    expect(isCommissionShown("individual", { shownToClient: true })).toBe(true);
    expect(isCommissionShown("professional", { shownToClient: false })).toBe(false);
    expect(isCommissionShown("professional", { shownToClient: true })).toBe(true);
  });
});

describe("JUR-10 — Intermédiaire ou revendeur par ligne du devis", () => {
  const line = (supplyMode: "resale" | "intermediary", unitPriceCents: number) => ({ supplyMode, quantityMilli: 1000, unitPriceCents, discountBasisPoints: 0, vatRateBasisPoints: 2000, isOption: false, optionChosen: false });

  it("les lignes intermédiaires sortent du total de la planner et se comptent à part, au centime", () => {
    const split = splitBySupplyMode([line("resale", 150_001), line("intermediary", 960_000), line("resale", 99)]);
    expect(split.resale.map((entry) => entry.unitPriceCents)).toEqual([150_001, 99]);
    expect(split.intermediary.map((entry) => entry.unitPriceCents)).toEqual([960_000]);
    expect(split.intermediaryNetCents).toBe(960_000);
    expect(split.resaleNetCents).toBe(150_100);
  });

  it("forfait touristique : transport ou hébergement et une autre prestation touristique, en revendeur", () => {
    const rule = starterPackageTravelRule();
    const tourism = (supplyMode: "resale" | "intermediary", tourismKind: "transport" | "lodging" | "other" | null) => ({ supplyMode, tourismKind, isOption: false, optionChosen: false });
    expect(detectPackageTravel([tourism("resale", "lodging"), tourism("resale", "other")], rule)).toBe(true);
    expect(detectPackageTravel([tourism("resale", "transport"), tourism("resale", "lodging")], rule)).toBe(true);
    expect(detectPackageTravel([tourism("resale", "lodging"), tourism("intermediary", "other")], rule)).toBe(false);
    expect(detectPackageTravel([tourism("resale", "other"), tourism("resale", "other")], rule)).toBe(false);
    expect(detectPackageTravel([tourism("resale", "lodging"), tourism("resale", null)], rule)).toBe(false);
    expect(detectPackageTravel([tourism("resale", "lodging"), { ...tourism("resale", "other"), isOption: true }], rule)).toBe(false);
  });
});

describe("JUR-10 — Alerte à l'approche du seuil de franchise (seuil de l'Admin)", () => {
  it("rien sans seuil ; alerte dès la part fixée ; dépassement signalé", () => {
    expect(franchiseAlert({ thresholdCents: null, ratioBasisPoints: 8000, yearResaleCents: 9_000_000, quoteResaleCents: 0 })).toBe("none");
    expect(franchiseAlert({ thresholdCents: 3_770_000, ratioBasisPoints: 8000, yearResaleCents: 2_000_000, quoteResaleCents: 1_015_999 })).toBe("none");
    expect(franchiseAlert({ thresholdCents: 3_770_000, ratioBasisPoints: 8000, yearResaleCents: 2_000_000, quoteResaleCents: 1_016_000 })).toBe("approaching");
    expect(franchiseAlert({ thresholdCents: 3_770_000, ratioBasisPoints: 8000, yearResaleCents: 3_000_000, quoteResaleCents: 770_001 })).toBe("exceeded");
  });
});
