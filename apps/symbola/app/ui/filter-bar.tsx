"use client";

// Lot 13 (HUB-14, ADR 0033) — barre de filtres commune : contrôles de même
// hauteur, filtrage à la saisie (sans bouton « Filtrer »), état dans
// l'adresse. Sans JavaScript, le formulaire GET reste utilisable (bouton
// masqué « Appliquer »).
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const SEARCH_DELAY_MS = 300;

export function FilterBar({
  label,
  applyLabel,
  preserve = {},
  children,
}: {
  label: string;
  applyLabel: string;
  // Paramètres de l'adresse à garder tels quels (onglet courant…).
  preserve?: Record<string, string>;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preserve)) params.set(key, value);
    for (const [key, value] of new FormData(form)) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <form
      ref={formRef}
      method="get"
      role="search"
      aria-label={label}
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      onChange={(event) => {
        const target = event.target as unknown as HTMLInputElement;
        if (timer.current) clearTimeout(timer.current);
        if (target.type === "search" || target.type === "text") {
          timer.current = setTimeout(apply, SEARCH_DELAY_MS);
        } else {
          apply();
        }
      }}
    >
      {Object.entries(preserve).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children}
      <button type="submit" className="sr-only">
        {applyLabel}
      </button>
    </form>
  );
}
