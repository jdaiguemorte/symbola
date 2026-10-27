"use client";

import { useMemo, useState } from "react";

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
    const needle = query.trim().toLowerCase();
    if (!needle) return topics;
    return topics.filter(
      (topic) => topic.title.toLowerCase().includes(needle) || topic.body.toLowerCase().includes(needle),
    );
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
              <h2>{topic.title}</h2>
              <p>{topic.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
