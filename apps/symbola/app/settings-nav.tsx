"use client";

// Lot 13 (L13-HUB-16) — menu latéral des Paramètres : quatre groupes, une
// rubrique par sujet, chacune à sa propre adresse. Affiché seulement sur
// les écrans de réglage ; sur téléphone, il passe au-dessus du contenu.
// Lot 21 (L21-HUB-29) : chaque groupe a son icône et un titre lisible ; ses
// rubriques sont en retrait, le long d'un filet.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Contact,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { isSettingsPath } from "./settings-paths";

export type SettingsGroupIcon = "company" | "events" | "sales" | "data";

const GROUP_ICONS: Record<SettingsGroupIcon, LucideIcon> = {
  company: Building2,
  events: CalendarDays,
  sales: ReceiptText,
  data: Contact,
};

// count : repère visuel (lot 18, demandes RGPD en alerte), le nom du lien ne change pas.
export type SettingsGroup = {
  label: string;
  icon: SettingsGroupIcon;
  items: { href: string; label: string; count?: number }[];
};

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SettingsNav({
  groups,
  label,
}: {
  groups: SettingsGroup[];
  label: string;
}) {
  const pathname = usePathname();
  if (!isSettingsPath(pathname)) return null;
  // L'adresse la plus précise gagne (/events/parametres/sources avant /events/parametres).
  const active = groups
    .flatMap((group) => group.items)
    .filter((item) => under(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={label} className="settings-nav">
      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.icon];
        return (
          <div key={group.label} className="settings-nav-group">
            <p className="settings-nav-title">
              <Icon aria-hidden="true" />
              {group.label}
            </p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item === active ? "page" : undefined}
                  >
                    {item.label}
                    {item.count ? (
                      <span
                        className="nav-count nav-count-alert"
                        aria-hidden="true"
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
