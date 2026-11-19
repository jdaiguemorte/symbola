// Lot 58 (PRE-08 ; ADR 0097) — règles pures de l'évaluation d'un prestataire après un évènement, sans
// base : une note de 1 à 5, trois critères facultatifs (ponctualité, qualité, relation ou rapport
// qualité-prix), un commentaire ; la moyenne et la dernière collaboration de l'historique. Toujours
// interne à l'organisation (critère de PRE-08).
export const EVALUATION_CRITERIA = ["punctuality", "quality", "value"] as const;
export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export type EvaluationInput = {
  rating: number;
  punctuality: number | null;
  quality: number | null;
  value: number | null;
  comment: string | null;
};

export const EVALUATION_COMMENT_MAX = 2000;

export class InvalidEvaluationError extends Error {
  constructor(readonly field: "rating" | EvaluationCriterion | "comment") {
    super(`évaluation : ${field} invalide`);
    this.name = "InvalidEvaluationError";
  }
}

function score(value: number | null, field: "rating" | EvaluationCriterion, optional: boolean): number | null {
  if (value === null && optional) return null;
  if (value === null || !Number.isInteger(value) || value < 1 || value > 5) throw new InvalidEvaluationError(field);
  return value;
}

export function cleanEvaluation(input: EvaluationInput): EvaluationInput {
  const comment = input.comment?.replace(/\r\n/g, "\n").trim() || null;
  if (comment !== null && comment.length > EVALUATION_COMMENT_MAX) throw new InvalidEvaluationError("comment");
  return {
    rating: score(input.rating, "rating", false)!,
    punctuality: score(input.punctuality, "punctuality", true),
    quality: score(input.quality, "quality", true),
    value: score(input.value, "value", true),
    comment,
  };
}

// Moyenne au dixième (affichage « 4,3 / 5 »), en dixièmes entiers pour éviter les flottants.
export function averageTenths(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return Math.round((sum * 10) / ratings.length);
}
