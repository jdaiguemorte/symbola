// Lot 50 (INV-05, INV-06) — erreurs du plan de table et de la synthèse pour le traiteur. Un plan, une
// table, un invité ou une contrainte absents, d'un autre évènement ou d'une autre organisation : même
// réponse (SEC-13). Le client n'a ni plan ni synthèse (D9).
export class SeatingNotFoundError extends Error {
  constructor() {
    super("plan de table introuvable");
    this.name = "SeatingNotFoundError";
  }
}

export type SeatingProblem =
  | "table_name"
  | "capacity"
  | "count"
  | "too_many_tables"
  | "constraint_members"
  | "target_not_empty"
  | "same_moment"
  | "vendor_count"
  | "not_eligible"
  | "meal_label";

export class SeatingInvalidError extends Error {
  constructor(readonly problem: SeatingProblem) {
    super(`plan de table : ${problem}`);
    this.name = "SeatingInvalidError";
  }
}
