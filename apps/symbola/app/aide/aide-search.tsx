"use client";

import { useMemo, useState } from "react";
import { foldSearchText } from "@symbola/db/search";

export type HelpTopic = { title: string; body: string };

export function AideSearch({
  topics,
  searchLabel,
  noResults,
}: {
  topics: HelpTopic[];
  searchLabel: string;
  noResults: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    // Lot 10 : accents et majuscules ignorés, comme la recherche globale.
    const needle = foldSearchText(query.trim());
    if (!needle) return topics;
    return topics.filter((topic) => foldSearchText(`${topic.title} ${topic.body}`).includes(needle));
  }, [topics, query]);

  return (
    <div>
      <label>
        {searchLabel}
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {filtered.length === 0 ? (
        <p>{noResults}</p>
      ) : (
        <ul>
          {filtered.map((topic) => (
            <li key={topic.title}>
              <h3>{topic.title}</h3>
              <p>{topic.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
