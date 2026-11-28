"use client";

// Lot 74f (HUB-12, UX-10 ; maquette 27 ; C-07) — le champ de la recherche de l'aide. Un formulaire ordinaire
// (`GET /aide?q=`), qui marche sans JavaScript ; avec, la recherche part aussi à la frappe, après trois lettres,
// et la réponse est rendue par le serveur (rien de l'index n'est envoyé à la page). « Effacer la recherche »
// vide le champ : un nouveau mot remplace l'ancien, il ne s'y colle pas (PC-08, Clémence).
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const MIN_LENGTH = 3;
const DELAY_MS = 350;

export function HelpSearchForm({ initial, labels }: { initial: string; labels: { field: string; placeholder: string; submit: string; clear: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const sent = useRef(initial);

  useEffect(() => {
    const term = value.trim();
    if (term === sent.current.trim()) return;
    if (term.length > 0 && term.length < MIN_LENGTH) return;
    const timer = window.setTimeout(() => {
      sent.current = term;
      startTransition(() => router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false }));
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [value, pathname, router]);

  return (
    <form role="search" action={pathname} method="get" className="help-search-form">
      <label htmlFor="help-search-field" className="sr-only">
        {labels.field}
      </label>
      <div className="help-search-field">
        <input
          ref={input}
          id="help-search-field"
          type="search"
          name="q"
          value={value}
          placeholder={labels.placeholder}
          autoComplete="off"
          maxLength={200}
          onChange={(event) => setValue(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="help-search-clear"
            aria-label={labels.clear}
            onClick={() => {
              setValue("");
              input.current?.focus();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <button type="submit" className="button-primary">
        {labels.submit}
      </button>
    </form>
  );
}
