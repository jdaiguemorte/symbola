"use client";

// Lot 72d (P-12, règle 6 de DESIGN.md ; C-16 ; page 15 des maquettes du lot 68) — « Fermer ramène d'où l'on
// vient ». L'app garde, pour l'onglet du navigateur (sessionStorage), l'écran affiché et celui d'avant ; un
// changement d'onglet d'une fiche (même chemin, autre « ?onglet= ») ne compte pas comme un autre écran. La
// fiche d'un évènement y lit d'où l'on vient (liste des évènements, « Aujourd'hui », « Tâches ») pour son
// « ← » ; ailleurs, ou sans mémoire (lien ouvert dans un nouvel onglet), son écran parent.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "symbola_ecrans";

type Screens = { current: string; previous: string | null };

function read(): Screens | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Screens) : null;
  } catch {
    return null;
  }
}

const pathOf = (location: string) => location.split(/[?#]/)[0]!;

export function NavigationOrigin() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const here = search ? `${pathname}?${search}` : pathname;
    const stored = read();
    const next: Screens = !stored ? { current: here, previous: null } : pathOf(stored.current) === pathname ? { current: here, previous: stored.previous } : { current: here, previous: stored.current };
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Stockage refusé (navigation privée stricte) : le « ← » mène à l'écran parent.
    }
  }, [pathname, search]);
  return null;
}

export type Origin = { href: string; screen: "events" | "home" | "tasks" };

// D'où l'on vient, parmi les écrans qui ouvrent une fiche d'évènement ; null : l'écran parent.
export function originFor(screens: Screens | null, pathname: string): Origin | null {
  if (!screens) return null;
  const from = pathOf(screens.current) === pathname ? screens.previous : screens.current;
  if (!from) return null;
  const path = pathOf(from);
  if (path === "/") return { href: from, screen: "home" };
  if (path === "/taches") return { href: from, screen: "tasks" };
  if (path === "/events") return { href: from, screen: "events" };
  return null;
}

export function useOrigin(pathname: string): Origin | null {
  const [origin, setOrigin] = useState<Origin | null>(null);
  useEffect(() => {
    setOrigin(originFor(read(), pathname));
  }, [pathname]);
  return origin;
}
