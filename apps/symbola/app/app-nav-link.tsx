"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isCurrentNavLink } from "./nav-current";

// Lien du menu principal : marqué « page courante » (aria-current) quand
// l'écran affiché est le sien ou l'un de ses sous-écrans (règles dans
// nav-current.ts). exact : seulement l'écran lui-même (« Vue d'ensemble » de
// la console) ; except : sous-adresses qui ont leur propre lien.
export function AppNavLink({
  href,
  settings = false,
  exact = false,
  except,
  tour,
  children,
}: {
  href: string;
  settings?: boolean;
  exact?: boolean;
  except?: string[];
  tour?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = isCurrentNavLink(pathname, href, { settings, exact, ...(except ? { except } : {}) });
  return (
    <Link href={href} aria-current={current ? "page" : undefined} data-tour={tour}>
      {children}
    </Link>
  );
}
