// Lot 13 (L13-HUB-17, ADR 0033) — pagination commune des listes longues de la
// console d'Administration : une page de 20 éléments, état dans l'adresse
// (« ?page=n », lien partageable), les autres paramètres gardés. Avec
// plusieurs milliers d'organisations, afficher toute la liste figeait le
// navigateur (constat de l'étape 6b).
import Link from "next/link";

export const PAGE_SIZE = 20;

export type Page<T> = { items: T[]; page: number; pageCount: number; total: number };

// Page demandée (1 par défaut), ramenée dans les bornes.
export function paginate<T>(items: T[], requested: string | undefined, size: number = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const asked = Number.parseInt(requested ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pageCount) : 1;
  return { items: items.slice((page - 1) * size, page * size), page, pageCount, total: items.length };
}

export function Pagination({
  page,
  pageCount,
  basePath,
  params = {},
  labels,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  // Paramètres de l'adresse à garder (recherche…).
  params?: Record<string, string | undefined>;
  labels: { nav: string; previous: string; next: string; status: string };
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <nav className="pagination" aria-label={labels.nav}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="button-link">
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <span aria-current="page">{labels.status}</span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="button-link">
          {labels.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
