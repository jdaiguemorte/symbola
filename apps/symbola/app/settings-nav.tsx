"use client";

// Lot 13 (L13-HUB-16) — menu latéral des Paramètres, affiché sur les écrans de réglage.
// Lot 74g (G7, G12 ; pages 29 et 31 des maquettes du lot 68) : une rubrique ouverte garde à gauche le menu
// de SON groupe (sept lignes au plus), les autres groupes en une ligne chacun et « Tous les paramètres »,
// tenu dans l'écran sans défiler avec la page ; à partir de 1 100 px seulement. En dessous, et sur
// téléphone, la rubrique s'ouvre seule, avec « ‹ Paramètres · {groupe} » en tête, qui ramène à l'accueil
// (là où sont tous les groupes). L'accueil (/parametres) n'a pas ce menu : il est la liste.
// « Vos données » se comporte comme un groupe : ses écrans gardent leur menu et « ‹ Vos données ».
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isSettingsPath } from "./settings-paths";
import { activeSettingsItem } from "./settings-search";
import { SETTINGS_HOME_PATH, YOUR_DATA_PATH, type SettingsGroupIcon } from "./settings-menu";

export type { SettingsGroupIcon };

// count : repère visuel (lot 18, demandes RGPD en alerte), le nom du lien ne change pas.
export type SettingsNavItem = { href: string; label: string; count?: number; paths?: string[] };
export type SettingsGroup = { key: string; label: string; items: SettingsNavItem[]; count?: number };

export type SettingsNavLabels = { nav: string; all: string; others: string; back: string; groupMenu: string };

export function SettingsNav({ groups, data, labels }: { groups: SettingsGroup[]; data: SettingsGroup | null; labels: SettingsNavLabels }) {
  const pathname = usePathname();
  if (!isSettingsPath(pathname) || pathname === SETTINGS_HOME_PATH) return null;

  // « Vos données » : la page elle-même est la liste de son groupe ; elle ramène aux Paramètres.
  if (pathname === YOUR_DATA_PATH) return <BackLink href={SETTINGS_HOME_PATH} label={labels.back} wide />;

  const all = data ? [...groups, data] : groups;
  const active = activeSettingsItem(all, pathname);
  const current = active ? all.find((group) => group.items.includes(active)) : undefined;
  // Un écran de réglage hors du menu de ce rôle ou de ces modules (sa page dit pourquoi) : le retour seul.
  if (!active || !current) return <BackLink href={SETTINGS_HOME_PATH} label={labels.back} wide />;

  const inData = current === data;
  const others = all.filter((group) => group !== current);
  const backHref = inData ? YOUR_DATA_PATH : `${SETTINGS_HOME_PATH}#groupe-${current.key}`;
  const backLabel = inData ? current.label : `${labels.back} · ${current.label}`;

  return (
    <>
      <nav aria-label={labels.nav} className="settings-nav">
        <Link href={SETTINGS_HOME_PATH} className="settings-nav-all">
          <ChevronLeft aria-hidden="true" />
          {labels.all}
        </Link>
        <div className="settings-nav-group">
          <p className="settings-nav-title">{current.label}</p>
          <ul aria-label={labels.groupMenu.replace("{group}", current.label)}>
            {current.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={item === active ? "page" : undefined}>
                  {item.label}
                  {item.count ? (
                    <span className="nav-count nav-count-alert" aria-hidden="true">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="settings-nav-group settings-nav-others">
          <p className="settings-nav-title">{labels.others}</p>
          <ul>
            {others.map((group) => (
              <li key={group.key}>
                <Link href={group === data ? YOUR_DATA_PATH : group.items[0]!.href}>
                  {group.label}
                  {group.count ? (
                    <span className="nav-count nav-count-alert" aria-hidden="true">
                      {group.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <BackLink href={backHref} label={backLabel} />
    </>
  );
}

// « ‹ Paramètres · {groupe} » : sous 1 100 px et sur téléphone, à la place du menu du groupe ; partout
// quand l'écran n'a pas de menu de groupe (`wide`).
function BackLink({ href, label, wide = false }: { href: string; label: string; wide?: boolean }) {
  return (
    <p className={wide ? "settings-back" : "settings-back settings-back-narrow"}>
      <Link href={href}>
        <ChevronLeft aria-hidden="true" />
        {label}
      </Link>
    </p>
  );
}
