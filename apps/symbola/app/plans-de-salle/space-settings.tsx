// Lot 60 (L60-PLA-01, L60-PLA-03 ; partie A, D4) — réglages d'un espace (lieu du catalogue ou copie
// dans un évènement) : nom et dimensions, fond de plan (image PNG, JPEG ou WebP, contrôlée à l'envoi,
// ADR 0027) et sa calibration, installations fixes posées une fois (éditeur en mode
// « installations » : prises avec leur nombre et leur ampérage, eau, portes, issues, accès, piliers,
// scène). Une phrase rappelle que le plan fourni par le lieu ne se diffuse qu'aux prestataires.
import { getTranslations } from "next-intl/server";
import { floorplanAmpChoices, floorplanEditorRules, floorplanSeatingRules, starterFloorplanFixtures } from "@symbola/starter-templates";
import { backgroundSize, FLOORPLAN_BACKGROUND_MAX_BYTES, getSpace } from "@/modules/floorplans/service";
import { CalibrationTool } from "./calibration-tool";
import { FloorplanEditor } from "./floorplan-editor";
import { removeBackgroundAction, removeSpaceAction, updateSpaceAction, uploadBackgroundAction } from "./actions";
import { SpaceSizeFields } from "./space-fields";

export async function SpaceSettings({ organizationId, spaceId }: { organizationId: string; spaceId: string }) {
  const t = await getTranslations("Floorplans");
  const found = await getSpace(organizationId, spaceId);
  if (!found) return null;
  const { space, fixtures } = found;
  const src = `/plans-de-salle/fond/${space.id}`;
  const size = space.background ? backgroundSize(space.background, space.calibration, space.widthCm) : null;
  return (
    <>
      <section className="card" aria-labelledby="space-size-title">
        <h2 id="space-size-title">{t("space.sizeTitle")}</h2>
        <form action={updateSpaceAction} className="stack">
          <input type="hidden" name="spaceId" value={space.id} />
          <SpaceSizeFields nameLabel={t("space.name")} widthLabel={t("space.width")} depthLabel={t("space.depth")} defaults={space} />
          <button type="submit">{t("space.save")}</button>
        </form>
      </section>
      <section className="card" aria-labelledby="space-background-title">
        <h2 id="space-background-title">{t("background.title")}</h2>
        <p className="meta">{t("background.intro", { size: Math.round(FLOORPLAN_BACKGROUND_MAX_BYTES / 1024 / 1024) })}</p>
        <p role="note" className="meta">
          {t("background.rights")}
        </p>
        <form action={uploadBackgroundAction} className="form-inline" encType="multipart/form-data">
          <input type="hidden" name="spaceId" value={space.id} />
          <label>
            {t("background.file")}
            <input type="file" name="file" required accept="image/png,image/jpeg,image/webp" />
          </label>
          <button type="submit">{space.background ? t("background.replace") : t("background.upload")}</button>
        </form>
        {space.background ? (
          <>
            <p className="meta">{space.calibration ? t("background.calibrated") : t("background.notCalibrated")}</p>
            <CalibrationTool spaceId={space.id} src={src} widthPx={space.background.widthPx} heightPx={space.background.heightPx} calibration={space.calibration} />
            <form action={removeBackgroundAction}>
              <input type="hidden" name="spaceId" value={space.id} />
              <button type="submit">{t("background.remove")}</button>
            </form>
          </>
        ) : null}
      </section>
      <section className="card" aria-labelledby="space-fixtures-title">
        <h2 id="space-fixtures-title">{t("fixtures.title")}</h2>
        <p className="meta">{t("fixtures.intro")}</p>
        <FloorplanEditor
          mode="fixtures"
          layoutId={null}
          spaceId={space.id}
          revision={0}
          title={t("fixtures.drawingTitle", { space: space.name })}
          space={space}
          background={space.background && size ? { href: src, widthCm: size.widthCm, heightCm: size.heightCm, calibrated: size.calibrated } : null}
          fixtures={fixtures}
          elements={[]}
          types={[]}
          vendors={[]}
          rules={floorplanEditorRules()}
          seating={floorplanSeatingRules()}
          fixtureDefaults={starterFloorplanFixtures()}
          ampChoices={floorplanAmpChoices()}
          expectedGuests={null}
          isEvent={Boolean(space.eventId)}
          typeLabels={{}}
        />
      </section>
      <section className="card" aria-labelledby="space-remove-title">
        <h2 id="space-remove-title">{t("space.removeTitle")}</h2>
        <p className="meta">{t("space.removeIntro")}</p>
        <form action={removeSpaceAction}>
          <input type="hidden" name="spaceId" value={space.id} />
          <button type="submit">{t("space.remove", { space: space.name })}</button>
        </form>
      </section>
    </>
  );
}
