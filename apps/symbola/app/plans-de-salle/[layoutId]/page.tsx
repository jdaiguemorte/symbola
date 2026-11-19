// Lot 60 (L60-PLA-02 à L60-PLA-05) — l'éditeur d'un plan : configuration d'un lieu du catalogue, ou
// plan d'un évènement. Pour un évènement : prestataires retenus placés, diffusion d'une version
// (signalée aux prestataires et au client), noms des prestataires montrés ou non (D8), copie des
// tables vers le plan de table (D7), enregistrement comme configuration du lieu. PDF à l'échelle.
// L'accès (module, lieu ou évènement, visibilité) est relu à chaque requête ; un plan d'ailleurs
// répond comme un absent.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { floorplanAmpChoices, floorplanEditorRules, floorplanSeatingRules, starterFloorplanElements, starterFloorplanFixtures } from "@symbola/starter-templates";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { backgroundSize, getLayoutEditor, listElementTypes, listLayoutVersions, retainedCandidates } from "@/modules/floorplans/service";
import { eventNames, getEvent } from "@/modules/events/service";
import { getVendor } from "@/modules/vendors/service";
import { getGuestModuleState, listSeatingMoments } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { layoutAccess } from "../access";
import { copyTablesToSeatingAction, publishLayoutAction, renameLayoutAction, saveToVenueAction, showVendorNamesAction } from "../actions";
import { Feedback } from "../feedback";
import { FloorplanEditor } from "../floorplan-editor";

type Query = { ok?: string; erreur?: string; ajoutees?: string; ignorees?: string };

export default async function FloorplanEditorPage({ params, searchParams }: { params: Promise<{ layoutId: string }>; searchParams: Promise<Query> }) {
  await requirePlanner();
  const t = await getTranslations("Floorplans");
  const tHelp = await getTranslations("Help");
  const { layoutId } = await params;
  if (!isValidId(layoutId)) notFound();
  const access = await layoutAccess(layoutId);
  if (!access) notFound();
  const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
  const { organizationId } = access;
  const view = await getLayoutEditor(organizationId, layoutId);
  const { space, layout } = view;
  const [types, vendor, event, vendors, versions] = await Promise.all([
    listElementTypes(organizationId, locale),
    space.vendorId ? getVendor(organizationId, space.vendorId) : Promise.resolve(null),
    layout.eventId ? getEvent(organizationId, layout.eventId) : Promise.resolve(null),
    layout.eventId ? retainedCandidates(organizationId, layout.eventId) : Promise.resolve([]),
    layout.eventId ? listLayoutVersions(organizationId, layoutId) : Promise.resolve([]),
  ]);
  const guestsReady = layout.eventId && (await isGuestsAvailable(organizationId)) && (await getGuestModuleState(organizationId)).impactAssessmentConfirmedAt;
  const moments = guestsReady && layout.eventId ? await listSeatingMoments(organizationId, layout.eventId) : [];
  const back = layout.eventId ? { href: `/events/${layout.eventId}/plan-de-salle`, label: t("event.back") } : { href: `/prestataires/${space.vendorId}/plans`, label: t("venue.back", { venue: vendor?.name ?? "" }) };
  const size = space.background ? backgroundSize(space.background, space.calibration, space.widthCm) : null;
  const typeLabels = Object.fromEntries(starterFloorplanElements(locale).map((element) => [element.key, element.label]));
  const subtitle = [space.name, vendor?.name, event ? eventNames(event.clients) : null].filter(Boolean).join(" · ");
  return (
    <main className="plans-page">
      <Link href={back.href} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {back.label}
      </Link>
      <PageHeader
        title={layout.name}
        subtitle={subtitle}
        badge={layout.eventId ? <span className="badge">{layout.publishedVersion > 0 ? t("event.version", { version: layout.publishedVersion }) : t("event.notPublished")}</span> : undefined}
        actions={<a href={`/plans-de-salle/${layoutId}/pdf`}>{t("pdf.download")}</a>}
      />
      <ScreenHelp title={tHelp("floorplanEditor.title")} body={tHelp("floorplanEditor.body")} />
      <Feedback query={await searchParams} />
      <details>
        <summary>{t("layouts.rename", { layout: layout.name })}</summary>
        <form action={renameLayoutAction} className="form-inline">
          <input type="hidden" name="layoutId" value={layout.id} />
          <label>
            {t("layouts.name")}
            <input name="name" required maxLength={80} defaultValue={layout.name} />
          </label>
          <button type="submit">{t("layouts.renameSubmit")}</button>
        </form>
      </details>
      {space.eventId ? null : (
        <p className="meta">
          <Link href={`/prestataires/${space.vendorId}/plans/${space.id}`}>{t("space.settings", { space: space.name })}</Link>
        </p>
      )}
      {space.eventId ? (
        <p className="meta">
          <Link href={`/events/${space.eventId}/plan-de-salle/espaces/${space.id}`}>{t("space.settings", { space: space.name })}</Link>
        </p>
      ) : null}

      <FloorplanEditor
        mode="elements"
        layoutId={layout.id}
        spaceId={space.id}
        revision={layout.revision}
        title={t("editor.drawingTitle", { layout: layout.name })}
        space={space}
        background={space.background && size ? { href: `/plans-de-salle/fond/${space.id}`, widthCm: size.widthCm, heightCm: size.heightCm, calibrated: size.calibrated } : null}
        fixtures={view.fixtures}
        elements={layout.elements}
        types={types}
        vendors={vendors.map((candidate) => ({ id: candidate.id, name: candidate.vendorName }))}
        rules={floorplanEditorRules()}
        seating={floorplanSeatingRules()}
        fixtureDefaults={starterFloorplanFixtures()}
        ampChoices={floorplanAmpChoices()}
        expectedGuests={view.expectedGuests}
        isEvent={Boolean(layout.eventId)}
        typeLabels={typeLabels}
      />

      {layout.eventId ? (
        <>
          <section className="card" aria-labelledby="share-title">
            <h2 id="share-title">{t("event.shareTitle")}</h2>
            <p className="meta">{t("event.shareIntro")}</p>
            <form action={showVendorNamesAction} className="stack">
              <input type="hidden" name="layoutId" value={layout.id} />
              <label className="checkbox">
                <input type="checkbox" name="show" defaultChecked={layout.showVendorNames} />
                {t("event.showVendorNames")}
              </label>
              <button type="submit">{t("event.saveNames")}</button>
            </form>
            <form action={publishLayoutAction}>
              <input type="hidden" name="layoutId" value={layout.id} />
              <button type="submit" className="button-primary">
                {layout.publishedVersion > 0 ? t("event.publishNew", { version: layout.publishedVersion + 1 }) : t("event.publishFirst")}
              </button>
            </form>
            {versions.length > 0 ? (
              <ul className="item-list" aria-label={t("event.versionsTitle")}>
                {versions.map((version) => (
                  <li key={version.version}>{t("event.versionLine", { version: version.version, date: formatDateTime(new Date(version.publishedAt), locale) })}</li>
                ))}
              </ul>
            ) : null}
          </section>
          {guestsReady ? (
            <section className="card" aria-labelledby="seating-title">
              <h2 id="seating-title">{t("seating.title")}</h2>
              <p className="meta">{t("seating.intro")}</p>
              {moments.length === 0 ? (
                <p>{t("seating.noMoments")}</p>
              ) : (
                <form action={copyTablesToSeatingAction} className="form-inline">
                  <input type="hidden" name="layoutId" value={layout.id} />
                  <label>
                    {t("seating.moment")}
                    <select name="keyMomentId" required>
                      {moments.map((moment) => (
                        <option key={moment.id} value={moment.id}>
                          {moment.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">{t("seating.submit")}</button>
                </form>
              )}
            </section>
          ) : null}
          {space.sourceSpaceId ? (
            <section className="card" aria-labelledby="to-venue-title">
              <h2 id="to-venue-title">{t("event.toVenueTitle")}</h2>
              <p className="meta">{t("event.toVenueIntro")}</p>
              <form action={saveToVenueAction} className="form-inline">
                <input type="hidden" name="layoutId" value={layout.id} />
                <label>
                  {t("layouts.name")}
                  <input name="name" required maxLength={80} defaultValue={layout.name} />
                </label>
                <button type="submit">{t("event.toVenueSubmit")}</button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
