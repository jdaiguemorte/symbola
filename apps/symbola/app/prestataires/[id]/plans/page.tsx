// Lot 60 (L60-PLA-01 ; partie A, D1) — les plans d'un lieu du catalogue : ses espaces (salle,
// jardin, chapiteau…), leurs dimensions, fond de plan et installations, et leurs configurations
// nommées (« Dîner 120 en rondes ») avec leur capacité calculée. Elles appartiennent à
// l'organisation : jamais partagées avec une autre, ni avec le lieu. Sans le module Plans de salle,
// la page répond « indisponible », jamais une erreur (ARC-07).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { getVendor } from "@/modules/vendors/service";
import { listVenueSpaces } from "@/modules/floorplans/service";
import { floorplansAccess } from "@/app/plans-de-salle/access";
import { createLayoutAction, createVenueSpaceAction, duplicateLayoutAction, removeLayoutAction } from "@/app/plans-de-salle/actions";
import { Feedback } from "@/app/plans-de-salle/feedback";
import { SpaceSizeFields } from "@/app/plans-de-salle/space-fields";

type Query = { ok?: string; erreur?: string };

export default async function VenuePlansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  await requirePlanner();
  const t = await getTranslations("Floorplans");
  const tHelp = await getTranslations("Help");
  const { id } = await params;
  const access = await floorplansAccess("vendors");
  if (!access) {
    return (
      <main>
        <PageHeader title={t("venue.title")} />
        <p role="note">{t("unavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();
  const vendor = await getVendor(access.organizationId, id);
  if (!vendor) notFound();
  const spaces = await listVenueSpaces(access.organizationId, id);
  const meters = (cm: number) => (cm / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const returnTo = `/prestataires/${id}/plans`;
  return (
    <main className="plans-page">
      <Link href={`/prestataires/${id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("venue.back", { venue: vendor.name })}
      </Link>
      <PageHeader title={t("venue.title")} subtitle={vendor.name} actions={<Link href="/plans-de-salle/bibliotheque">{t("library.link")}</Link>} />
      <ScreenHelp title={tHelp("floorplanVenue.title")} body={tHelp("floorplanVenue.body")} />
      <p className="meta">{t("venue.intro")}</p>
      <Feedback query={await searchParams} />
      {spaces.length === 0 ? <p>{t("venue.empty")}</p> : null}
      {spaces.map(({ space, fixtures, layouts }) => (
        <section key={space.id} className="card" aria-labelledby={`space-${space.id}`}>
          <div className="section-head">
            <h2 id={`space-${space.id}`}>{space.name}</h2>
            <Link href={`/prestataires/${id}/plans/${space.id}`}>{t("space.settings", { space: space.name })}</Link>
          </div>
          <p className="meta">
            {t("space.size", { w: meters(space.widthCm), d: meters(space.depthCm) })} · {space.background ? (space.calibration ? t("space.backgroundCalibrated") : t("space.backgroundNotCalibrated")) : t("space.noBackground")} ·{" "}
            {t("space.fixturesCount", { count: fixtures.length })}
          </p>
          <h3>{t("layouts.title")}</h3>
          {layouts.length === 0 ? <p>{t("layouts.empty")}</p> : null}
          <ul className="item-list">
            {layouts.map((layout) => (
              <li key={layout.id} className="plan-layout-row">
                <Link href={`/plans-de-salle/${layout.id}`}>{layout.name}</Link>
                <span className="meta">{t("layouts.summary", { seats: layout.capacity, count: layout.elementCount })}</span>
                <details>
                  <summary>{t("layouts.duplicate", { layout: layout.name })}</summary>
                  <form action={duplicateLayoutAction} className="form-inline">
                    <input type="hidden" name="layoutId" value={layout.id} />
                    <label>
                      {t("layouts.name")}
                      <input name="name" required maxLength={80} defaultValue={t("layouts.copyName", { layout: layout.name })} />
                    </label>
                    <button type="submit">{t("layouts.duplicateSubmit")}</button>
                  </form>
                </details>
                <form action={removeLayoutAction} className="inline-form">
                  <input type="hidden" name="layoutId" value={layout.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit">{t("layouts.remove", { layout: layout.name })}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={createLayoutAction} className="form-inline">
            <input type="hidden" name="spaceId" value={space.id} />
            <label>
              {t("layouts.newName")}
              <input name="name" required maxLength={80} placeholder={t("layouts.newPlaceholder")} />
            </label>
            <button type="submit">{t("layouts.create")}</button>
          </form>
        </section>
      ))}
      <section className="card" aria-labelledby="new-space-title">
        <h2 id="new-space-title">{t("space.newTitle")}</h2>
        <form action={createVenueSpaceAction} className="stack">
          <input type="hidden" name="vendorId" value={id} />
          <SpaceSizeFields nameLabel={t("space.name")} widthLabel={t("space.width")} depthLabel={t("space.depth")} namePlaceholder={t("space.namePlaceholder")} />
          <button type="submit">{t("space.create")}</button>
        </form>
      </section>
    </main>
  );
}
