"use client";

// Lot 39c (UX-15) — squelette d'écran pendant le passage d'un écran à l'autre, plutôt qu'une roue
// d'attente : l'emplacement du titre et des blocs apparaît tout de suite.
//
// Pas de `loading.tsx` : avec Next 15.5, une limite de chargement au-dessus d'une page bloque la
// navigation qui suit une action serveur terminée par `redirect()` (le formulaire reste « en
// cours », la page visée ne s'affiche jamais). Le squelette naît donc ici : au clic sur un lien
// interne vers un autre écran, il prend la place de l'écran courant si celui-ci tarde (le CSS masque
// l'écran courant tant que le squelette est là) ; il s'efface dès que l'écran visé est là
// (changement d'adresse), ou au bout de dix secondes.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigationTarget } from "@/lib/navigation-target";

// Sous ce délai, l'écran visé arrive avant que le squelette ait pu clignoter.
const SHOW_AFTER_MS = 80;
const WATCH_EVERY_MS = 100;
const GIVE_UP_MS = 10_000;

export function NavigationSkeleton({ label }: { label: string }) {
  const pathname = usePathname();
  // Le chemin de l'écran quitté, tant que l'écran visé n'est pas là.
  const [pending, setPending] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  // L'écran visé est là : le squelette s'efface.
  useEffect(() => {
    setPending(null);
    setShown(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = navigationTarget(
        {
          href: anchor.href,
          button: event.button,
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
        },
        window.location.href,
      );
      if (target) setPending(window.location.pathname);
    }
    // En capture : le lien de Next.js annule le clic natif pour naviguer lui-même.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (pending === null) return;
    const from = pending;
    const stillHere = () => window.location.pathname === from;
    const clear = () => {
      setPending(null);
      setShown(false);
    };
    const show = window.setTimeout(() => {
      if (stillHere()) setShown(true);
    }, SHOW_AFTER_MS);
    // L'adresse a changé : l'écran visé est là, même si le routeur ne l'a pas encore dit ici.
    const watch = window.setInterval(() => {
      if (!stillHere()) clear();
    }, WATCH_EVERY_MS);
    const giveUp = window.setTimeout(clear, GIVE_UP_MS);
    return () => {
      window.clearTimeout(show);
      window.clearInterval(watch);
      window.clearTimeout(giveUp);
    };
  }, [pending]);

  if (!shown || pending === null || pathname !== pending) return null;
  return (
    <main aria-busy="true" className="navigation-skeleton">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton skeleton-line" aria-hidden="true" />
      <div className="skeleton skeleton-card" aria-hidden="true" />
      <div className="skeleton skeleton-card" aria-hidden="true" />
      <div className="skeleton skeleton-card" aria-hidden="true" />
    </main>
  );
}
