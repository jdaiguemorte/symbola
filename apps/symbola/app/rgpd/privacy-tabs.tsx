"use client";

// Lot 18 (RGPD-07, décision A) — onglets de Données personnelles, à la place
// des liens enchaînés en haut de page : Demandes (et leurs dossiers),
// Rechercher une personne, Purge mensuelle, Réglages.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/rgpd", key: "tabRequests", match: (path: string) => path === "/rgpd" || path.startsWith("/rgpd/demandes") || path.startsWith("/rgpd/oublis") },
  { href: "/rgpd/recherche", key: "tabSearch", match: (path: string) => path.startsWith("/rgpd/recherche") },
  { href: "/rgpd/purge", key: "tabPurge", match: (path: string) => path.startsWith("/rgpd/purge") },
  { href: "/rgpd/reglages", key: "tabSettings", match: (path: string) => path.startsWith("/rgpd/reglages") },
] as const;

export function PrivacyTabs({ alerts }: { alerts?: number }) {
  const t = useTranslations("Privacy");
  const pathname = usePathname();
  return (
    <nav className="tabs" aria-label={t("tabsLabel")}>
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.match(pathname) ? "page" : undefined}>
          {t(tab.key)}
          {tab.key === "tabRequests" && alerts ? (
            <span className="nav-count nav-count-alert">
              {alerts}
              <span className="sr-only"> {t("alertsCount", { count: alerts })}</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
