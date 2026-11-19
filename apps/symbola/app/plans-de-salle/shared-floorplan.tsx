// Lot 60 (L60-PLA-05 ; D8, POR-10) — le plan diffusé, en lecture, pour un lien (prestataire ou
// client) : dernière version, son numéro et sa date, signalée si elle est nouvelle ; le dessin avec
// l'emplacement du prestataire en évidence, la liste équivalente au dessin, les accès et issues, le
// tableau « Électricité » et son rappel ; le PDF à l'échelle. Jamais de note interne.
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { starterFloorplanElementLabel } from "@symbola/starter-templates";
import type { SharedFloorplan } from "@symbola/contracts";
import { backgroundSize } from "@/modules/floorplans/service";
import { PlanDrawing } from "./plan-drawing";

const MARKS = { outlet: "⚡", water: "💧", door: "", emergency_exit: "⇥", delivery: "⇩", pillar: "", stage: "" } as const;

export async function SharedFloorplanView({ plan, basePath, audience }: { plan: SharedFloorplan; basePath: string; audience: "vendor" | "client" }) {
  const t = await getTranslations("Floorplans");
  const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
  const typeOf = (element: SharedFloorplan["elements"][number]) => (element.typeStarterKey ? (starterFloorplanElementLabel(element.typeStarterKey, locale) ?? element.typeStarterKey) : (element.typeLabel ?? ""));
  const labelOf = (element: SharedFloorplan["elements"][number]) => element.name ?? typeOf(element);
  const fixtureName = (fixture: SharedFloorplan["fixtures"][number]) => fixture.label ?? t(`fixtureKinds.${fixture.kind}`);
  const meters = (cm: number) => (cm / 100).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  const mine = plan.elements.filter((element) => element.mine);
  const size = plan.space.background ? backgroundSize(plan.space.background, plan.space.calibration, plan.space.widthCm) : null;
  const access = plan.fixtures.filter((fixture) => fixture.kind === "delivery" || fixture.kind === "emergency_exit" || fixture.kind === "door");
  const headingId = `shared-${plan.layoutId}`;
  return (
    <section className="card plan-shared" aria-labelledby={headingId}>
      <div className="section-head">
        <h2 id={headingId}>{plan.layoutName}</h2>
        <span className="badge">{t("event.version", { version: plan.version })}</span>
        {plan.isNew ? <span className="badge badge-ambre">{t("shared.new")}</span> : null}
      </div>
      <p className="meta">{t("shared.published", { space: plan.space.name, date: formatDateTime(new Date(plan.publishedAt), locale) })}</p>
      {audience === "vendor" ? (
        mine.length > 0 ? (
          <div className="plan-mine" role="note">
            <h3>{t("shared.mineTitle")}</h3>
            <ul>
              {mine.map((element) => {
                const outlet = element.fixtureId ? plan.fixtures.find((fixture) => fixture.id === element.fixtureId) : undefined;
                return (
                  <li key={element.id}>
                    <strong>{labelOf(element)}</strong> — {t("shared.position", { x: meters(element.xCm), y: meters(element.yCm) })}
                    {element.powerOutlets > 0 ? ` · ${t("pdf.powerNeed", { count: element.powerOutlets, amps: element.powerAmps ?? 0 })}` : ""}
                    {element.needsWater ? ` · ${t("pdf.water")}` : ""}
                    {outlet ? ` · ${t("pdf.pluggedTo", { outlet: fixtureName(outlet) })}` : element.powerOutlets > 0 ? ` · ${t("shared.noOutlet")}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p>{t("shared.notPlaced")}</p>
        )
      ) : null}
      <div className="plan-canvas">
        <PlanDrawing
          widthCm={plan.space.widthCm}
          depthCm={plan.space.depthCm}
          title={t("shared.drawingTitle", { layout: plan.layoutName })}
          background={size ? { href: `${basePath}/${plan.layoutId}/fond`, widthCm: size.widthCm, heightCm: size.heightCm } : null}
          fixtures={plan.fixtures.map((fixture) => ({ ...fixture, label: fixtureName(fixture), mark: MARKS[fixture.kind] }))}
          elements={plan.elements.map((element) => ({ ...element, label: labelOf(element), highlighted: element.mine }))}
        />
      </div>
      <p>
        <a href={`${basePath}/${plan.layoutId}/pdf`}>{t("pdf.download")}</a>
      </p>
      {access.length > 0 ? (
        <>
          <h3>{t("shared.accessTitle")}</h3>
          <ul className="plan-rows">
            {access.map((fixture) => (
              <li key={fixture.id} className="plan-row">
                <strong>{fixtureName(fixture)}</strong>
                <span className="meta">{t("shared.position", { x: meters(fixture.xCm), y: meters(fixture.yCm) })}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>{t("editor.listTitle")}</h3>
      <ul className="plan-rows">
        {plan.elements.map((element) => (
          <li key={element.id} className={element.mine ? "plan-row is-mine" : "plan-row"}>
            <strong>{labelOf(element)}</strong>
            <span className="meta">{[element.name ? typeOf(element) : null, element.vendorName, element.category === "table" ? t("editor.seats", { count: element.seats }) : null].filter(Boolean).join(" · ")}</span>
            <span className="meta">{t("shared.position", { x: meters(element.xCm), y: meters(element.yCm) })}</span>
          </li>
        ))}
      </ul>
      {plan.power.length > 0 ? (
        <>
          <h3>{t("power.title")}</h3>
          <p role="note" className="meta">
            {t("power.disclaimer")}
          </p>
          <ul className="plan-rows">
            {plan.power.map((row) => (
              <li key={row.fixtureId} className="plan-row">
                <strong>{row.label ?? t("fixtureKinds.outlet")}</strong>
                <span className="meta">{t(row.threePhase ? "power.capacityThreePhase" : "power.capacityValue", { count: row.outletCount, amps: row.amps })}</span>
                <span className="meta">{t(row.overloaded ? "power.usedOverloaded" : "power.usedValue", { used: row.used, count: row.outletCount })}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
