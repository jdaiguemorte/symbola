// Lot 11 (L11-PRE-04 à L11-PRE-07, L11-PRE-10, L11-PRE-11) — carnet de prestataires : filtres,
// carte et liste du plus proche au plus loin, « Ajouter au poste », export.
// Lot 13 (L13-PRE-12) : liste et carte côte à côte (bascule sur téléphone),
// filtres en barre alignée appliqués à la saisie, fiche en panneau latéral.
// Lot 16 (L16-PRE-14, ADR 0040) : pastilles par famille (non vides), types de la
// famille choisie en second rang, « à classer » signalé ; couleur et
// pictogramme de la famille sur la carte.
import { PageHeader } from "@/app/ui/page-header";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { loadPageTour } from "@/lib/help/page-tour";
import { mapAssets } from "@/lib/map/tiles";
import { PageTour } from "@/app/page-tour";
import { SettingsLink } from "@/app/settings-link";
import { addVendorToSlotAction, archiveVendorAction } from "./actions";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { queryString, RADIUS_CHOICES, UNCLASSIFIED_FAMILY, type BookQuery } from "./filters";
import { isVendorsModuleEnabled } from "./module-access";
import { loadBookSelection } from "./selection";
import { VendorMap, type MapPoint } from "./vendor-map";
import { HoverSync } from "./hover-sync";
import { countVendorsByType, getVendor } from "@/modules/vendors/service";
import { ensureVendorFamilies } from "@/lib/vendors/catalog";
import { FamilyIcon } from "./family-icon";
import { RatingStars } from "./rating-stars";

// Types « à classer » (sans famille) et fiches sans type, sur la carte.
const UNCLASSIFIED_COLOR = "#78716c";
import { FilterBar } from "@/app/ui/filter-bar";
import { SidePanel } from "@/app/ui/side-panel";

export default async function VendorBookPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
  const auth = await requirePlanner();
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

  await ensureVendorFamilies(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  const query = await searchParams;
  const [selection, assets, counts] = await Promise.all([loadBookSelection(organizationId, query), mapAssets(), countVendorsByType(organizationId)]);
  const { families, types, tags, tagGroups, filters, center, centerNotFound, results, target } = selection;
  const typeById = new Map(types.map((type) => [type.id, type]));
  const familyById = new Map(families.map((family) => [family.id, family]));
  const familyOf = (typeId: string | null) => {
    const type = typeId ? typeById.get(typeId) : undefined;
    return type?.familyId ? (familyById.get(type.familyId) ?? null) : null;
  };
  const selectedType = filters.typeId ? (typeById.get(filters.typeId) ?? null) : null;
  const points: MapPoint[] = results
    .filter((vendor) => vendor.location)
    .map((vendor) => {
      const family = familyOf(vendor.typeId);
      return {
        id: vendor.id,
        name: vendor.name,
        latitude: vendor.location!.latitude,
        longitude: vendor.location!.longitude,
        color: family?.color ?? UNCLASSIFIED_COLOR,
        icon: family?.icon ?? "other",
        href: `/prestataires${queryString(query, { fiche: vendor.id })}`,
      };
    });
  // Nombre de fiches (hors archives) par type, par famille et « à classer ».
  const countOf = new Map(counts.map((entry) => [entry.typeId, entry.count]));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const countOfTypes = (list: typeof types) => list.reduce((sum, type) => sum + (countOf.get(type.id) ?? 0), 0);
  const familyCount = (familyId: string) => countOfTypes(types.filter((type) => type.familyId === familyId));
  const unclassifiedTypes = types.filter((type) => type.familyId === null);
  const unclassifiedCount = countOfTypes(unclassifiedTypes) + (countOf.get(null) ?? 0);
  const visibleFamilies = families.filter((family) => familyCount(family.id) > 0 || family.id === filters.familyId);
  const chosenFamily = filters.familyId ? (familyById.get(filters.familyId) ?? null) : null;
  const rowTypes = filters.unclassified ? unclassifiedTypes : chosenFamily ? types.filter((type) => type.familyId === chosenFamily.id) : [];
  const shownTypes = rowTypes.filter((type) => (countOf.get(type.id) ?? 0) > 0 || type.id === filters.typeId);
  const legend = [
    ...families.filter((family) => results.some((vendor) => vendor.location && familyOf(vendor.typeId)?.id === family.id)),
  ];
  const legendUnclassified = results.some((vendor) => vendor.location && !familyOf(vendor.typeId));
  const opened = typeof query.fiche === "string" ? await getVendor(organizationId, query.fiche) : null;
  const openedType = opened?.typeId ? typeById.get(opened.typeId) : undefined;
  const openedFamily = opened ? familyOf(opened.typeId) : null;
  const openedTravel = opened ? results.find((vendor) => vendor.id === opened.id)?.travel ?? null : null;
  const view = query.vue === "carte" ? "carte" : "liste";
  const tCommon = await getTranslations("Common");
  const clearFields = Object.fromEntries(Object.keys(filters.fieldInputs).map((key) => [key, ""]));
  const familyHref = (family: string | null) => `/prestataires${queryString(query, { famille: family ?? "", type: "", ...clearFields })}`;
  const typeHref = (typeId: string | null) => `/prestataires${queryString(query, { type: typeId ?? "", ...clearFields })}`;
  const tour = await loadPageTour(auth.user.id, "vendors", typeof query.visite === "string" ? query.visite : undefined);

  return (
    <main>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: results.length })}
        actions={
          <>
            <SettingsLink href="/prestataires/parametres" label={t("settingsLink")} />
            <Link className="button-link button-link-primary" href={`/prestataires/nouveau${target ? queryString(query) : ""}`} data-tour="vendor-new">
              {t("newVendor")}
            </Link>
          </>
        }
      />
      <PageTour {...tour} helpTitle={tHelp("vendorBook.title")} helpBody={tHelp("vendorBook.body")} />

      {target ? (
        <section className="card" aria-labelledby="target-title">
          <h2 id="target-title">{t("targetTitle", { slot: target.slotLabel, event: target.eventLabel })}</h2>
          <p>{t("targetHint")}</p>
          <Link href={`/events/${target.eventId}?onglet=budget&poste=${target.slotId}`}>{t("targetBack")}</Link>
        </section>
      ) : null}

      <nav aria-label={t("familiesFilter")} className="pills vendor-types" data-tour="vendor-types">
        <Link href={familyHref(null)} aria-current={!filters.familyId && !filters.unclassified ? "true" : undefined}>
          {t("allTypesCount", { count: total })}
        </Link>
        {visibleFamilies.map((family) => (
          <Link key={family.id} href={familyHref(family.id)} aria-current={filters.familyId === family.id ? "true" : undefined}>
            <FamilyIcon color={family.color} icon={family.icon} />
            {t("typeCount", { label: family.label, count: familyCount(family.id) })}
          </Link>
        ))}
        {unclassifiedCount > 0 || filters.unclassified ? (
          <Link href={familyHref(UNCLASSIFIED_FAMILY)} aria-current={filters.unclassified ? "true" : undefined}>
            <FamilyIcon color={UNCLASSIFIED_COLOR} icon="other" />
            {t("unclassifiedCount", { count: unclassifiedCount })}
          </Link>
        ) : null}
      </nav>
      {(chosenFamily || filters.unclassified) && shownTypes.length > 0 ? (
        <nav aria-label={t("familyTypesFilter", { family: chosenFamily?.label ?? t("unclassified") })} className="pills pills-secondary vendor-family-types">
          <Link href={typeHref(null)} aria-current={filters.typeId === null ? "true" : undefined}>
            {t("allFamilyCount", { count: chosenFamily ? familyCount(chosenFamily.id) : unclassifiedCount })}
          </Link>
          {shownTypes.map((type) => (
            <Link key={type.id} href={typeHref(type.id)} aria-current={filters.typeId === type.id ? "true" : undefined}>
              {t("typeCount", { label: type.label, count: countOf.get(type.id) ?? 0 })}
            </Link>
          ))}
        </nav>
      ) : null}
      {unclassifiedCount > 0 && !filters.unclassified ? (
        <p className="vendor-unclassified">
          {t("unclassifiedBanner", { count: unclassifiedCount })} <Link href={familyHref(UNCLASSIFIED_FAMILY)}>{t("unclassifiedShow")}</Link>
          {" · "}
          <Link href="/prestataires/parametres">{t("unclassifiedSort")}</Link>
        </p>
      ) : null}

      <div data-tour="vendor-filters">
        <FilterBar
          label={t("filtersLabel")}
          applyLabel={t("filterApply")}
          preserve={Object.fromEntries(
            [
              ["famille", filters.familyId ?? (filters.unclassified ? UNCLASSIFIED_FAMILY : null)],
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
            {t("filterRating")}
            <select name="note" defaultValue={filters.minRating ? String(filters.minRating) : ""}>
              <option value="">{t("any")}</option>
              {[5, 4, 3, 2].map((value) => (
                <option key={value} value={value}>
                  {t("filterRatingAtLeast", { rating: value })}
                </option>
              ))}
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
                {/* Lot 20 (décision 5) : rangées par groupe, comme sur la fiche. */}
                {[...tagGroups.map((group) => ({ key: group.id, label: group.label, tags: tags.filter((tag) => tag.groupId === group.id) })), { key: "other", label: t("tagGroupOther"), tags: tags.filter((tag) => tag.groupId === null) }]
                  .filter((section) => section.tags.length > 0)
                  .map((section) =>
                    tagGroups.length === 0 ? (
                      section.tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.label}
                        </option>
                      ))
                    ) : (
                      <optgroup key={section.key} label={section.label}>
                        {section.tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
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
                    {type ? (
                      <span className="badge badge-family">
                        <FamilyIcon color={familyOf(type.id)?.color ?? UNCLASSIFIED_COLOR} icon={familyOf(type.id)?.icon ?? "other"} />
                        {type.label}
                      </span>
                    ) : null}
                    {vendor.city ? <span>{vendor.city}</span> : null}
                    {vendor.travel ? <span>{t("travel", { km: vendor.travel.distanceKm, minutes: vendor.travel.minutes })}</span> : null}
                    {vendor.rating ? <RatingStars rating={vendor.rating} label={t("ratingValue", { rating: vendor.rating })} /> : null}
                    {vendor.isDemo ? <span className="badge badge-ambre">{t("demo")}</span> : null}
                    {!vendor.location ? <span>{t("notPlaced")}</span> : null}
                  </span>
                  {/* Lot 20 (L20-PRE-17) : archiver sans ouvrir la fiche, après confirmation. */}
                  <ConfirmDialog
                    trigger={t("archiveShort")}
                    triggerLabel={t("archive", { vendor: vendor.name })}
                    triggerClassName="link-button vendor-row-archive"
                    title={t("archiveConfirmTitle", { vendor: vendor.name })}
                    body={t("archiveConfirmBody")}
                    confirmLabel={t("archiveConfirm")}
                    cancelLabel={t("archiveCancel")}
                    action={archiveVendorAction}
                    fields={{ vendorId: vendor.id, back: `/prestataires${queryString(query, { fiche: null })}` }}
                  />
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
            controls={{ zoomIn: t("mapZoomIn"), zoomOut: t("mapZoomOut") }}
            summary={t("mapSummary", { placed: points.length, unplaced: Math.max(results.length - points.length, 0) })}
          />
          {legend.length > 0 || legendUnclassified ? (
            <ul className="vendor-map-legend" aria-label={t("mapLegend")}>
              {legend.map((family) => (
                <li key={family.id}>
                  <FamilyIcon color={family.color} icon={family.icon} />
                  {family.label}
                </li>
              ))}
              {legendUnclassified ? (
                <li>
                  <FamilyIcon color={UNCLASSIFIED_COLOR} icon="other" />
                  {t("unclassified")}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>

      {opened ? (
        <SidePanel title={opened.name} closeHref={`/prestataires${queryString(query, { fiche: "" })}`} closeLabel={tCommon("closePanel")}>
          <dl className="vendor-summary">
            {openedType ? (
              <div>
                <dt>{t("summaryType")}</dt>
                <dd>{openedFamily ? t("typeInFamily", { family: openedFamily.label, type: openedType.label }) : openedType.label}</dd>
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
          {/* Lot 28c (PRE-01) : évaluation et tarifs indicatifs. */}
          {opened.rating || opened.indicativePrices ? (
            <dl className="vendor-summary">
              {opened.rating ? (
                <div>
                  <dt>{t("rating")}</dt>
                  <dd>
                    <RatingStars rating={opened.rating} label={t("ratingValue", { rating: opened.rating })} />
                  </dd>
                </div>
              ) : null}
              {opened.indicativePrices ? (
                <div>
                  <dt>{t("indicativePrices")}</dt>
                  <dd className="vendor-prices">{opened.indicativePrices}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
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
