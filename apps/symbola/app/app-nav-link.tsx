"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isSettingsPath } from "./settings-paths";

function under(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Lien du menu principal : marqué « page courante » (aria-current) quand
// l'écran affiché est le sien ou l'un de ses sous-écrans. Les écrans de
// réglage d'un module allument « Paramètres », pas le module.
// exact : seulement l'écran lui-même (« Vue d'ensemble » de la console, dont les
// autres écrans sont des sous-adresses).
export function AppNavLink({ href, settings = false, exact = false, tour, children }: { href: string; settings?: boolean; exact?: boolean; tour?: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = exact ? pathname === href : settings ? isSettingsPath(pathname) : under(pathname, href) && !isSettingsPath(pathname);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} data-tour={tour}>
      {children}
    </Link>
  );
}
