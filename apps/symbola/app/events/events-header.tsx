// Lot 63c (EVT-07, CRM-02, UX-13 ; maquette M7) — un seul en-tête pour les trois vues des évènements :
// le titre, « Réglages » et « Nouveau » à droite, puis le sélecteur Liste / Colonnes / Calendrier,
// toujours au même endroit. Plus de vue en colonnes sans boutons.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { SettingsLink } from "@/app/settings-link";

export type EventsView = "list" | "pipeline" | "calendar";

export const EVENTS_VIEWS: { view: EventsView; href: string; key: "viewList" | "viewColumns" | "viewCalendar" }[] = [
  { view: "list", href: "/events", key: "viewList" },
  { view: "pipeline", href: "/events/pipeline", key: "viewColumns" },
  { view: "calendar", href: "/events?affichage=calendrier", key: "viewCalendar" },
];

export async function EventsHeader({ view, showViews = true }: { view: EventsView; showViews?: boolean }) {
  const t = await getTranslations("Events");
  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <SettingsLink href="/events/parametres" back="events" label={t("settingsLink")} tour="events-settings" />
            {/* Lot 63b (HUB-14) : importer des évènements (fiches PDF ou tableur) depuis l'écran. Lot 71b
                (I6) : le nom de l'écran, « Reprendre et importer ». */}
            <Link className="button-link" href="/import?type=evenements#import-form">
              {t("importAndTakeOver")}
            </Link>
            {/* Lot 70e (D8, C-03) : une seule entrée, « Nouvel évènement ». */}
            <Link className="button-link button-link-primary" href="/events/new" data-tour="new-prospect">
              {t("newEvent")}
            </Link>
          </>
        }
      />
      {showViews ? (
        <nav aria-label={t("viewLabel")} className="segmented events-views" data-tour="events-views">
          {EVENTS_VIEWS.map((entry) => (
            <Link key={entry.view} href={entry.href} aria-current={entry.view === view ? "page" : undefined}>
              {t(entry.key)}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
