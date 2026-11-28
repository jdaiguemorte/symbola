// Lot 11 (L11-PRE-01, L11-PRE-03, L11-PRE-09) — fiche d'un prestataire. Lot 73d (PRE-01, PRE-05, PRE-08,
// PRE-10, DAT-08 ; spécification du lot 73, § 5.4, critères 6 à 11 ; V11, P3, P4, P9 ; C-48 ; maquette 20,
// « La fiche », « Une fiche neuve ») : une fiche qui tient en un écran et demi.
//
// - L'en-tête en 200 px : retour « Prestataires », le nom, « métier · ville · N mariages avec vous · note
//   sur 5 » et ses étiquettes, le contact cliquable, « Ajouter à un mariage… » (le seul bouton plein) et le
//   menu « ⋯ » (Modifier, Chercher autour, à part Archiver…).
// - Les alertes juste dessous : une pièce à renouveler, une pièce qui finit avant un mariage où il est
//   retenu (avec « Demander au prestataire »), un IBAN changé (« J'ai vérifié par téléphone »).
// - À gauche ce qui sert à choisir : « Avec vous » (les deux historiques d'avant réunis, une seule colonne
//   « Montant », juste) et « Pièces » ; à droite ce qui se consulte : « Caractéristiques », « Paiement et
//   fichiers », « Note interne », les plans de salle d'un lieu, le point sur la carte.
// - Une valeur absente dit pourquoi ou quoi faire, jamais « — » ; une fiche neuve propose les pièces
//   demandées d'habitude en un bouton.
// Rien de ce que faisait la fiche d'avant ne disparaît (critère 11) : plans de salle, point sur la carte,
// note confidentielle et sa règle d'accès, fichiers, journal de l'IBAN, « Chercher autour ».
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import {
  ConfidentialNoteForbiddenError,
  ensureVenueRuleFields,
  getVendor,
  getVendorCollaborationHistory,
  getVendorHistory,
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
import { getEventNamesByIds, listUpcomingRetainedEventsByVendor } from "@/modules/events/service";
import { appDatabase } from "@symbola/db/client";
import { requirePlanner } from "@/lib/guards";
import { mapAssets } from "@/lib/map/tiles";
import { vendorRequestReach } from "@/lib/vendors/vendor-sheet";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { ImportedFields } from "@/app/imported-fields";
import { ScreenHelp } from "@/app/screen-help";
import { isFloorplansAvailable } from "@/app/plans-de-salle/access";
import { AddToEventButton } from "../add-to-event-button";
import { removeVendorFileAction } from "../actions";
import { isVendorsModuleEnabled } from "../module-access";
import { RatingStars } from "../rating-stars";
import { VendorCreateDialog } from "../vendor-create-dialog";
import { VendorMap } from "../vendor-map";
import { removeVendorDocumentAction, verifyVendorBankAction, verifyVendorDocumentAction } from "./records-actions";
import { VendorBankForm, VendorDocumentUploadForm, VendorDocumentValidityForm, VendorNoteForm } from "./vendor-records";
import { RequestDocumentButton, RequestUsualButton, SheetMenu } from "./vendor-sheet-parts";
import { VendorFileForm, VendorLocationForm } from "./vendor-side-forms";
import { documentsToSettle, kindName, sheetAlerts, sheetFacts, sheetHistoryRows, usualKindsToRequest, type SheetFact, type SheetHistoryRow } from "./vendor-sheet-model";

export default async function VendorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placement?: string; modifier?: string; details?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
  const tSheet = await getTranslations("VendorSheet");
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
  const starterLocale = locale === "en" ? "en" : "fr";
  // Lot 48a (PRE-06) : les champs de lieu porteurs d'une règle, posés une fois.
  await ensureVenueRuleFields(organizationId, starterLocale);
  const vendor = await getVendor(organizationId, id);
  if (!vendor) notFound();
  const tRecords = await getTranslations("VendorRecords");
  const viewer = { userId: auth.user.id, role: auth.user.role };
  const today = parisToday(new Date());
  const [budget, eventsEnabled] = await Promise.all([isBudgetModuleEnabled(organizationId), isEventsModuleEnabled(organizationId)]);
  const [documents, documentKinds, bankChanges, team, confidentialNote, collaborations, types, tags, history, assets, families, tagGroups, floorplans, retainedByVendor, reach] = await Promise.all([
    listVendorDocuments(organizationId, id),
    listVendorDocumentKinds(organizationId, starterLocale),
    listVendorBankChanges(organizationId, id),
    listTeam(appDatabase(), organizationId),
    vendor.internalNoteConfidential
      ? readVendorConfidentialNote(organizationId, id, viewer).catch((error: unknown) => {
          if (error instanceof ConfidentialNoteForbiddenError) return null;
          throw error;
        })
      : Promise.resolve(null),
    getVendorCollaborationHistory(organizationId, id),
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    getVendorHistory(organizationId, id, { budget }),
    mapAssets(),
    listVendorFamilies(organizationId),
    listVendorTagGroups(organizationId),
    isFloorplansAvailable(organizationId, "vendors"),
    eventsEnabled ? listUpcomingRetainedEventsByVendor(organizationId, [id], today) : Promise.resolve(new Map()),
    vendorRequestReach(organizationId, id),
  ]);
  const evaluatedEvents = await getEventNamesByIds(organizationId, collaborations.evaluations.map((evaluation) => evaluation.eventId));
  const noteReadable = !vendor.internalNoteConfidential || confidentialNote !== null;
  // Le journal nomme sans donnée personnelle : vous, la titulaire, ou un membre de l'équipe.
  const memberName = (userId: string | null) =>
    userId === auth.user.id ? tRecords("byYou") : team.find((member) => member.id === userId)?.role === "owner" ? tRecords("byOwner") : tRecords("byMember");
  const query = await searchParams;
  const placement = query.placement;
  const editing = query.modifier === "1";
  const vendorHref = `/prestataires/${vendor.id}`;
  const editHref = `${vendorHref}?modifier=1&details=1`;
  // Lot 63e (PRE-01 ; ADR 0105) : les métiers de la fiche, le principal en premier.
  const trades = vendor.typeIds.map((typeId) => types.find((candidate) => candidate.id === typeId)).filter((candidate): candidate is (typeof types)[number] => Boolean(candidate));
  const type = trades[0];
  const vendorTags = tags.filter((tag) => vendor.tagIds.includes(tag.id));
  const money = (cents: number) => formatAmount(cents, locale);
  const day = (value: string) => formatCalendarDate(value, locale);
  const typedFields = trades.flatMap((trade) => trade.fields).filter((field) => vendor.fieldValues[field.id] !== undefined && vendor.fieldValues[field.id] !== null && vendor.fieldValues[field.id] !== "");
  const fieldText = (kind: string, value: unknown) => (kind === "boolean" ? t(value === true ? "fieldYes" : "fieldNo") : kind === "amount" && typeof value === "number" ? formatAmount(value, locale) : String(value));

  // « Avec vous » : les deux historiques réunis, un mariage par ligne (critère 8).
  const ratings = new Map(collaborations.evaluations.map((evaluation) => [evaluation.eventId, evaluation.rating]));
  const rows = sheetHistoryRows(history.entries, ratings, today);
  const weddingsTogether = new Set(history.entries.filter((entry) => entry.outcome === "selected").map((entry) => entry.eventId)).size;
  const average = collaborations.count > 0 ? (collaborations.averageTenths ?? 0) / 10 : null;
  const headerRating = average ?? vendor.rating;
  const ratingText = (value: number) => tSheet("facts.rating", { rating: value.toLocaleString(locale, { maximumFractionDigits: 1 }) });
  const coupleOf = new Map(history.entries.map((entry) => [entry.eventId, entry.eventNames]));
  const retainedEvents = retainedByVendor.get(id) ?? [];
  const alerts = sheetAlerts({ documents, retainedEvents, today, ibanPending: vendor.bank.pendingCheck !== null });
  const usualKinds = usualKindsToRequest(documentKinds, documents, today);
  const usualNames = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(usualKinds.map(kindName));
  const settle = documentsToSettle(documents, today);
  const facts = sheetFacts(vendor);
  const searchAroundHref = vendor.location ? `/prestataires?autour=fiche:${vendor.id}` : null;

  const factLine = [
    trades.length > 0 ? trades[0]!.label : tSheet("facts.unclassified"),
    vendor.city ?? tSheet("facts.noCity"),
    tSheet("facts.worked", { count: weddingsTogether }),
    headerRating !== null ? ratingText(headerRating) : null,
  ].filter((part): part is string => part !== null);

  const missing = (field: "contactField" | "phoneField" | "emailField") => (
    <span className="vendor-sheet-missing">
      {tSheet("contact.missing", { field: tSheet(`contact.${field}`) })}{" "}
      <Link href={editHref} scroll={false}>
        {tSheet("missing.add")}
        <span className="sr-only"> — {tSheet(`contact.${field}`)}</span>
      </Link>
    </span>
  );

  const factValue = (fact: SheetFact) => {
    if ("missing" in fact) {
      return (
        <span className="vendor-sheet-missing">
          {tSheet(`missing.${fact.missing}` as Parameters<typeof tSheet>[0])}
          {fact.add ? (
            <>
              {" · "}
              <Link href={editHref} scroll={false}>
                {tSheet("missing.add")}
                <span className="sr-only"> — {tSheet(`characteristics.${fact.key}` as Parameters<typeof tSheet>[0])}</span>
              </Link>
            </>
          ) : null}
        </span>
      );
    }
    if (fact.key === "rating" && vendor.rating) return <RatingStars rating={vendor.rating} label={t("ratingValue", { rating: vendor.rating })} />;
    if (fact.key === "website")
      return (
        <a href={fact.value} target="_blank" rel="noopener noreferrer nofollow">
          {fact.value.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      );
    if (fact.key === "prices") return <span className="vendor-prices">{fact.value}</span>;
    return fact.value;
  };

  const amountCell = (row: SheetHistoryRow) =>
    row.amount.kind === "amount" ? money(row.amount.cents) : row.amount.kind === "quote" ? tSheet("withYou.quote", { amount: money(row.amount.cents) }) : <span className="meta">{tSheet("withYou.noAmount")}</span>;
  const ratingCell = (row: SheetHistoryRow) =>
    row.rating.kind === "rated" ? tSheet("withYou.rated", { rating: row.rating.rating }) : row.rating.kind === "afterDay" ? <span className="meta">{tSheet("withYou.afterDay")}</span> : row.rating.kind === "notRated" ? <span className="meta">{tSheet("withYou.notRated")}</span> : null;

  return (
    <main className="vendor-sheet">
      <header className="vendor-sheet-head" aria-labelledby="vendor-sheet-title">
        <p className="vendor-sheet-back">
          <Link href="/prestataires">‹ {tSheet("back")}</Link>
        </p>
        <div className="vendor-sheet-identity">
          <div className="title-with-badge">
            <h1 id="vendor-sheet-title">{vendor.name}</h1>
            <ScreenHelp title={tHelp("vendorDetail.title")} body={tHelp("vendorDetail.body")} />
            {vendor.archived ? <span className="badge">{t("archived")}</span> : null}
          </div>
          <p className="meta vendor-sheet-facts">
            {factLine.join(" · ")}
            {vendorTags.map((tag) => (
              <span key={tag.id} className="badge">
                {tag.label}
              </span>
            ))}
          </p>
          <ul className="vendor-sheet-contact" aria-label={tSheet("contact.label")}>
            <li>{vendor.contactName ?? missing("contactField")}</li>
            <li>{vendor.phone ? <a href={`tel:${vendor.phone}`}>{vendor.phone}</a> : missing("phoneField")}</li>
            <li>{vendor.email ? <a href={`mailto:${vendor.email}`}>{vendor.email}</a> : missing("emailField")}</li>
            {vendor.addressLine || vendor.postalCode ? <li>{[vendor.addressLine, [vendor.postalCode, vendor.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</li> : null}
          </ul>
        </div>
        <div className="page-actions vendor-sheet-actions">
          {/* Lot 73c (critère 1) : la même fenêtre que le carnet ; sans le module Évènements, rien (ARC-06). */}
          {!vendor.archived && eventsEnabled ? <AddToEventButton vendorId={vendor.id} vendorName={vendor.name} primary /> : null}
          <SheetMenu vendorId={vendor.id} vendorName={vendor.name} searchAroundHref={searchAroundHref} archived={vendor.archived} />
        </div>
      </header>
      {placement === "placed" ? <p role="status">{t("geocodingPlaced")}</p> : null}
      {placement === "not_found" ? <p role="status">{t("geocodingNotFound")}</p> : null}

      {alerts.length > 0 ? (
        <ul className="vendor-sheet-alerts" aria-label={tSheet("alerts.label")}>
          {alerts.map((alert) =>
            alert.kind === "iban" ? (
              <li key="iban" className="notice notice-attention" role="alert">
                <span className="vendor-sheet-alert-icon" aria-hidden="true">
                  !
                </span>
                <span>
                  <strong>{tSheet("alerts.iban")}</strong>{" "}
                  {tRecords(vendor.bank.pendingCheck!.changedBy === "vendor" ? "bankCheckByVendor" : "bankCheckByPlanner", { date: day(vendor.bank.pendingCheck!.changedAt.slice(0, 10)) })}{" "}
                  {vendor.phone ? tRecords("bankCheckCall", { phone: vendor.phone }) : tRecords("bankCheckCallNoPhone")}
                </span>
                <form action={verifyVendorBankAction} className="inline-form">
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <button type="submit" className="button-secondary">
                    {tSheet("alerts.ibanVerify")}
                  </button>
                </form>
              </li>
            ) : (
              <li key={alert.documentId} className={alert.kind === "renew" ? "notice notice-attention" : "notice"}>
                <span className="vendor-sheet-alert-icon" aria-hidden="true">
                  {alert.kind === "renew" ? "!" : "◷"}
                </span>
                <span>
                  {alert.kind === "renew" ? (
                    <>
                      <strong>{tSheet("alerts.renew", { document: alert.label, date: day(alert.validUntil) })}</strong>
                      {alert.upcomingRetained > 0 ? ` ${tSheet("alerts.renewRetained", { name: vendor.name, count: alert.upcomingRetained })}` : ""}
                    </>
                  ) : coupleOf.get(alert.eventId) ? (
                    tSheet("alerts.beforeEvent", { document: alert.label, date: day(alert.validUntil), couple: coupleOf.get(alert.eventId)! })
                  ) : (
                    tSheet("alerts.beforeAnEvent", { document: alert.label, date: day(alert.validUntil) })
                  )}
                </span>
                {vendor.archived ? null : <RequestDocumentButton vendorId={vendor.id} vendorName={vendor.name} kinds={documentKinds} initialKindId={alert.kindId} reach={reach} label={tSheet("alerts.ask")} />}
              </li>
            ),
          )}
        </ul>
      ) : null}

      <div className="vendor-sheet-columns">
        <div className="vendor-sheet-main">
          <section className="card" aria-labelledby="with-you-title">
            <div className="section-head">
              <h2 id="with-you-title">{tSheet("withYou.title")}</h2>
              {rows.length > 0 ? (
                <span className="meta">
                  {[
                    history.averageFinalCents !== null ? tSheet("withYou.average", { amount: money(history.averageFinalCents) }) : null,
                    average !== null ? tSheet("withYou.ratingAverage", { rating: average.toLocaleString(locale, { maximumFractionDigits: 1 }), count: collaborations.count }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
            {rows.length === 0 ? (
              <p>{tSheet("withYou.empty")}</p>
            ) : (
              <>
                <div role="region" aria-label={tSheet("withYou.table", { vendor: vendor.name })} tabIndex={0} className="vendor-sheet-history">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">{tSheet("withYou.event")}</th>
                        <th scope="col">{tSheet("withYou.slot")}</th>
                        <th scope="col">{tSheet("withYou.stage")}</th>
                        <th scope="col" className="num">
                          {tSheet("withYou.amount")}
                        </th>
                        <th scope="col">{tSheet("withYou.rating")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <th scope="row" data-label={tSheet("withYou.event")}>
                            <Link href={`/events/${row.eventId}?onglet=budget&poste=${row.slotId}`}>{row.eventNames || tSheet("withYou.unnamed")}</Link>
                            <span className="meta vendor-sheet-date">{row.eventDate ? day(row.eventDate) : tSheet("withYou.noDate")}</span>
                          </th>
                          <td data-label={tSheet("withYou.slot")}>{row.slotLabel}</td>
                          <td data-label={tSheet("withYou.stage")}>{tSheet(`withYou.stages.${row.stage}`)}</td>
                          <td className="num" data-label={tSheet("withYou.amount")}>
                            {amountCell(row)}
                          </td>
                          <td data-label={tSheet("withYou.rating")}>{ratingCell(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="field-hint">{tSheet("withYou.amountHelp")}</p>
              </>
            )}
            {/* Lot 58 (PRE-08 ; ADR 0097) : les évaluations après les évènements, internes ; leurs trois
                critères et le lien de la clôture restent accessibles. */}
            {collaborations.count > 0 ? (
              <details className="vendor-sheet-add">
                <summary>{tSheet("withYou.evaluations")}</summary>
                <p className="field-hint">{t("evaluationsHelp")}</p>
                <p>{t("evaluationsAverage", { average: ((collaborations.averageTenths ?? 0) / 10).toLocaleString(locale), count: collaborations.count, date: day(collaborations.lastEvaluatedAt!.slice(0, 10)) })}</p>
                {vendor.rating !== null ? <p className="meta">{t("evaluationsCardRating", { rating: vendor.rating })}</p> : null}
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
              </details>
            ) : null}
          </section>

          {/* Lot 48a (PRE-05, D3) : pièces à échéance, déposées par la planner ou demandées au prestataire. */}
          <section className="card" aria-labelledby="documents-title">
            <div className="section-head">
              <h2 id="documents-title">{tSheet("documents.title")}</h2>
              {settle > 0 ? <span className="meta">{tSheet("documents.toSettle", { count: settle })}</span> : null}
            </div>
            {documents.length === 0 ? (
              <p>
                {tSheet("documents.none")}
                {usualKinds.length > 0 ? ` ${tSheet("documents.usual", { documents: usualNames })}` : ""}
              </p>
            ) : (
              <ul className="vendor-sheet-documents">
                {documents.map((document) => {
                  const expired = document.status !== "requested" && document.validUntil !== null && document.validUntil < today;
                  return (
                    <li key={document.id}>
                      <span className="vendor-sheet-document-name">{document.kindLabel}</span>
                      <span className="meta">
                        {document.fileName ? <a href={`/prestataires/${vendor.id}/pieces/${document.id}`}>{document.fileName}</a> : null}
                        {document.status === "requested"
                          ? `${document.fileName ? " · " : ""}${document.requestedAt ? tSheet("documents.awaited", { date: day(document.requestedAt.slice(0, 10)) }) : tSheet("documents.awaitedUndated")}`
                          : null}
                        {document.status === "to_verify" ? ` · ${tSheet("documents.toVerify")}` : null}
                        {document.status === "verified" && document.verifiedAt ? ` · ${tSheet("documents.checkedOn", { date: day(document.verifiedAt.slice(0, 10)) })}` : null}
                      </span>
                      {document.validUntil ? (
                        <span className={expired ? "badge badge-terracotta" : document.alert === "expiring" ? "badge badge-ambre" : "badge"}>
                          {expired ? `! ${tSheet("documents.toRenew")} · ` : ""}
                          {tSheet("documents.validUntil", { date: day(document.validUntil) })}
                        </span>
                      ) : null}
                      <span className="vendor-sheet-document-actions">
                        {document.status === "to_verify" ? (
                          <form action={verifyVendorDocumentAction} className="inline-form">
                            <input type="hidden" name="vendorId" value={vendor.id} />
                            <input type="hidden" name="documentId" value={document.id} />
                            <button type="submit">{tRecords("documentVerify", { document: document.kindLabel })}</button>
                          </form>
                        ) : null}
                        {document.status !== "requested" ? <VendorDocumentValidityForm vendorId={vendor.id} documentId={document.id} validUntil={document.validUntil} label={document.kindLabel} /> : null}
                        <form action={removeVendorDocumentAction} className="inline-form">
                          <input type="hidden" name="vendorId" value={vendor.id} />
                          <input type="hidden" name="documentId" value={document.id} />
                          <button type="submit">{tRecords("documentRemove", { document: document.kindLabel })}</button>
                        </form>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {vendor.archived ? null : (
              <div className="row-wrap vendor-sheet-document-gestures">
                {usualKinds.length > 0 ? <RequestUsualButton vendorId={vendor.id} reach={reach} label={tSheet("documents.requestUsual", { documents: usualNames })} /> : null}
                <RequestDocumentButton vendorId={vendor.id} vendorName={vendor.name} kinds={documentKinds} reach={reach} label={documents.length === 0 && usualKinds.length === 0 ? tSheet("documents.requestOne") : tSheet("documents.ask")} />
              </div>
            )}
            <p className="field-hint">{tSheet(reach === "link" ? "documents.requestViaLink" : "documents.requestWaiting")}</p>
            <details className="vendor-sheet-add">
              <summary>{tSheet("documents.add")}</summary>
              <VendorDocumentUploadForm vendorId={vendor.id} kinds={documentKinds} />
            </details>
          </section>
        </div>

        <div className="vendor-sheet-side">
          <section className="card" aria-labelledby="details-title">
            <div className="section-head">
              <h2 id="details-title">{tSheet("characteristics.title")}</h2>
              <Link href={`${vendorHref}?modifier=1`} scroll={false}>
                {tSheet("edit")}
                <span className="sr-only"> — {tSheet("characteristics.title")}</span>
              </Link>
            </div>
            <dl className="vendor-summary">
              <div>
                <dt>{tSheet("characteristics.trades")}</dt>
                <dd>
                  {trades.length > 0 ? (
                    trades.map((trade, position) => (position === 0 && trades.length > 1 ? tSheet("characteristics.primary", { type: trade.label }) : trade.label)).join(" · ")
                  ) : (
                    <span className="vendor-sheet-missing">
                      {tSheet("missing.trades")} ·{" "}
                      <Link href={`${vendorHref}?modifier=1`} scroll={false}>
                        {tSheet("missing.add")}
                        <span className="sr-only"> — {tSheet("characteristics.trades")}</span>
                      </Link>
                    </span>
                  )}
                </dd>
              </div>
              {facts.map((fact) => (
                <div key={fact.key}>
                  <dt>{tSheet(`characteristics.${fact.key}` as Parameters<typeof tSheet>[0])}</dt>
                  <dd>{factValue(fact)}</dd>
                </div>
              ))}
              {typedFields.map((field) => (
                <div key={field.id}>
                  <dt>{field.label}</dt>
                  <dd>{fieldText(field.kind, vendor.fieldValues[field.id])}</dd>
                </div>
              ))}
              {vendor.socialLinks.length > 0 ? (
                <div>
                  <dt>{tSheet("characteristics.social")}</dt>
                  <dd>
                    <ul className="vendor-links" aria-label={t("links")}>
                      {vendor.socialLinks.map((link) => (
                        <li key={link.network}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                            {t(`social.${link.network}`)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
            <ImportedFields fields={vendor.importedFields ?? undefined} />
          </section>

          {/* Lot 48a (PRE-10, SEC-27) : IBAN masqué, son état, journal des changements ; plaquettes et RIB. */}
          <section className="card" aria-labelledby="payment-title">
            <h2 id="payment-title">{tSheet("payment.title")}</h2>
            <dl className="vendor-summary">
              <div>
                <dt>{tRecords("iban")}</dt>
                <dd>
                  {vendor.bank.ibanMasked ? (
                    <>
                      {vendor.bank.ibanMasked} · {vendor.bank.pendingCheck ? <span className="badge badge-warning">{tRecords("toVerify")}</span> : tSheet("payment.ibanChecked")}
                    </>
                  ) : (
                    <span className="vendor-sheet-missing">{tSheet("missing.iban")}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{tRecords("bic")}</dt>
                <dd>{vendor.bank.hasBic ? tRecords("bicSet") : <span className="vendor-sheet-missing">{tSheet("missing.bic")}</span>}</dd>
              </div>
              <div>
                <dt>{tSheet("payment.files")}</dt>
                <dd>
                  {vendor.files.length === 0 ? (
                    <span className="vendor-sheet-missing">{tSheet("payment.filesNone")}</span>
                  ) : (
                    <ul className="plain-list">
                      {vendor.files.map((file) => (
                        <li key={file.id}>
                          <span className="badge">{file.kind === "rib" ? t("fileRib") : t("fileBrochure")}</span> <a href={`/prestataires/${vendor.id}/fichiers/${file.id}`}>{file.fileName}</a>
                          <form action={removeVendorFileAction} className="inline-form">
                            <input type="hidden" name="vendorId" value={vendor.id} />
                            <input type="hidden" name="fileId" value={file.id} />
                            <button type="submit">{t("fileRemove", { name: file.fileName })}</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
            <details className="vendor-sheet-add">
              <summary>{vendor.bank.ibanMasked ? tSheet("payment.ibanChange") : tSheet("payment.ibanAdd")}</summary>
              <VendorBankForm vendorId={vendor.id} hasIban={vendor.bank.ibanMasked !== null} />
            </details>
            <details className="vendor-sheet-add">
              <summary>{tSheet("payment.fileAdd")}</summary>
              <p className="field-hint">{t("filesHint")}</p>
              <VendorFileForm vendorId={vendor.id} />
            </details>
            {bankChanges.length > 0 ? (
              <details>
                <summary>{tRecords("bankHistory", { count: bankChanges.length })}</summary>
                <ul>
                  {bankChanges.map((change) => (
                    <li key={change.id}>
                      {tRecords("bankHistoryLine", {
                        date: day(change.changedAt.slice(0, 10)),
                        who: change.changedBy.kind === "vendor" ? tRecords("byVendorLink") : memberName(change.changedBy.userId),
                        before: change.previousMasked ?? tSheet("missing.iban"),
                        after: change.nextMasked ?? tSheet("missing.iban"),
                      })}{" "}
                      {change.verifiedAt ? tRecords("bankHistoryVerified", { date: day(change.verifiedAt.slice(0, 10)), who: memberName(change.verifiedByUserId) }) : tRecords("bankHistoryPending")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {/* Lot 48a (DAT-08) : note interne, éventuellement confidentielle (chiffrée), et sa règle d'accès. */}
          <section className="card" aria-labelledby="note-title">
            <h2 id="note-title">{tRecords("noteTitle")}</h2>
            {noteReadable ? (
              <VendorNoteForm vendorId={vendor.id} note={vendor.internalNoteConfidential ? confidentialNote : vendor.internalNote} confidential={vendor.internalNoteConfidential !== null} />
            ) : (
              <p className="muted">{tRecords("noteHidden")}</p>
            )}
          </section>

          {/* Lot 60 (L60-PLA-01, PRE-06) : les plans de salle d'un lieu, si le module est ouvert (ARC-07). */}
          {floorplans && trades.some((trade) => trade.starterKey === "venue") ? (
            <section className="card" aria-labelledby="floorplans-title">
              <h2 id="floorplans-title">{t("floorplansTitle")}</h2>
              <p className="meta">{t("floorplansIntro")}</p>
              <p>
                <Link href={`/prestataires/${vendor.id}/plans`}>{t("floorplansLink")}</Link>
              </p>
            </section>
          ) : null}

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
            <details className="vendor-sheet-add">
              <summary>{tSheet("point.adjust")}</summary>
              <p className="field-hint">{t("pointHint")}</p>
              <VendorLocationForm vendorId={vendor.id} latitude={vendor.location?.latitude ?? null} longitude={vendor.location?.longitude ?? null} />
            </details>
          </section>
        </div>
      </div>
      {editing ? <VendorCreateDialog key={vendor.id} options={{ types, families, tags, tagGroups, slot: null }} vendor={vendor} detailsOpen={query.details === "1"} closeHref={vendorHref} /> : null}
    </main>
  );
}
