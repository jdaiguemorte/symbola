"use client";

// Lot 13 (HUB-16) — menu latéral des Paramètres : quatre groupes, une
// rubrique par sujet, chacune à sa propre adresse. Affiché seulement sur
// les écrans de réglage ; sur téléphone, il passe au-dessus du contenu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSettingsPath } from "./settings-paths";

export type SettingsGroup = { label: string; items: { href: string; label: string }[] };

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SettingsNav({ groups, label }: { groups: SettingsGroup[]; label: string }) {
  const pathname = usePathname();
  if (!isSettingsPath(pathname)) return null;
  // L'adresse la plus précise gagne (/events/parametres/sources avant /events/parametres).
  const active = groups
    .flatMap((group) => group.items)
    .filter((item) => under(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={label} className="settings-nav">
      {groups.map((group) => (
        <div key={group.label} className="settings-nav-group">
          <p className="settings-nav-title">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={item === active ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
