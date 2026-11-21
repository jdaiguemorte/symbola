"use client";

// Lot 13 (L13-HUB-16) — menu latéral des Paramètres : quatre groupes, une
// rubrique par sujet, chacune à sa propre adresse. Affiché seulement sur
// les écrans de réglage ; sur téléphone, il passe au-dessus du contenu.
// Lot 21 (L21-HUB-29) : chaque groupe a son icône et un titre lisible ; ses
// rubriques sont en retrait, le long d'un filet.
// Lot 62b (UX-13, décision D2) : les groupes se replient, celui de la rubrique ouverte est déplié ;
// « Chercher un réglage » filtre les rubriques par leur nom. La rubrique ouverte est donc visible et
// allumée sans faire défiler (cinquante et une rubriques tenaient mal dans une colonne).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  Contact,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { isSettingsPath } from "./settings-paths";
import { activeSettingsItem, filterSettingsGroups } from "./settings-search";
import type { SettingsGroupIcon } from "./settings-menu";

export type { SettingsGroupIcon };

const GROUP_ICONS: Record<SettingsGroupIcon, LucideIcon> = {
  company: Building2,
  events: CalendarDays,
  appointments: CalendarClock,
  sales: ReceiptText,
  data: Contact,
};

// count : repère visuel (lot 18, demandes RGPD en alerte), le nom du lien ne change pas.
export type SettingsGroup = {
  label: string;
  icon: SettingsGroupIcon;
  items: { href: string; label: string; count?: number }[];
};

export function SettingsNav({
  groups,
  label,
}: {
  groups: SettingsGroup[];
  label: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("SettingsMenu");
  const navRef = useRef<HTMLElement>(null);
  const searchId = useId();
  const [query, setQuery] = useState("");
  // Ce que la planner a ouvert ou replié à la main ; remis à zéro à chaque rubrique ouverte.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setToggled({});
    setQuery("");
  }
  const shown = isSettingsPath(pathname);
  const active = activeSettingsItem(groups, pathname);

  // La rubrique ouverte reste en vue dans la colonne du menu (elle défile à part sur ordinateur).
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector('a[aria-current="page"]');
    if (!nav || !current || nav.scrollHeight <= nav.clientHeight) return;
    const box = current.getBoundingClientRect();
    const frame = nav.getBoundingClientRect();
    if (box.top < frame.top || box.bottom > frame.bottom) nav.scrollTop += box.top - frame.top - nav.clientHeight / 2;
  }, [pathname, shown]);

  if (!shown) return null;
  const searching = query.trim() !== "";
  const visible = searching ? filterSettingsGroups(groups, query) : groups;
  const found = visible.reduce((total, group) => total + group.items.length, 0);

  return (
    <nav aria-label={label} className="settings-nav" ref={navRef}>
      <div className="settings-nav-search" role="search">
        <label htmlFor={searchId} className="sr-only">
          {t("search")}
        </label>
        <input id={searchId} type="search" placeholder={t("search")} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className={searching && found === 0 ? "settings-nav-none" : "sr-only"} role="status">
        {searching ? t("searchCount", { count: found }) : ""}
      </p>
      {visible.map((group) => {
        const Icon = GROUP_ICONS[group.icon];
        const holdsActive = active !== undefined && group.items.includes(active);
        const open = searching || (toggled[group.label] ?? holdsActive);
        const panelId = `${searchId}-${group.icon}`;
        const alerts = group.items.reduce((total, item) => total + (item.count ?? 0), 0);
        return (
          <div key={group.label} className="settings-nav-group">
            {searching ? (
              <p className="settings-nav-title">
                <Icon aria-hidden="true" />
                <span>{group.label}</span>
              </p>
            ) : (
              <button type="button" className="settings-nav-title" aria-expanded={open} aria-controls={panelId} onClick={() => setToggled((previous) => ({ ...previous, [group.label]: !open }))}>
                <Icon aria-hidden="true" />
                <span>{group.label}</span>
                {!open && alerts > 0 ? (
                  <span className="nav-count nav-count-alert" aria-hidden="true">
                    {alerts}
                  </span>
                ) : null}
              </button>
            )}
            <ul id={panelId} hidden={!open}>
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
