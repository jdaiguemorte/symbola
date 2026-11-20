// Lot 60 (L60-PLA-04, L60-PLA-05 ; partie D) — le plan de salle d'un évènement : pour un lieu du
// catalogue, une configuration du lieu copiée dans l'évènement puis ajustée sans modifier le lieu ;
// pour un lieu hors catalogue, un espace vide aux dimensions saisies. Chaque plan se diffuse en
// versions aux prestataires retenus et au client (rubrique « Plan de salle »). Sans le module Plans de
// salle, la page répond « indisponible », jamais une erreur (ARC-07).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { eventNames, getEvent, listEventPlaces } from "@/modules/events/service";
import { getVendorsByIds } from "@/modules/vendors/service";
import { listEventFloorplans, venuesWithLayouts } from "@/modules/floorplans/service";
import { floorplansAccess } from "@/app/plans-de-salle/access";
import { copyVenueLayoutAction, createEventSpaceAction, removeLayoutAction } from "@/app/plans-de-salle/actions";
import { Feedback } from "@/app/plans-de-salle/feedback";
import { SpaceSizeFields } from "@/app/plans-de-salle/space-fields";

export default async function EventFloorplanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await requirePlanner();
  const t = await getTranslations("Floorplans");
  const tHelp = await getTranslations("Help");
  const access = await floorplansAccess("events");
  if (!access) {
    return (
      <main>
        <PageHeader title={t("event.title")} />
        <p role="note">{t("unavailable")}</p>
      </main>
    );
  }
  const { id } = await params;
  if (!isValidId(id)) notFound();
  const event = await getEvent(access.organizationId, id);
  if (!event) notFound();
  const [plans, places] = await Promise.all([listEventFloorplans(access.organizationId, id), listEventPlaces(access.organizationId, id)]);
  const venueIds = [...new Set(places.map((place) => place.vendorId).filter((vendorId): vendorId is string => vendorId !== null))];
  const [venueLayouts, venues] = await Promise.all([venuesWithLayouts(access.organizationId, venueIds), getVendorsByIds(access.organizationId, venueIds)]);
  const venueName = new Map(venues.map((venue) => [venue.id, venue.name]));
  const placeLabel = new Map(places.map((place) => [place.id, place.label]));
  const returnTo = `/events/${id}/plan-de-salle`;
  const meters = (cm: number) => (cm / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const placeSelect = (
    <label>
      {t("event.place")}
      <select name="placeId" defaultValue="">
        <option value="">{t("event.noPlace")}</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <main className="plans-page">
      <Link href={`/events/${id}?onglet=programme`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("event.backToEvent")}
      </Link>
      <PageHeader title={t("event.title")} subtitle={eventNames(event.clients)} />
      <ScreenHelp title={tHelp("floorplanEvent.title")} body={tHelp("floorplanEvent.body")} />
      <p className="meta">{t("event.intro")}</p>
      <Feedback query={await searchParams} />

      {plans.length === 0 ? <p>{t("event.empty")}</p> : null}
      {plans.map(({ space, layouts }) => (
        <section key={space.id} className="card" aria-labelledby={`event-space-${space.id}`}>
          <div className="section-head">
            <h2 id={`event-space-${space.id}`}>{space.name}</h2>
            <Link href={`/events/${id}/plan-de-salle/espaces/${space.id}`}>{t("space.settings", { space: space.name })}</Link>
          </div>
          <p className="meta">
            {[space.vendorId ? venueName.get(space.vendorId) : t("event.offCatalogue"), space.eventPlaceId ? placeLabel.get(space.eventPlaceId) : null, t("space.size", { w: meters(space.widthCm), d: meters(space.depthCm) })].filter(Boolean).join(" · ")}
          </p>
          <ul className="item-list">
            {layouts.map((layout) => (
              <li key={layout.id} className="plan-layout-row">
                <Link href={`/plans-de-salle/${layout.id}`}>{layout.name}</Link>
                <span className="meta">{t("layouts.summary", { seats: layout.capacity, count: layout.elementCount })}</span>
                <span className="badge">{layout.publishedVersion > 0 ? t("event.version", { version: layout.publishedVersion }) : t("event.notPublished")}</span>
                <form action={removeLayoutAction} className="inline-form">
                  <input type="hidden" name="layoutId" value={layout.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit">{t("layouts.remove", { layout: layout.name })}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card" aria-labelledby="copy-title">
        <h2 id="copy-title">{t("event.copyTitle")}</h2>
        <p className="meta">{t("event.copyIntro")}</p>
        {venueLayouts.length === 0 ? (
          <p>{venueIds.length === 0 ? t("event.noVenue") : t("event.noVenueLayouts")}</p>
        ) : (
          <form action={copyVenueLayoutAction} className="stack">
            <input type="hidden" name="eventId" value={id} />
            <label>
              {t("event.configuration")}
              <select name="layoutId" required>
                {venueLayouts.flatMap(({ space, layouts }) =>
                  layouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {t("event.configurationOption", { venue: venueName.get(space.vendorId ?? "") ?? "", space: space.name, layout: layout.name, seats: layout.capacity })}
                    </option>
                  )),
                )}
              </select>
            </label>
            {placeSelect}
            <button type="submit">{t("event.copySubmit")}</button>
          </form>
        )}
      </section>

      <section className="card" aria-labelledby="empty-title">
        <h2 id="empty-title">{t("event.emptySpaceTitle")}</h2>
        <p className="meta">{t("event.emptySpaceIntro")}</p>
        <form action={createEventSpaceAction} className="stack">
          <input type="hidden" name="eventId" value={id} />
          <SpaceSizeFields nameLabel={t("space.name")} widthLabel={t("space.width")} depthLabel={t("space.depth")} namePlaceholder={t("space.namePlaceholder")} />
          {placeSelect}
          <button type="submit">{t("event.emptySpaceSubmit")}</button>
        </form>
      </section>
    </main>
  );
}
