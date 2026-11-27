"use client";

// Lot 74g (G1, G2, G12 ; page 29 des maquettes du lot 68) — l'accueil des Paramètres : les huit groupes,
// ouverts, chacun avec ses rubriques, leur phrase et « titulaire » ; puis « Vos données », à part. Sur
// téléphone, c'est la liste : une rubrique s'ouvre seule, avec « ‹ Paramètres ».
// « Chercher un réglage » (lot 62b) reste ici jusqu'à ce que la recherche du haut trouve les rubriques
// (74k) : il filtre les rubriques par leur nom, sans tenir compte des accents ni de la casse.
import Link from "next/link";
import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { filterSettingsGroups } from "../settings-search";

export type SettingsHomeItem = { href: string; label: string; hint: string; owner: boolean };
export type SettingsHomeGroup = { key: string; label: string; hint: string; items: SettingsHomeItem[] };

export function SettingsHome({
  groups,
  yourData,
}: {
  groups: SettingsHomeGroup[];
  yourData: { href: string; label: string; hint: string; open: string; count: number; countLabel: string };
}) {
  const t = useTranslations("SettingsMenu");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const visible = searching ? filterSettingsGroups(groups, query) : groups;
  const found = visible.reduce((total, group) => total + group.items.length, 0);

  return (
    <>
      <div className="settings-home-search" role="search" aria-label={t("search")}>
        <label htmlFor={searchId} className="sr-only">
          {t("search")}
        </label>
        <input id={searchId} type="search" placeholder={t("search")} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className={searching && found === 0 ? "settings-home-none" : "sr-only"} role="status">
        {searching ? t("searchCount", { count: found }) : ""}
      </p>
      <div className="settings-home">
        {visible.map((group) => (
          <section key={group.key} id={`groupe-${group.key}`} className="settings-home-group" aria-labelledby={`${searchId}-${group.key}`}>
            <h2 id={`${searchId}-${group.key}`}>{group.label}</h2>
            <p className="settings-home-group-hint">{group.hint}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="settings-home-link">
                    <span className="settings-home-label">{item.label}</span>
                    <span className="settings-home-hint">
                      {item.hint}
                      {item.owner ? <span className="settings-owner-tag"> · {t("ownerTag")}</span> : null}
                    </span>
                    <ChevronRight aria-hidden="true" className="settings-home-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="card settings-home-data" aria-labelledby={`${searchId}-data`}>
        <div>
          <h2 id={`${searchId}-data`}>
            {yourData.label}
            {yourData.count > 0 ? (
              <span className="nav-count nav-count-alert" title={yourData.countLabel}>
                <span aria-hidden="true">{yourData.count}</span>
                <span className="sr-only">{yourData.countLabel}</span>
              </span>
            ) : null}
          </h2>
          <p>{yourData.hint}</p>
        </div>
        <Link href={yourData.href} className="button-link">
          {yourData.open}
        </Link>
      </section>
    </>
  );
}
