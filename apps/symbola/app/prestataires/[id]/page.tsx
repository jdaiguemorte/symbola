// Lot 11 (L11-PRE-01, L11-PRE-03, L11-PRE-09) — fiche d'un prestataire : coordonnées et
// caractéristiques (modifiables), fichiers, point sur la carte, historique
// avec l'organisation (consultations, issue, prix devisé et final).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import {
  ConfidentialNoteForbiddenError,
  ensureVenueRuleFields,
  getVendor,
  getVendorHistory,
  getVendorCollaborationHistory,
  listVendorBankChanges,
  listVendorDocumentKinds,
  listVendorDocuments,
  listVendorFamilies,
  listVendorTagGroups,
  listVendorTags,
  listVendorTypes,
  readVendorConfidentialNote,
} from "@/modules/vendors/service";
import { listTeam } from "@symbola/auth";
import { getEventNamesByIds } from "@/modules/events/service";
import { appDatabase } from "@symbola/db/client";
import { VendorBankForm, VendorDocumentRequestForm, VendorDocumentUploadForm, VendorDocumentValidityForm, VendorNoteForm } from "./vendor-records";
import { removeVendorDocumentAction, verifyVendorBankAction, verifyVendorDocumentAction } from "./records-actions";
import { requirePlanner } from "@/lib/guards";
import { mapAssets } from "@/lib/map/tiles";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isValidId } from "@/app/events/module-access";
import { archiveVendorAction, removeVendorFileAction } from "../actions";
import { isVendorsModuleEnabled } from "../module-access";
import { ImportedFields } from "@/app/imported-fields";
import { VendorForm } from "../vendor-form";
import { VendorMap } from "../vendor-map";
import { VendorFileForm, VendorLocationForm } from "./vendor-side-forms";
import { ScreenHelp } from "@/app/screen-help";
import { SidePanel } from "@/app/ui/side-panel";
import { RatingStars } from "../rating-stars";

const OUTCOME_KEYS = { selected: "outcomeSelected", not_selected: "outcomeNotSelected", pending: "outcomePending" } as const;
const OUTCOME_CLASSES = { selected: "badge badge-sauge", not_selected: "badge", pending: "badge badge-ambre" } as const;

export default async function VendorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placement?: string; modifier?: string }> }) {
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
  const { id } = await params;
  if (!isValidId(id)) notFound();
  const locale = (await getLocale()) as Locale;
  // Lot 48a (PRE-06) : les champs de lieu porteurs d'une règle, posés une fois.
  await ensureVenueRuleFields(organizationId, locale === "en" ? "en" : "fr");
  const vendor = await getVendor(organizationId, id);
  if (!vendor) notFound();
  const tRecords = await getTranslations("VendorRecords");
  const viewer = { userId: auth.user.id, role: auth.user.role };
  const [documents, documentKinds, bankChanges, team, confidentialNote] = await Promise.all([
    listVendorDocuments(organizationId, id),
    listVendorDocumentKinds(organizationId, locale === "en" ? "en" : "fr"),
    listVendorBankChanges(organizationId, id),
    listTeam(appDatabase(), organizationId),
    vendor.internalNoteConfidential
      ? readVendorConfidentialNote(organizationId, id, viewer).catch((error: unknown) => {
          if (error instanceof ConfidentialNoteForbiddenError) return null;
          throw error;
        })
      : Promise.resolve(null),
  ]);
  const noteReadable = !vendor.internalNoteConfidential || confidentialNote !== null;
  // Le journal nomme sans donnée personnelle : vous, la titulaire, ou un membre de l'équipe.
  const memberName = (userId: string | null) =>
    userId === auth.user.id ? tRecords("byYou") : team.find((member) => member.id === userId)?.role === "owner" ? tRecords("byOwner") : tRecords("byMember");
  // Lot 58 (PRE-08) : évaluations après les évènements et noms de ces évènements (module events).
  const collaborations = await getVendorCollaborationHistory(organizationId, id);
  const evaluatedEvents = await getEventNamesByIds(organizationId, collaborations.evaluations.map((evaluation) => evaluation.eventId));
  const [types, tags, history, assets, budget, families, tagGroups] = await Promise.all([
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    isBudgetModuleEnabled(organizationId).then((enabled) => getVendorHistory(organizationId, id, { budget: enabled })),
    mapAssets(),
    isBudgetModuleEnabled(organizationId),
    listVendorFamilies(organizationId),
    listVendorTagGroups(organizationId),
  ]);
  const tCommon = await getTranslations("Common");
  const query = await searchParams;
  const placement = query.placement;
  // Lot 39c (UX-13, relevé validé le 17/11) : la fiche se lit dans la page, se modifie en panneau.
  const editing = query.modifier === "1";
  const vendorHref = `/prestataires/${vendor.id}`;
  const type = types.find((candidate) => candidate.id === vendor.typeId);
  const vendorTags = tags.filter((tag) => vendor.tagIds.includes(tag.id));
  const amount = (cents: number | null) => (cents === null ? "—" : formatAmount(cents, locale));
  const family = type ? families.find((candidate) => candidate.id === type.familyId) : undefined;
  const address = [vendor.addressLine, [vendor.postalCode, vendor.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const typedFields = type ? type.fields.filter((field) => vendor.fieldValues[field.id] !== undefined && vendor.fieldValues[field.id] !== null && vendor.fieldValues[field.id] !== "") : [];
  const fieldText = (kind: string, value: unknown) =>
    kind === "boolean" ? t(value === true ? "fieldYes" : "fieldNo") : kind === "amount" && typeof value === "number" ? formatAmount(value, locale) : String(value);

  return (
    <main>
      <p>
        <Link href="/prestataires">{t("backToBook")}</Link>
      </p>
      <div className="title-with-badge">
        <h1>{vendor.name}</h1>
        <ScreenHelp title={tHelp("vendorDetail.title")} body={tHelp("vendorDetail.body")} />
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
          <div role="region" aria-label={t("historyTable")} tabIndex={0}>
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

      {/* Lot 58 (PRE-08 ; ADR 0097) : historique des collaborations, interne (jamais au client, au
          prestataire ni au comptable) ; il reprend l'évaluation générale de la fiche (lot 28c). */}
      <section className="card stack" aria-labelledby="evaluations-title">
        <h2 id="evaluations-title">{t("evaluationsTitle")}</h2>
        <p className="muted">{t("evaluationsHelp")}</p>
        {collaborations.count > 0 ? (
          <p>{t("evaluationsAverage", { average: ((collaborations.averageTenths ?? 0) / 10).toLocaleString(locale), count: collaborations.count, date: formatCalendarDate(collaborations.lastEvaluatedAt!.slice(0, 10), locale) })}</p>
        ) : (
          <p>{t("evaluationsEmpty")}</p>
        )}
        {vendor.rating !== null ? <p className="muted">{t("evaluationsCardRating", { rating: vendor.rating })}</p> : null}
        <ul className="plain-list stack">
          {collaborations.evaluations.map((evaluation) => (
            <li key={evaluation.id}>
              <Link href={`/events/${evaluation.eventId}/cloture`}>{t("evaluationsEntry", { event: evaluatedEvents[evaluation.eventId] || t("evaluationsUnknownEvent"), rating: evaluation.rating })}</Link>
              {evaluation.punctuality !== null || evaluation.quality !== null || evaluation.value !== null ? (
                <span className="meta"> · {t("evaluationsCriteria", { punctuality: evaluation.punctuality ?? "—", quality: evaluation.quality ?? "—", value: evaluation.value ?? "—" })}</span>
              ) : null}
              {evaluation.comment ? <p className="task-comment-body">{evaluation.comment}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="details-title">
        <div className="section-head">
          <h2 id="details-title">{t("detailsTitle")}</h2>
          <Link className="button-link" href={`${vendorHref}?modifier=1`} scroll={false}>
            {t("editRecord")}
          </Link>
        </div>
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
        <dl className="vendor-summary">
          <div>
            <dt>{t("summaryType")}</dt>
            <dd>{type ? (family ? t("typeInFamily", { family: family.label, type: type.label }) : type.label) : "—"}</dd>
          </div>
          <div>
            <dt>{t("summaryContact")}</dt>
            <dd>{vendor.contactName ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("summaryPhone")}</dt>
            <dd>{vendor.phone ? <a href={`tel:${vendor.phone}`}>{vendor.phone}</a> : "—"}</dd>
          </div>
          <div>
            <dt>{t("summaryEmail")}</dt>
            <dd>{vendor.email ? <a href={`mailto:${vendor.email}`}>{vendor.email}</a> : "—"}</dd>
          </div>
          <div>
            <dt>{t("summaryAddress")}</dt>
            <dd>{address || "—"}</dd>
          </div>
          <div>
            <dt>{t("siret")}</dt>
            <dd>{vendor.siret ?? "—"}</dd>
          </div>
          {typedFields.map((field) => (
            <div key={field.id}>
              <dt>{field.label}</dt>
              <dd>{fieldText(field.kind, vendor.fieldValues[field.id])}</dd>
            </div>
          ))}
          <div>
            <dt>{t("rating")}</dt>
            <dd>{vendor.rating ? <RatingStars rating={vendor.rating} label={t("ratingValue", { rating: vendor.rating })} /> : "—"}</dd>
          </div>
          <div>
            <dt>{t("indicativePrices")}</dt>
            <dd className="vendor-prices">{vendor.indicativePrices ?? "—"}</dd>
          </div>

        </dl>
        <ImportedFields fields={vendor.importedFields ?? undefined} />
      </section>

      {/* Lot 48a (PRE-10, SEC-27) : IBAN masqué, bandeau « à vérifier par un autre canal » tant que la
          planner ne l'a pas levé, journal des changements. */}
      <section className="card" aria-labelledby="bank-title">
        <h2 id="bank-title">{tRecords("bankTitle")}</h2>
        {vendor.bank.pendingCheck ? (
          <div className="bank-check-banner" role="alert">
            <p>
              <strong>{tRecords("bankCheckTitle")}</strong>
            </p>
            <p>
              {tRecords(vendor.bank.pendingCheck.changedBy === "vendor" ? "bankCheckByVendor" : "bankCheckByPlanner", {
                date: formatCalendarDate(vendor.bank.pendingCheck.changedAt.slice(0, 10), locale),
              })}
            </p>
            <p>{vendor.phone ? tRecords("bankCheckCall", { phone: vendor.phone }) : tRecords("bankCheckCallNoPhone")}</p>
            <form action={verifyVendorBankAction}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <button type="submit">{tRecords("bankCheckLift")}</button>
            </form>
          </div>
        ) : null}
        <dl className="vendor-summary">
          <div>
            <dt>{tRecords("iban")}</dt>
            <dd>
              {vendor.bank.ibanMasked ?? "—"}
              {vendor.bank.pendingCheck ? <span className="badge badge-warning">{tRecords("toVerify")}</span> : null}
            </dd>
          </div>
          <div>
            <dt>{tRecords("bic")}</dt>
            <dd>{vendor.bank.hasBic ? tRecords("bicSet") : "—"}</dd>
          </div>
        </dl>
        <VendorBankForm vendorId={vendor.id} hasIban={vendor.bank.ibanMasked !== null} />
        {bankChanges.length > 0 ? (
          <details>
            <summary>{tRecords("bankHistory", { count: bankChanges.length })}</summary>
            <ul>
              {bankChanges.map((change) => (
                <li key={change.id}>
                  {tRecords("bankHistoryLine", {
                    date: formatCalendarDate(change.changedAt.slice(0, 10), locale),
                    who: change.changedBy.kind === "vendor" ? tRecords("byVendorLink") : memberName(change.changedBy.userId),
                    before: change.previousMasked ?? "—",
                    after: change.nextMasked ?? "—",
                  })}{" "}
                  {change.verifiedAt
                    ? tRecords("bankHistoryVerified", { date: formatCalendarDate(change.verifiedAt.slice(0, 10), locale), who: memberName(change.verifiedByUserId) })
                    : tRecords("bankHistoryPending")}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* Lot 48a (PRE-05, D3) : pièces à échéance, déposées par la planner ou demandées au prestataire. */}
      <section className="card" aria-labelledby="documents-title">
        <h2 id="documents-title">{tRecords("documentsTitle")}</h2>
        {documents.length === 0 ? <p>{tRecords("documentsEmpty")}</p> : null}
        {documents.length > 0 ? (
          <ul className="vendor-documents">
            {documents.map((document) => (
              <li key={document.id}>
                <span className="badge">{document.kindLabel}</span>{" "}
                {document.fileName ? <a href={`/prestataires/${vendor.id}/pieces/${document.id}`}>{document.fileName}</a> : <span>{tRecords("documentRequested")}</span>}{" "}
                {document.status === "to_verify" ? <span className="badge badge-warning">{tRecords("documentToVerify")}</span> : null}
                {document.alert === "expired" ? <span className="badge badge-terracotta">{tRecords("documentExpired")}</span> : null}
                {document.alert === "expiring" ? <span className="badge badge-ambre">{tRecords("documentExpiring")}</span> : null}
                {document.validUntil ? <span className="meta"> {tRecords("validUntilShort", { date: formatCalendarDate(document.validUntil, locale) })}</span> : null}
                {document.status !== "requested" ? (
                  <VendorDocumentValidityForm vendorId={vendor.id} documentId={document.id} validUntil={document.validUntil} label={document.kindLabel} />
                ) : null}
                {document.status === "to_verify" ? (
                  <form action={verifyVendorDocumentAction} className="inline-form">
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button type="submit">{tRecords("documentVerify", { document: document.kindLabel })}</button>
                  </form>
                ) : null}
                <form action={removeVendorDocumentAction} className="inline-form">
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit">{tRecords("documentRemove", { document: document.kindLabel })}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <VendorDocumentUploadForm vendorId={vendor.id} kinds={documentKinds} />
        <p className="muted">{tRecords("requestHint")}</p>
        <VendorDocumentRequestForm vendorId={vendor.id} kinds={documentKinds} />
      </section>

      {/* Lot 48a (DAT-08) : note interne, éventuellement confidentielle (chiffrée). */}
      <section className="card" aria-labelledby="note-title">
        <h2 id="note-title">{tRecords("noteTitle")}</h2>
        {noteReadable ? (
          <VendorNoteForm vendorId={vendor.id} note={vendor.internalNoteConfidential ? confidentialNote : vendor.internalNote} confidential={vendor.internalNoteConfidential !== null} />
        ) : (
          <p className="muted">{tRecords("noteHidden")}</p>
        )}
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
        // Lot 39a (UX-07 ; D6) : l'archivage s'annule pendant dix secondes (comme depuis le carnet) :
        // plus de confirmation.
        <form action={archiveVendorAction}>
          <input type="hidden" name="vendorId" value={vendor.id} />
          <button type="submit">{t("archive", { vendor: vendor.name })}</button>
        </form>
      ) : null}
      {editing ? (
        <SidePanel title={t("editRecord")} closeHref={vendorHref} closeLabel={tCommon("closePanel")}>
          <VendorForm key={JSON.stringify(vendor)} types={types} tags={tags} tagGroups={tagGroups} families={families} vendor={vendor} />
        </SidePanel>
      ) : null}
    </main>
  );
}
