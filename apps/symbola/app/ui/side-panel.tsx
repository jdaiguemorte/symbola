"use client";

// Lot 13 (HUB-14, ADR 0033) — panneau latéral commun : le détail ou
// l'édition s'ouvre à droite, la liste reste visible. Son état est dans
// l'adresse (le parent l'affiche selon un paramètre, `closeHref` le retire) :
// lien partageable, retour arrière du navigateur. Se ferme par « Fermer »,
// Échap ou un clic hors du panneau ; le focus va au titre à l'ouverture.
// Plein écran sous 720 px (CSS).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function SidePanel({ title, closeHref, closeLabel, children }: { title: string; closeHref: string; closeLabel: string; children: ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const close = () => router.push(closeHref, { scroll: false });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || panelRef.current?.contains(target)) return;
      // Un clic sur un lien ou un bouton de la page fait son propre travail.
      if ((target as HTMLElement).closest?.("a, button, input, select, textarea, label")) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeHref, router]);

  return (
    <aside ref={panelRef} className="side-panel" aria-labelledby="side-panel-title">
      <div className="side-panel-head">
        <h2 id="side-panel-title" ref={titleRef} tabIndex={-1}>
          {title}
        </h2>
        <Link href={closeHref} scroll={false} className="side-panel-close" aria-label={closeLabel}>
          ×
        </Link>
      </div>
      {children}
    </aside>
  );
}
