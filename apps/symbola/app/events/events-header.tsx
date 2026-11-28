// Lot 63c (EVT-07, CRM-02, UX-13 ; maquette M7) — un seul en-tête pour les trois vues des évènements.
// Lot 72f (C-29, P-08, G14 ; page 17 des maquettes du lot 68) : « Évènements · 6 évènements à venir » ; à droite,
// la bascule « Liste · Colonnes · Calendrier » en encre (M8), « Nouvel évènement », seul bouton plein (la
// fenêtre du lot 70e), et le menu « ⋯ » : « Reprendre et importer », puis la section « Réglages ». Les vues
// gardent les filtres de la liste (critère 5).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { settingsPanelHref } from "@/app/reglages/panels";
import { EventsHeaderMenu } from "./events-list-controls";

export type EventsView = "list" | "pipeline" | "calendar";

// Les réglages de la liste qui suivent d'une vue à l'autre (filtres, période, tri).
export const LIST_KEEP_KEYS = ["tab", "search", "status", "source", "origine", "year", "planner", "tri", "sens"] as const;

export function keptQuery(query: Partial<Record<string, string | string[] | undefined>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of LIST_KEEP_KEYS) {
    const value = query[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first.slice(0, 200));
  }
  return params;
}

function viewHref(view: EventsView, keep: URLSearchParams): string {
  const params = new URLSearchParams(keep);
  if (view === "calendar") params.set("affichage", "calendrier");
  const text = params.toString();
  const path = view === "pipeline" ? "/events/pipeline" : "/events";
  return text ? `${path}?${text}` : path;
}

const VIEWS: { view: EventsView; key: "viewList" | "viewColumns" | "viewCalendar" }[] = [
  { view: "list", key: "viewList" },
  { view: "pipeline", key: "viewColumns" },
  { view: "calendar", key: "viewCalendar" },
];

export async function EventsHeader({ view, upcoming, keep = new URLSearchParams() }: { view: EventsView; upcoming?: number; keep?: URLSearchParams }) {
  const t = await getTranslations("Events");
  const tList = await getTranslations("EventsList");
  return (
    <PageHeader
      title={t("title")}
      subtitle={upcoming === undefined ? undefined : tList("subtitle", { count: upcoming })}
      actions={
        <>
          <nav aria-label={t("viewLabel")} className="segmented events-views" data-tour="events-views">
            {VIEWS.map((entry) => (
              <Link key={entry.view} href={viewHref(entry.view, keep)} aria-current={entry.view === view ? "page" : undefined}>
                {t(entry.key)}
              </Link>
            ))}
          </nav>
          {/* Lot 70e (D8, C-03) : une seule entrée, « Nouvel évènement ». */}
          <Link className="button-link button-link-primary" href="/events/new" data-tour="new-prospect">
            {t("newEvent")}
          </Link>
          {/* Lot 63b (HUB-14), 71b (I6) : « Reprendre et importer » ; les réglages s'ouvrent dans le panneau. */}
          <span className="events-header-menu" data-tour="events-settings">
            <EventsHeaderMenu
              label={tList("moreActions")}
              views={VIEWS.filter((entry) => entry.view !== view).map((entry) => ({ href: viewHref(entry.view, keep), label: t(entry.key) }))}
              importHref="/import?type=evenements#import-form"
              importLabel={t("importAndTakeOver")}
              section={tList("menuSettings")}
              settingsHref={settingsPanelHref("/events/parametres", "events")}
              settingsLabel={t("settingsLink")}
            />
          </span>
        </>
      }
    />
  );
}
