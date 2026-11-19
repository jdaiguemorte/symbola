// Lot 48b (BUD-08, PRE-07, JUR-10 ; D6, D7 ; ADR 0093) — données de départ de l'argent de la
// planner : règle de détection du forfait touristique (réponse 4 de l'avocat, à relire : AV-10),
// natures des commissions (commission, apport d'affaires) et part du seuil de franchise à partir de
// laquelle Symbola alerte (le seuil lui-même est un paramètre réglementaire de l'Admin, HUB-23).
// Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6).
import { z } from "zod";
import plannerMoneyFile from "./planner-money.json";

export const TOURISM_KINDS = ["transport", "lodging", "other"] as const;
export type TourismKind = (typeof TOURISM_KINDS)[number];

const schema = z.object({
  version: z.literal(1),
  packageTravel: z.object({
    modes: z.array(z.enum(["resale", "intermediary"])).min(1),
    primaryKinds: z.array(z.enum(TOURISM_KINDS)).min(1),
    minimumKinds: z.number().int().min(1).max(3),
  }),
  commissionNatures: z.array(z.enum(["commission", "referral"])).min(1),
  franchiseAlertRatioBasisPoints: z.number().int().min(1).max(10000),
});

const data = schema.parse(plannerMoneyFile);

export type PackageTravelRule = { modes: ("resale" | "intermediary")[]; primaryKinds: TourismKind[]; minimumKinds: number };

export function starterPackageTravelRule(): PackageTravelRule {
  return { modes: [...data.packageTravel.modes], primaryKinds: [...data.packageTravel.primaryKinds], minimumKinds: data.packageTravel.minimumKinds };
}

export function starterFranchiseAlertRatio(): number {
  return data.franchiseAlertRatioBasisPoints;
}
