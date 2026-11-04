// Lot 11 (PRE-04 à PRE-07, PRE-10, PRE-11) — carnet de prestataires : filtres,
// carte et liste du plus proche au plus loin, « Ajouter au poste », export.
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
      href: `/prestataires/${vendor.id}`,
    }));
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
          <Link href={`/events/${target.eventId}?onglet=prestataires&poste=${target.slotId}`}>{t("targetBack")}</Link>
        </section>
      ) : null}

      <nav aria-label={t("typesFilter")} className="pills" data-tour="vendor-types">
        <Link href={typeHref(null)} aria-current={filters.typeId === null ? "true" : undefined}>
          {t("allTypes")}
        </Link>
        {types.map((type) => (
          <Link key={type.id} href={typeHref(type.id)} aria-current={filters.typeId === type.id ? "true" : undefined}>
            {type.label}
          </Link>
        ))}
      </nav>

      <form method="get" action="/prestataires" className="card" aria-label={t("filtersLabel")} data-tour="vendor-filters">
        {filters.typeId ? <input type="hidden" name="type" value={filters.typeId} /> : null}
        {filters.eventId ? <input type="hidden" name="evenement" value={filters.eventId} /> : null}
        {filters.slotId ? <input type="hidden" name="poste" value={filters.slotId} /> : null}
        <div className="vendor-filters">
          <label>
            {t("filterText")}
            <input type="search" name="q" defaultValue={filters.text} />
          </label>
          <label>
            {t("filterAround")}
            <input type="text" name="autour" defaultValue={filters.aroundText.startsWith("fiche:") ? "" : filters.aroundText} placeholder={t("filterAroundPlaceholder")} />
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
            .map((field) =>
              field.kind === "boolean" || field.kind === "choice" || field.kind === "text" ? (
                <label key={field.id}>
                  {field.label}
                  {field.kind === "text" ? (
                    <input type="text" name={`eq_${field.id}`} defaultValue={filters.fieldInputs[`eq_${field.id}`] ?? ""} />
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
                </label>
              ) : (
                <div key={field.id} className="range-filter">
                  <label>
                    {t("fieldMin", { label: field.label })}
                    <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" name={`min_${field.id}`} defaultValue={filters.fieldInputs[`min_${field.id}`] ?? ""} />
                  </label>
                  <label>
                    {t("fieldMax", { label: field.label })}
                    <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" name={`max_${field.id}`} defaultValue={filters.fieldInputs[`max_${field.id}`] ?? ""} />
                  </label>
                </div>
              ),
            )}
          <label className="checkbox">
            <input type="checkbox" name="deja" value="1" defaultChecked={filters.workedWith} />
            {t("filterWorkedWith")}
          </label>
          <button type="submit">{t("filterApply")}</button>
        </div>
        {centerNotFound ? <p role="status">{t("centerNotFound")}</p> : null}
      </form>

      <div className="vendor-book">
        <VendorMap
          points={points}
          assets={assets}
          around={center ? { latitude: center.latitude, longitude: center.longitude, radiusKm: filters.radiusKm } : null}
          label={t("mapLabel", { count: points.length })}
          missingTilesNotice={t("mapNoTiles")}
        />
        <section className="card" aria-labelledby="results-title" data-tour="vendor-results">
          <div className="section-head">
            <h2 id="results-title">{center ? t("resultsByDistance", { count: results.length, place: center.label }) : t("results", { count: results.length })}</h2>
          </div>
          <p className="meta">
            <a href={`/prestataires/export${queryString(query, { format: "csv" })}`}>{t("exportCsv")}</a>
            <a href={`/prestataires/export${queryString(query, { format: "pdf" })}`}>{t("exportPdf")}</a>
          </p>
          {results.length === 0 ? <p>{types.length === 0 ? t("emptyNoTypes") : t("empty")}</p> : null}
          <ul className="vendor-results">
            {results.map((vendor) => {
              const type = vendor.typeId ? typeById.get(vendor.typeId) : undefined;
              return (
                <li key={vendor.id}>
                  <Link href={`/prestataires/${vendor.id}`} className="strong">
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
      </div>
    </main>
  );
}
