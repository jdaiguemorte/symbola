// Lot 13 (L13-HUB-17) — recherche par nom et pagination communes aux écrans de la
// console qui listent les organisations (Organisations, Comptes, Prise en
// main, Activité) : 20 organisations par page, état dans l'adresse.
import { getTranslations } from "next-intl/server";
import { foldSearchText } from "@symbola/db/search";
import { FilterBar } from "@/app/ui/filter-bar";
import { Pagination, type Page } from "@/app/ui/pagination";

export function filterByName<T extends { name: string }>(items: T[], q: string | undefined): T[] {
  const needle = foldSearchText((q ?? "").trim());
  return needle ? items.filter((item) => foldSearchText(item.name).includes(needle)) : items;
}

export async function AdminListSearch({ q, total }: { q: string | undefined; total: number }) {
  const t = await getTranslations("Admin");
  return (
    <>
      <FilterBar label={t("filtersLabel")} applyLabel={t("filter")}>
        <label>
          {t("searchName")}
          <input type="search" name="q" defaultValue={q ?? ""} />
        </label>
      </FilterBar>
      <p className="muted" role="status">
        {t("resultCount", { count: total })}
      </p>
    </>
  );
}

export async function AdminListPagination<T>({ page, basePath, q }: { page: Page<T>; basePath: string; q: string | undefined }) {
  const t = await getTranslations("Pagination");
  return (
    <Pagination
      page={page.page}
      pageCount={page.pageCount}
      basePath={basePath}
      params={{ q }}
      labels={{ nav: t("label"), previous: t("previous"), next: t("next"), status: t("status", { page: page.page, count: page.pageCount }) }}
    />
  );
}
