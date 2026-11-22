"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isCurrentNavLink } from "./nav-current";

// Lien du menu principal : marqué « page courante » (aria-current) quand
// l'écran affiché est le sien ou l'un de ses sous-écrans (règles dans
// nav-current.ts). exact : seulement l'écran lui-même (« Vue d'ensemble » de
// la console) ; except : sous-adresses qui ont leur propre lien.
// Lot 65f : l'icône d'un côté, le nom et ses pastilles (children) de l'autre, dans `app-nav-label`.
// Menu réduit, ce bloc devient l'infobulle du lien et reste son nom accessible : « Tâches 3 en
// retard » se lit en entier, ce qu'un aria-label réduit au seul nom aurait perdu.
export function AppNavLink({
  href,
  icon,
  label,
  settings = false,
  exact = false,
  except,
  tour,
  children,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  settings?: boolean;
  exact?: boolean;
  except?: string[];
  tour?: string;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const current = isCurrentNavLink(pathname, href, { settings, exact, ...(except ? { except } : {}) });
  return (
    <Link href={href} aria-current={current ? "page" : undefined} data-tour={tour}>
      {icon}
      <span className="app-nav-label">
        {label}
        {children}
      </span>
    </Link>
  );
}
