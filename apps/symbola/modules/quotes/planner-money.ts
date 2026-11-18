// Lot 48b (BUD-08, PRE-07, JUR-10 ; D6, D7 ; ADR 0093) — règles pures de l'argent de la planner,
// sans base. Montants en centimes entiers, taux en points de base (CLAUDE.md § 5).
// - Honoraires : forfait, pourcentage d'une base (budget estimé ou engagé), ou les deux.
// - Commissions : en montant ou en pourcentage ; affichées d'office à un client particulier
//   (réponse 4 de l'avocat, écart assumé avec PRE-07), au choix pour un professionnel.
// - Mode par ligne du devis : « intermédiaire » (facturée par le prestataire au client, montrée pour
//   information, hors du total de la planner) ou « revendeur » (dans son total et sa TVA).
// - Forfait touristique : règle de détection en données (planner-money.json, AV-10).
// - Seuil de franchise : paramètre réglementaire de l'Admin, part d'alerte en données.
import type { PackageTravelRule, TourismKind } from "@symbola/starter-templates";
import { lineAmounts, roundHalfUp, type LineInput } from "./amounts";

export type SupplyMode = "resale" | "intermediary";
export type PlannerFeeKind = "flat" | "percent" | "mixed";
export type PlannerFeeBase = "estimated" | "committed";
export type PlannerFeeTerms = { kind: PlannerFeeKind; flatCents: number | null; percentBasisPoints: number | null; base: PlannerFeeBase };

export function plannerFeeCents(fee: PlannerFeeTerms, bases: { estimatedCents: number; committedCents: number }): number {
  const flat = fee.kind === "percent" ? 0 : (fee.flatCents ?? 0);
  const base = Math.max(0, fee.base === "committed" ? bases.committedCents : bases.estimatedCents);
  const percent = fee.kind === "flat" ? 0 : roundHalfUp(base * (fee.percentBasisPoints ?? 0), 10000);
  return flat + percent;
}

export function commissionAmountCents(commission: { amountCents: number | null; percentBasisPoints: number | null; baseCents: number | null }): number {
  if (commission.amountCents !== null) return commission.amountCents;
  if (commission.percentBasisPoints === null || commission.baseCents === null) return 0;
  return roundHalfUp(Math.max(0, commission.baseCents) * commission.percentBasisPoints, 10000);
}

export function isCommissionShown(clientKind: "individual" | "professional", commission: { shownToClient: boolean }): boolean {
  return clientKind === "individual" || commission.shownToClient;
}

type CountedLine = { isOption: boolean; optionChosen: boolean };

function counted<T extends CountedLine>(lines: T[]): T[] {
  return lines.filter((line) => !line.isOption || line.optionChosen);
}

export function splitBySupplyMode<T extends LineInput & CountedLine & { supplyMode: SupplyMode }>(
  lines: T[],
): { resale: T[]; intermediary: T[]; resaleNetCents: number; intermediaryNetCents: number } {
  const resale = lines.filter((line) => line.supplyMode !== "intermediary");
  const intermediary = lines.filter((line) => line.supplyMode === "intermediary");
  const net = (group: T[]) => counted(group).reduce((sum, line) => sum + lineAmounts(line).netCents, 0);
  return { resale, intermediary, resaleNetCents: net(resale), intermediaryNetCents: net(intermediary) };
}

export function detectPackageTravel(lines: (CountedLine & { supplyMode: SupplyMode; tourismKind: TourismKind | null })[], rule: PackageTravelRule): boolean {
  const kinds = new Set(counted(lines).filter((line) => rule.modes.includes(line.supplyMode) && line.tourismKind !== null).map((line) => line.tourismKind!));
  return [...kinds].some((kind) => rule.primaryKinds.includes(kind)) && kinds.size >= rule.minimumKinds;
}

export type FranchiseAlert = "none" | "approaching" | "exceeded";

export function franchiseAlert(input: { thresholdCents: number | null; ratioBasisPoints: number; yearResaleCents: number; quoteResaleCents: number }): FranchiseAlert {
  if (input.thresholdCents === null || input.thresholdCents <= 0) return "none";
  const total = input.yearResaleCents + input.quoteResaleCents;
  if (total > input.thresholdCents) return "exceeded";
  return total * 10000 >= input.thresholdCents * input.ratioBasisPoints ? "approaching" : "none";
}
