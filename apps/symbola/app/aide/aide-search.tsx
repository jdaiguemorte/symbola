"use client";

// Lot 13 (AIDE-12) — vignettes du centre d'aide, filtrées à la saisie : la
// recherche porte sur l'aide (titre, texte, questions fréquentes), jamais sur
// les données. Accents et majuscules ignorés, comme la recherche globale.
import Link from "next/link";
import { useMemo, useState } from "react";
import { foldSearchText } from "@symbola/db/search";

export type HelpTile = {
  key: string;
  title: string;
  body: string;
  searchText: string;
  href: string;
  image: string;
  badge: string | null;
  badgeSeen: boolean;
};

export type HelpTileGroup = { key: string; title: string; tiles: HelpTile[] };

export function AideSearch({
  groups,
  searchLabel,
  noResults,
  resultsLabel,
}: {
  groups: HelpTileGroup[];
  searchLabel: string;
  noResults: string;
  // « Écrans trouvés : {count} » (les fonctions ne passent pas du serveur au client).
  resultsLabel: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = foldSearchText(query.trim());
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        tiles: group.tiles.filter((tile) => foldSearchText(`${tile.title} ${tile.body} ${tile.searchText}`).includes(needle)),
      }))
      .filter((group) => group.tiles.length > 0);
  }, [groups, query]);

  return (
    <>
      <div className="help-search" role="search">
        <label>
          {searchLabel}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <p className="sr-only" role="status">
          {query.trim() ? resultsLabel.replace("{count}", String(filtered.reduce((sum, group) => sum + group.tiles.length, 0))) : ""}
        </p>
      </div>
      <div>
        {filtered.length === 0 ? <p>{noResults}</p> : null}
        {filtered.map((group) => (
          <section key={group.key} aria-labelledby={`help-group-${group.key}`} className="help-group">
            <h2 id={`help-group-${group.key}`}>{group.title}</h2>
            <ul className="help-tiles">
              {group.tiles.map((tile) => (
                <li key={tile.key}>
                  <Link href={tile.href} className="help-tile">
                    {/* Capture réelle de l'écran (script help:captures) ou, à défaut,
                        illustration générique (lot 20, AIDE-16) ; décorative, le titre suit. */}
                    <img src={tile.image} alt="" width={640} height={400} loading="lazy" />
                    <span className="help-tile-text">
                      <span className="help-tile-title">{tile.title}</span>
                      <span className="help-tile-body">{tile.body}</span>
                    </span>
                    {tile.badge ? <span className={tile.badgeSeen ? "badge badge-sauge" : "badge"}>{tile.badge}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
