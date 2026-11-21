"use client";

// Lot 62d (UX-12) — les rubriques du devis en onglets (classe `tabs`), chacune à son adresse ; la
// rubrique affichée porte aria-current. Sur téléphone, les onglets défilent dans leur barre : l'onglet
// affiché y est amené, sans faire défiler la page. Une ancre d'avant le lot (« #echeancier »,
// « #contrat »…) ouverte sur une autre rubrique mène à la sienne.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { rubricOfAnchor, type Rubric } from "./rubrics";

export function RubricTabs({ label, current, tabs }: { label: string; current: Rubric; tabs: { rubric: Rubric; label: string; href: string }[] }) {
  const nav = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const bar = nav.current;
    const tab = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !tab) return;
    if (tab.offsetLeft < bar.scrollLeft || tab.offsetLeft + tab.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = Math.max(0, tab.offsetLeft - 16);
  }, [current]);

  useEffect(() => {
    const follow = () => {
      const rubric = rubricOfAnchor(window.location.hash);
      if (rubric !== null && rubric !== current && tabs.some((tab) => tab.rubric === rubric)) router.replace(`${pathname}?rubrique=${rubric}${window.location.hash}`);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [current, pathname, router, tabs]);

  return (
    <nav ref={nav} className="tabs quote-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.rubric} href={tab.href} aria-current={tab.rubric === current ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
