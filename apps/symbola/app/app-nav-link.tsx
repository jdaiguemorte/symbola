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
export function AppNavLink({ href, settings = false, children }: { href: string; settings?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const current = settings ? isSettingsPath(pathname) : under(pathname, href) && !isSettingsPath(pathname);
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
