"use client";

// Lot 70f (UX-05 ; C-81 ; page 3 des maquettes du lot 68) — le nom de l'écran, à gauche de la barre du
// haut de 60 px du téléphone (masqué sur ordinateur, où le menu latéral le dit). Le cadre reste en place
// d'un écran à l'autre (ADR 0045) : le nom suit l'adresse ici, côté navigateur, avec les mêmes règles que
// l'entrée allumée du menu (nav-current.ts). Hors du menu (une page sans entrée), rien n'est écrit.
// Lot 72d (P-12 ; page 15) : une fiche de second niveau (celle d'un évènement) remplace ce nom par « ← » et
// son propre nom ; « ← » ramène à l'écran d'où l'on vient (PhoneTitleOverride).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isCurrentNavLink } from "./nav-current";

export type PhoneScreen = { href: string; label: string; settings?: boolean; exact?: boolean; except?: string[] };

type Override = { title: string; back: { href: string; label: string } };
type OverrideContext = { override: Override | null; set: (override: Override | null) => void };

const PhoneTitleContext = createContext<OverrideContext>({ override: null, set: () => {} });

export function PhoneTitleProvider({ children }: { children: ReactNode }) {
  const [override, set] = useState<Override | null>(null);
  return <PhoneTitleContext.Provider value={{ override, set }}>{children}</PhoneTitleContext.Provider>;
}

// Posé par une fiche : tant qu'elle est affichée, la barre du haut du téléphone dit « ← » et son nom.
export function PhoneTitleOverride({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  const { set } = useContext(PhoneTitleContext);
  useEffect(() => {
    set({ title, back: { href: backHref, label: backLabel } });
    return () => set(null);
  }, [set, title, backHref, backLabel]);
  return null;
}

export function PhoneScreenTitle({ screens }: { screens: PhoneScreen[] }) {
  const pathname = usePathname();
  const { override } = useContext(PhoneTitleContext);
  if (override) {
    return (
      <p className="app-topbar-title app-topbar-title-back">
        <Link href={override.back.href} className="app-topbar-back" aria-label={override.back.label}>
          <span aria-hidden="true">←</span>
        </Link>
        <span className="app-topbar-back-title">{override.title}</span>
      </p>
    );
  }
  const current = screens.find((screen) => isCurrentNavLink(pathname, screen.href, { settings: screen.settings ?? false, exact: screen.exact ?? false, ...(screen.except ? { except: screen.except } : {}) }));
  return <p className="app-topbar-title">{current?.label ?? ""}</p>;
}
