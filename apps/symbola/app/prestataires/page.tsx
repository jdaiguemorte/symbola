// Lot 11 (PRE-04 à PRE-07, PRE-10, PRE-11) — carnet de prestataires : filtres,
// carte et liste du plus proche au plus loin, « Ajouter au poste », export.
// Lot 13 (PRE-12) : liste et carte côte à côte (bascule sur téléphone),
// filtres en barre alignée appliqués à la saisie, fiche en panneau latéral.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { loadPageTour } from "@/lib/help/page-tour";
import { mapAssets } from "@/lib/map/tiles";
import { PageTour } from "@/app/page-tour";
import { GearLink } from "@/app/gear-link";
import { addVendorToSlotAction } from "./actions";
import { queryString, RADIUS_CHOICES, type BookQuery } from "./filters";
import { isVendorsModuleEnabled } from "./module-access";
import { loadBookSelection } from "./selection";
import { VendorMap, type MapPoint } from "./vendor-map";
import { HoverSync } from "./hover-sync";
import { findVendors, getVendor } from "@/modules/vendors/service";
import { FilterBar } from "@/app/ui/filter-bar";
import { SidePanel } from "@/app/ui/side-panel";

export default async function VendorBookPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
  const tHelp = await getTranslations("Help");

  if (!(await isVendorsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const query = await searchParams;
  const [selection, assets] = await Promise.all([loadBookSelection(organizationId, query), mapAssets()]);
  const { types, tags, filters, center, centerNotFound, results, target } = selection;
  const typeById = new Map(types.map((type) => [type.id, type]));
  const selectedType = filters.typeId ? (typeById.get(filters.typeId) ?? null) : null;
  const points: MapPoint[] = results
    .filter((vendor) => vendor.location)
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      latitude: vendor.location!.latitude,
      longitude: vendor.location!.longitude,
      color: (vendor.typeId && typeById.get(vendor.typeId)?.color) || "#5e5a52",
      href: `/prestataires${queryString(query, { fiche: vendor.id })}`,
    }));
  // Lot 13 (PRE-12) : nombre de fiches par type (pastilles), fiche ouverte, vue sur téléphone.
  const allVendors = await findVendors({ organizationId });
  const countByType = new Map<string | null, number>();
  for (const vendor of allVendors) countByType.set(vendor.typeId, (countByType.get(vendor.typeId) ?? 0) + 1);
  const opened = typeof query.fiche === "string" ? await getVendor(organizationId, query.fiche) : null;
  const openedType = opened?.typeId ? typeById.get(opened.typeId) : undefined;
  const openedTravel = opened ? results.find((vendor) => vendor.id === opened.id)?.travel ?? null : null;
  const view = query.vue === "carte" ? "carte" : "liste";
  const tCommon = await getTranslations("Common");
  const typeHref = (typeId: string | null) => `/prestataires${queryString(query, { type: typeId ?? "", ...Object.fromEntries(Object.keys(filters.fieldInputs).map((key) => [key, ""])) })}`;
  const tour = await loadPageTour(auth.user.id, "vendors", typeof query.visite === "string" ? query.visite : undefined);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t("title")}</h1>
          <p className="meta">{t("subtitle", { count: results.length })}</p>
        </div>
        <div className="section-head">
          <PageTour {...tour} helpTitle={tHelp("vendorBook.title")} helpBody={tHelp("vendorBook.body")} />
          <GearLink href="/prestataires/parametres" label={t("settingsLink")} />
          <Link className="button-link" href={`/prestataires/nouveau${target ? queryString(query) : ""}`} data-tour="vendor-new">
            {t("newVendor")}
          </Link>
        </div>
      </div>

      {target ? (
        <section className="card" aria-labelledby="target-title">
          <h2 id="target-title">{t("targetTitle", { slot: target.slotLabel, event: target.eventLabel })}</h2>
          <p>{t("targetHint")}</p>
          <Link href={`/events/${target.eventId}?onglet=budget&poste=${target.slotId}`}>{t("targetBack")}</Link>
        </section>
      ) : null}

      <nav aria-label={t("typesFilter")} className="pills vendor-types" data-tour="vendor-types">
        <Link href={typeHref(null)} aria-current={filters.typeId === null ? "true" : undefined}>
          {t("allTypesCount", { count: allVendors.length })}
        </Link>
        {types.map((type) => (
          <Link key={type.id} href={typeHref(type.id)} aria-current={filters.typeId === type.id ? "true" : undefined}>
            {t("typeCount", { label: type.label, count: countByType.get(type.id) ?? 0 })}
          </Link>
        ))}
      </nav>

      <div data-tour="vendor-filters">
        <FilterBar
          label={t("filtersLabel")}
          applyLabel={t("filterApply")}
          preserve={Object.fromEntries(
            [
              ["type", filters.typeId],
              ["evenement", filters.eventId],
              ["poste", filters.slotId],
              ["vue", view === "carte" ? "carte" : null],
            ].filter((entry): entry is [string, string] => Boolean(entry[1])),
          )}
        >
          <label>
            {t("filterText")}
            <input type="search" name="q" defaultValue={filters.text} />
          </label>
          <label>
            {t("filterAround")}
            <input type="text" name="autour" data-apply="blur" defaultValue={filters.aroundText.startsWith("fiche:") ? "" : filters.aroundText} placeholder={t("filterAroundPlaceholder")} />
          </label>
          <label>
            {t("filterRadius")}
            <select name="rayon" defaultValue={String(filters.radiusKm)}>
              {RADIUS_CHOICES.map((radius) => (
                <option key={radius} value={radius}>
                  {t("radiusKm", { km: radius })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filterWorkedWithLabel")}
            <select name="deja" defaultValue={filters.workedWith ? "1" : ""}>
              <option value="">{t("any")}</option>
              <option value="1">{t("filterWorkedWith")}</option>
            </select>
          </label>
          <label>
            {t("filterUnplacedLabel")}
            <select name="aplacer" defaultValue={filters.unplaced ? "1" : ""}>
              <option value="">{t("any")}</option>
              <option value="1">{t("filterUnplaced")}</option>
            </select>
          </label>
          {tags.length > 0 ? (
            <label>
              {t("filterTag")}
              <select name="etiquette" defaultValue={filters.tagId ?? ""}>
                <option value="">{t("allTags")}</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedType?.fields
            .filter((field) => field.isFilter)
            .flatMap((field) =>
              field.kind === "boolean" || field.kind === "choice" || field.kind === "text"
                ? [
                    <label key={field.id}>
                      {field.label}
                      {field.kind === "text" ? (
                        <input type="text" name={`eq_${field.id}`} data-apply="blur" defaultValue={filters.fieldInputs[`eq_${field.id}`] ?? ""} />
                      ) : (
                        <select name={`eq_${field.id}`} defaultValue={filters.fieldInputs[`eq_${field.id}`] ?? ""}>
                          <option value="">{t("any")}</option>
                          {(field.kind === "boolean" ? ["oui", "non"] : field.choices).map((choice) => (
                            <option key={choice} value={choice}>
                              {field.kind === "boolean" ? t(choice === "oui" ? "yes" : "no") : choice}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>,
                  ]
                : [
                    <label key={`${field.id}-min`}>
                      {t("fieldMin", { label: field.label })}
                      <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" data-apply="blur" name={`min_${field.id}`} defaultValue={filters.fieldInputs[`min_${field.id}`] ?? ""} />
                    </label>,
                    <label key={`${field.id}-max`}>
                      {t("fieldMax", { label: field.label })}
                      <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" data-apply="blur" name={`max_${field.id}`} defaultValue={filters.fieldInputs[`max_${field.id}`] ?? ""} />
                    </label>,
                  ],
            )}
        </FilterBar>
        {centerNotFound ? <p role="status">{t("centerNotFound")}</p> : null}
      </div>

      <nav aria-label={t("viewLabel")} className="segmented vendor-view-switch">
        <Link href={`/prestataires${queryString(query, { vue: "" })}`} aria-current={view === "liste" ? "page" : undefined}>
          {t("viewList")}
        </Link>
        <Link href={`/prestataires${queryString(query, { vue: "carte" })}`} aria-current={view === "carte" ? "page" : undefined}>
          {t("viewMap")}
        </Link>
      </nav>

      <div className="vendor-book" data-view={view}>
        <section className="vendor-list" aria-labelledby="results-title" data-tour="vendor-results" id="vendor-list">
          <HoverSync containerId="vendor-list" />
          <div className="section-head">
            <h2 id="results-title">{center ? t("resultsByDistance", { count: results.length, place: center.label }) : t("results", { count: results.length })}</h2>
            <p className="meta">
              <a href={`/prestataires/export${queryString(query, { format: "csv", fiche: "" })}`}>{t("exportCsv")}</a>
              <a href={`/prestataires/export${queryString(query, { format: "pdf", fiche: "" })}`}>{t("exportPdf")}</a>
            </p>
          </div>
          {results.length === 0 ? <p>{types.length === 0 ? t("emptyNoTypes") : t("empty")}</p> : null}
          <ul className="vendor-results">
            {results.map((vendor) => {
              const type = vendor.typeId ? typeById.get(vendor.typeId) : undefined;
              return (
                <li key={vendor.id} data-vendor-id={vendor.id} aria-current={vendor.id === opened?.id ? "true" : undefined}>
                  <Link href={`/prestataires${queryString(query, { fiche: vendor.id })}`} scroll={false} className="strong">
                    {vendor.name}
                  </Link>
                  <span className="meta">
                    {type ? <span className="badge">{type.label}</span> : null}
                    {vendor.city ? <span>{vendor.city}</span> : null}
                    {vendor.travel ? <span>{t("travel", { km: vendor.travel.distanceKm, minutes: vendor.travel.minutes })}</span> : null}
                    {vendor.isDemo ? <span className="badge badge-ambre">{t("demo")}</span> : null}
                    {!vendor.location ? <span>{t("notPlaced")}</span> : null}
                  </span>
                  {target ? (
                    <form action={addVendorToSlotAction}>
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <input type="hidden" name="eventId" value={target.eventId} />
                      <input type="hidden" name="slotId" value={target.slotId} />
                      <button type="submit">{t("addToSlot", { vendor: vendor.name, slot: target.slotLabel })}</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {center ? <p className="muted">{t("travelHint")}</p> : null}
        </section>
        <div className="vendor-map-pane">
          <VendorMap
            points={points}
            assets={assets}
            around={center ? { latitude: center.latitude, longitude: center.longitude, radiusKm: filters.radiusKm } : null}
            label={t("mapLabel", { count: points.length })}
            missingTilesNotice={t("mapNoTiles")}
          />
        </div>
      </div>

      {opened ? (
        <SidePanel title={opened.name} closeHref={`/prestataires${queryString(query, { fiche: "" })}`} closeLabel={tCommon("closePanel")}>
          <dl className="vendor-summary">
            {openedType ? (
              <div>
                <dt>{t("summaryType")}</dt>
                <dd>{openedType.label}</dd>
              </div>
            ) : null}
            {opened.contactName ? (
              <div>
                <dt>{t("summaryContact")}</dt>
                <dd>{opened.contactName}</dd>
              </div>
            ) : null}
            {opened.phone ? (
              <div>
                <dt>{t("summaryPhone")}</dt>
                <dd>
                  <a href={`tel:${opened.phone}`}>{opened.phone}</a>
                </dd>
              </div>
            ) : null}
            {opened.email ? (
              <div>
                <dt>{t("summaryEmail")}</dt>
                <dd>
                  <a href={`mailto:${opened.email}`}>{opened.email}</a>
                </dd>
              </div>
            ) : null}
            {opened.addressLine || opened.city ? (
              <div>
                <dt>{t("summaryAddress")}</dt>
                <dd>{[opened.addressLine, [opened.postalCode, opened.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</dd>
              </div>
            ) : null}
            {openedTravel ? (
              <div>
                <dt>{t("summaryTravel")}</dt>
                <dd>{t("travel", { km: openedTravel.distanceKm, minutes: openedTravel.minutes })}</dd>
              </div>
            ) : null}
          </dl>
          {opened.internalNote ? <p className="muted">{opened.internalNote}</p> : null}
          {target ? (
            <form action={addVendorToSlotAction}>
              <input type="hidden" name="vendorId" value={opened.id} />
              <input type="hidden" name="eventId" value={target.eventId} />
              <input type="hidden" name="slotId" value={target.slotId} />
              <button type="submit">{t("addToSlot", { vendor: opened.name, slot: target.slotLabel })}</button>
            </form>
          ) : null}
          <Link href={`/prestataires/${opened.id}`} className="button-link button-link-primary">
            {t("openFullCard")}
          </Link>
        </SidePanel>
      ) : null}
    </main>
  );
}
