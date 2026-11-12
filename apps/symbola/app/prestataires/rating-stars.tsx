// Lot 28c (PRE-01, D8) — évaluation d'une fiche en étoiles ; les lecteurs
// d'écran lisent le libellé (« 4 sur 5 »), pas les symboles.
export function RatingStars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="rating-stars">
      <span aria-hidden="true">
        {"★".repeat(rating)}
        {"☆".repeat(Math.max(5 - rating, 0))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
