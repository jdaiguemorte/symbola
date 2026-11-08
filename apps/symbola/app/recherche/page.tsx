// Lot 10 (AIDE-08) — page de résultats de la recherche globale ; fonctionne
// sans JavaScript (la boîte de recherche y envoie son formulaire).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { runSearch } from "@/lib/search/run-search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const auth = await requirePlanner();
  const t = await getTranslations("Search");
  const term = ((await searchParams).q ?? "").trim().slice(0, 100);
  const groups = term.length >= 2 ? await runSearch({ organizationId: auth.user.organizationId, role: auth.user.role, term }) : [];

  return (
    <main>
      <h1>{term ? t("resultsFor", { term }) : t("title")}</h1>
      <form action="/recherche" role="search" aria-label={t("refineLabel")} className="search-page-form">
        <label>
          {t("label")}
          <input type="search" name="q" defaultValue={term} placeholder={t("placeholder")} />
        </label>
        <button type="submit">{t("submit")}</button>
      </form>
      <p>{t("onlyYourOrganization")}</p>
      {term.length > 0 && term.length < 2 ? <p role="status">{t("tooShort")}</p> : null}
      {term.length >= 2 && groups.length === 0 ? <p role="status">{t("noResults", { term })}</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="card" aria-labelledby={`search-${group.key}`}>
          <h2 id={`search-${group.key}`}>{group.label}</h2>
          <ul className="item-list">
            {group.items.map((item) => (
              <li key={item.href + item.title}>
                <Link href={item.href}>
                  <strong>{item.title}</strong>
                </Link>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
