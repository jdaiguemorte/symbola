"use client";

// Onglets communs aux écrans de réglage (maquette validée) : un onglet par
// module souscrit, et ses sous-écrans. Affichés seulement sur ces écrans.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSettingsPath } from "./settings-paths";

export type SettingsSection = { href: string; label: string; paths: string[]; children?: { href: string; label: string }[] };

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SettingsNav({ sections, label, subLabel }: { sections: SettingsSection[]; label: string; subLabel: string }) {
  const pathname = usePathname();
  if (!isSettingsPath(pathname)) return null;
  // Le chemin le plus précis gagne (/events/modeles-programme avant /events/modeles).
  const matches = (section: SettingsSection) => Math.max(-1, ...section.paths.filter((path) => under(pathname, path)).map((path) => path.length));
  const active = sections.reduce<SettingsSection | null>((best, section) => (matches(section) > (best ? matches(best) : -1) ? section : best), null);
  const activeChild = active?.children
    ?.filter((child) => under(pathname, child.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className="settings-nav">
      <nav aria-label={label} className="tabs">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} aria-current={section === active ? "page" : undefined}>
            {section.label}
          </Link>
        ))}
      </nav>
      {active?.children ? (
        <nav aria-label={subLabel} className="pills">
          {active.children.map((child) => (
            <Link key={child.href} href={child.href} aria-current={child === activeChild ? "true" : undefined}>
              {child.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
