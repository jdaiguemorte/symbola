"use client";

// Lot 70f (UX-05 ; C-81 ; page 3 des maquettes du lot 68) — le nom de l'écran, à gauche de la barre du
// haut de 60 px du téléphone (masqué sur ordinateur, où le menu latéral le dit). Le cadre reste en place
// d'un écran à l'autre (ADR 0045) : le nom suit l'adresse ici, côté navigateur, avec les mêmes règles que
// l'entrée allumée du menu (nav-current.ts). Hors du menu (une page sans entrée), rien n'est écrit.
import { usePathname } from "next/navigation";
import { isCurrentNavLink } from "./nav-current";

export type PhoneScreen = { href: string; label: string; settings?: boolean; exact?: boolean; except?: string[] };

export function PhoneScreenTitle({ screens }: { screens: PhoneScreen[] }) {
  const pathname = usePathname();
  const current = screens.find((screen) => isCurrentNavLink(pathname, screen.href, { settings: screen.settings ?? false, exact: screen.exact ?? false, ...(screen.except ? { except: screen.except } : {}) }));
  return <p className="app-topbar-title">{current?.label ?? ""}</p>;
}
