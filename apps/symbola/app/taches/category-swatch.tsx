// Lot 63d (CHR-03) — la pastille de couleur d'une catégorie de tâche. La couleur passe par l'attribut
// `fill` du SVG (CSP stricte : aucun style en ligne) ; elle accompagne toujours le libellé, qui seul
// porte le sens (aria-hidden).
export function CategorySwatch({ color, shape = "dot" }: { color: string; shape?: "dot" | "bar" }) {
  return shape === "bar" ? (
    <svg className="category-bar" width="4" height="14" viewBox="0 0 4 14" aria-hidden="true" focusable="false">
      <rect width="4" height="14" rx="1" fill={color} />
    </svg>
  ) : (
    <svg className="category-dot" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}
