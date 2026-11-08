// Lot 11 (PRE-01, PRE-03, PRE-09) — fiche d'un prestataire : coordonnées et
// caractéristiques (modifiables), fichiers, point sur la carte, historique
// avec l'organisation (consultations, issue, prix devisé et final).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { getVendor, getVendorHistory, listVendorFamilies, listVendorTags, listVendorTypes } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { mapAssets } from "@/lib/map/tiles";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isValidId } from "@/app/events/module-access";
import { archiveVendorAction, removeVendorFileAction } from "../actions";
import { isVendorsModuleEnabled } from "../module-access";
import { ImportedFields } from "@/app/imported-fields";
import { VendorForm } from "../vendor-form";
import { VendorMap } from "../vendor-map";
import { VendorFileForm, VendorLocationForm } from "./vendor-side-forms";

const OUTCOME_KEYS = { selected: "outcomeSelected", not_selected: "outcomeNotSelected", pending: "outcomePending" } as const;
const OUTCOME_CLASSES = { selected: "badge badge-sauge", not_selected: "badge", pending: "badge badge-ambre" } as const;

export default async function VendorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placement?: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
  if (!(await isVendorsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const { id } = await params;
  if (!isValidId(id)) notFound();
  const vendor = await getVendor(organizationId, id);
  if (!vendor) notFound();
  const [types, tags, history, assets, budget, families] = await Promise.all([
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    isBudgetModuleEnabled(organizationId).then((enabled) => getVendorHistory(organizationId, id, { budget: enabled })),
    mapAssets(),
    isBudgetModuleEnabled(organizationId),
    listVendorFamilies(organizationId),
  ]);
  const locale = (await getLocale()) as Locale;
  const placement = (await searchParams).placement;
  const type = types.find((candidate) => candidate.id === vendor.typeId);
  const vendorTags = tags.filter((tag) => vendor.tagIds.includes(tag.id));
  const amount = (cents: number | null) => (cents === null ? "—" : formatAmount(cents, locale));

  return (
    <main>
      <p>
        <Link href="/prestataires">{t("backToBook")}</Link>
      </p>
      <div className="title-with-badge">
        <h1>{vendor.name}</h1>
        {type ? <span className="badge badge-sauge">{type.label}</span> : null}
        {vendorTags.map((tag) => (
          <span key={tag.id} className="badge">
            {tag.label}
          </span>
        ))}
        {vendor.archived ? <span className="badge">{t("archived")}</span> : null}
      </div>
      {placement === "placed" ? <p role="status">{t("geocodingPlaced")}</p> : null}
      {placement === "not_found" ? <p role="status">{t("geocodingNotFound")}</p> : null}
      <p className="toolbar">
        {vendor.location ? (
          <Link className="button-link" href={`/prestataires?autour=fiche:${vendor.id}`}>
            {t("searchAround", { vendor: vendor.name })}
          </Link>
        ) : null}
      </p>

      <section className="card" aria-labelledby="history-title">
        <div className="section-head">
          <h2 id="history-title">{t("historyTitle")}</h2>
          {history.averageFinalCents !== null ? <span className="meta">{t("averagePrice", { amount: amount(history.averageFinalCents) })}</span> : null}
        </div>
        {history.entries.length === 0 ? <p>{t("historyEmpty")}</p> : null}
        {history.entries.length > 0 ? (
          <div role="region" aria-label={t("historyTitle")} tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("historyEvent")}</th>
                  <th scope="col">{t("historyDate")}</th>
                  <th scope="col">{t("historySlot")}</th>
                  <th scope="col">{t("historyOutcome")}</th>
                  <th scope="col" className="num">
                    {t("historyQuoted")}
                  </th>
                  {budget ? (
                    <th scope="col" className="num">
                      {t("historyFinal")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={`${entry.eventId}-${entry.slotLabel}`}>
                    <th scope="row">
                      <Link href={`/events/${entry.eventId}?onglet=budget`}>{entry.eventNames || t("historyUnnamed")}</Link>
                    </th>
                    <td>{entry.eventDate ? formatCalendarDate(entry.eventDate, locale) : "—"}</td>
                    <td>{entry.slotLabel}</td>
                    <td>
                      <span className={OUTCOME_CLASSES[entry.outcome]}>{t(OUTCOME_KEYS[entry.outcome])}</span>
                    </td>
                    <td className="num">{amount(entry.quotedCents)}</td>
                    {budget ? <td className="num">{amount(entry.finalCents)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="card" aria-labelledby="details-title">
        <h2 id="details-title">{t("detailsTitle")}</h2>
        {vendor.website || vendor.socialLinks.length > 0 ? (
          <ul className="vendor-links" aria-label={t("links")}>
            {vendor.website ? (
              <li>
                <a href={vendor.website} target="_blank" rel="noopener noreferrer nofollow">
                  {t("website")}
                </a>
              </li>
            ) : null}
            {vendor.socialLinks.map((link) => (
              <li key={link.network}>
                <a href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                  {t(`social.${link.network}`)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <VendorForm key={JSON.stringify(vendor)} types={types} tags={tags} families={families} vendor={vendor} />
        <ImportedFields fields={vendor.importedFields ?? undefined} />
      </section>

      <section className="card" aria-labelledby="files-title">
        <h2 id="files-title">{t("filesTitle")}</h2>
        {vendor.files.length === 0 ? <p>{t("filesEmpty")}</p> : null}
        <ul>
          {vendor.files.map((file) => (
            <li key={file.id}>
              <span className="badge">{file.kind === "rib" ? t("fileRib") : t("fileBrochure")}</span>{" "}
              <a href={`/prestataires/${vendor.id}/fichiers/${file.id}`}>{file.fileName}</a>
              <form action={removeVendorFileAction} className="inline-form">
                <input type="hidden" name="vendorId" value={vendor.id} />
                <input type="hidden" name="fileId" value={file.id} />
                <button type="submit">{t("fileRemove", { name: file.fileName })}</button>
              </form>
            </li>
          ))}
        </ul>
        <p className="muted">{t("filesHint")}</p>
        <VendorFileForm vendorId={vendor.id} />
      </section>

      <section className="card" aria-labelledby="point-title">
        <h2 id="point-title">{t("pointTitle")}</h2>
        <p>{vendor.location ? (vendor.location.source === "manual" ? t("pointManual") : t("pointGeocoded")) : t("pointMissing")}</p>
        <VendorMap
          points={vendor.location ? [{ id: vendor.id, name: vendor.name, latitude: vendor.location.latitude, longitude: vendor.location.longitude, color: type?.color ?? "#5e5a52", href: `/prestataires/${vendor.id}` }] : []}
          assets={assets}
          label={t("pointMapLabel", { vendor: vendor.name })}
          missingTilesNotice={t("mapNoTiles")}
          controls={{ zoomIn: t("mapZoomIn"), zoomOut: t("mapZoomOut") }}
          pick={{ latitudeInputId: "vendor-latitude", longitudeInputId: "vendor-longitude" }}
        />
        <p className="muted">{t("pointHint")}</p>
        <VendorLocationForm vendorId={vendor.id} latitude={vendor.location?.latitude ?? null} longitude={vendor.location?.longitude ?? null} />
      </section>

      {!vendor.archived ? (
        <form action={archiveVendorAction}>
          <input type="hidden" name="vendorId" value={vendor.id} />
          <button type="submit">{t("archive", { vendor: vendor.name })}</button>
        </form>
      ) : null}
    </main>
  );
}
