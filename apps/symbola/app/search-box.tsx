"use client";

// Lot 10 (AIDE-08) — boîte de recherche globale, en haut de chaque écran de
// l'équipe : résultats instantanés regroupés (liste déroulante accessible),
// ⌘K / Ctrl+K pour y aller, Entrée pour ouvrir, Échap pour fermer. Sans
// JavaScript, le formulaire mène à la page /recherche.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SearchGroup } from "@/lib/search/run-search";

export function SearchBox() {
  const t = useTranslations("Search");
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const flat = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.key })));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setGroups([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/recherche/instantanee?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { groups: SearchGroup[] };
        setGroups(body.groups);
        setActive(-1);
        setOpen(true);
      } catch {
        // Requête annulée (nouvelle frappe) ou réseau indisponible : on garde l'affichage.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? flat.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      setOpen(false);
      router.push(flat[active]!.href);
    }
  }

  const expanded = open && term.trim().length >= 2;
  let index = -1;

  return (
    <form action="/recherche" role="search" aria-label={t("globalLabel")} className="search-box" data-tour="global-search" onSubmit={() => setOpen(false)}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t("label")}
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        name="q"
        autoComplete="off"
        placeholder={t("placeholder")}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
      />
      <kbd className="search-box-shortcut" aria-hidden="true">
        {t("shortcut")}
      </kbd>
      {expanded ? (
        <div className="search-box-results">
          {groups.length === 0 ? (
            <p role="status">{t("noResults", { term: term.trim() })}</p>
          ) : (
            <ul id={`${listId}-list`} role="listbox" aria-label={t("label")}>
              {groups.map((group) => (
                <li key={group.key} role="presentation">
                  <p className="search-box-group" aria-hidden="true">
                    {group.label}
                  </p>
                  <ul role="group" aria-label={group.label}>
                    {group.items.map((item) => {
                      index += 1;
                      const current = index;
                      return (
                        <li
                          key={`${item.href}-${item.title}`}
                          id={`${listId}-option-${current}`}
                          role="option"
                          aria-selected={current === active}
                          className="search-box-option"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setOpen(false);
                            router.push(item.href);
                          }}
                        >
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="search-box-hint">{t("hint")}</p>
        </div>
      ) : null}
    </form>
  );
}
