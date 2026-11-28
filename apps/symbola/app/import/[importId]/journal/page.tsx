import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, formatDateTime, formatDayMonth, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getUserContact, listImportJobs } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { getUndoPreview, type UndoPreviewItem } from "@/lib/import/apply";
import { describeVendorsForImportUndo, listVendorTypes } from "@/modules/vendors/service";
import { isValidId } from "../../access";
import { retryImportJobAction } from "../../actions";
import { JobProgress } from "../../job-progress";
import { importEventNames, takeoverBackLink } from "@/lib/takeover/flow";
import { takeoverRemoval } from "@/lib/import/apply";
import { getImportAnswers } from "@/modules/hub/service";
import { ImportWithdraw } from "./withdraw";
import { BudgetBilan } from "./budget-bilan";

function count(value: string | undefined): number | null {
  const number = Number(value);
  return value !== undefined && Number.isInteger(number) && number >= 0 ? number : null;
}

// IMP-05 — « Chaque import est journalisé : fichier, auteur, date, résultat »,
// et un import confirmé reste annulable pendant le délai réglé par l'Admin.
// Lot 16 (IMP-11) — fin de l'assistant : la prochaine action, selon ce qui a été importé.
// Lot 63b (HUB-14, UX-07) : élément principal de chaque type d'import, compté dans le bilan, et la
// liste qui sait se filtrer sur l'import (« Vérifier les N prestataires »).
const MAIN_KIND: Partial<Record<string, string>> = {
  vendors: "vendor",
  contacts: "contact",
  events: "event",
  event_sheets: "event",
  tasks: "task",
  budget_lines: "budget_line",
  catalog_items: "catalog_item",
};
const FILTERED_LIST: Partial<Record<string, string>> = { vendors: "/prestataires" };

const FINISH_LINKS: Partial<Record<string, string>> = {
  vendors: "/prestataires",
  events: "/events",
  event_sheets: "/events",
  tasks: "/taches",
  catalog_items: "/devis/catalogue",
  contacts: "/contacts",
};

export default async function ImportJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ annule?: string; gardes?: string; utilises?: string; retrait?: string }>;
}) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const view = await getUndoPreview(organizationId, importId);
  if (!view) notFound();

  const db = appDatabase();
  const author = await getUserContact(db, organizationId, view.createdByUserId);
  const jobs = await listImportJobs(db, organizationId, importId);
  // Lot 15 (GEO-01) : placement sur la carte des prestataires importés.
  const placeJob = jobs.find((job) => job.kind === "place_vendors");

  const t = await getTranslations("Import");
  const tTakeover = await getTranslations("Takeover");
  const tHelp = await getTranslations("Help");
  const tBilan = await getTranslations("ImportBilan");
  // Lot 71b (HUB-14) : le bilan d'un import de reprise ramène à sa page.
  const back = await takeoverBackLink(organizationId, importId);
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  // Lot 71d (HUB-14, I10) : le mariage de l'import, et la reprise entière pour la fiche d'un mariage.
  const eventName = (await importEventNames(organizationId, [view])).get(view.id) ?? back?.eventName ?? null;
  const removal = await takeoverRemoval(organizationId, importId);
  const budgetFigures = view.entityType === "budget_lines" && view.result?.figures?.kind === "budget" ? view.result : null;
  const undone = count(query.annule);

  const itemTitle = (item: UndoPreviewItem): string => {
    const values = (item.written ?? item.previous ?? {}) as Record<string, unknown>;
    if (item.kind === "event") {
      const clients = Array.isArray(values.clients)
        ? (values.clients as { firstName: string; lastName: string | null }[]).map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ")
        : "";
      const date = typeof values.eventDate === "string" ? formatCalendarDate(values.eventDate, locale) : null;
      return t(`itemKind.${item.kind}`, { title: [clients, date].filter(Boolean).join(", ") || t("rowWithoutLabel") });
    }
    if (item.kind === "budget_line") {
      // Lot 28a : l'estimé ; plannedAmountCents pour un import d'avant le lot.
      const estimated = values.estimatedAmountCents ?? values.plannedAmountCents;
      return t(`itemKind.${item.kind}`, { title: typeof estimated === "number" ? formatAmount(estimated, locale) : "" });
    }
    // Lot 36b : un contact (son nom), une note de contact (son début).
    if (item.kind === "contact") {
      const name = [values.firstName, values.lastName].filter((part) => typeof part === "string" && part !== "").join(" ");
      return t(`itemKind.${item.kind}`, { title: name || t("rowWithoutLabel") });
    }
    if (item.kind === "contact_note") {
      const body = typeof values.body === "string" ? values.body : "";
      return t(`itemKind.${item.kind}`, { title: body.length > 60 ? `${body.slice(0, 60)}…` : body });
    }
    const label = item.kind === "vendor" ? values.name : values.label;
    return t(`itemKind.${item.kind}`, { title: typeof label === "string" ? label : t("rowWithoutLabel") });
  };

  const modified = view.pendingItems.filter((item) => item.modified && !item.usedElsewhere);

  // Lot 63b (HUB-14, UX-07) : le bilan d'abord, chaque nombre mène aux éléments ; puis la
  // vérification (liste filtrée sur l'import) ; l'annulation, repliée, nomme les fiches modifiées.
  const mainKind = MAIN_KIND[view.entityType];
  const mainItems = view.pendingItems.filter((item) => item.kind === mainKind);
  const createdItems = mainItems.filter((item) => item.action === "created");
  const updatedItems = mainItems.filter((item) => item.action === "updated");
  const filteredList = FILTERED_LIST[view.entityType];
  const finishHref = FINISH_LINKS[view.entityType];
  const checkCount = view.result ? view.result.created + view.result.updated : mainItems.length;
  const listHref = (part: "crees" | "maj" | null) => (filteredList ? `${filteredList}?import=${view.id}${part ? `&quoi=${part}` : ""}` : null);
  const vendorDetails =
    view.entityType === "vendors" && modified.length > 0
      ? await describeVendorsForImportUndo(organizationId, modified.filter((item) => item.kind === "vendor").map((item) => item.elementId))
      : [];
  const typeLabels = vendorDetails.length > 0 ? new Map((await listVendorTypes(organizationId)).map((type) => [type.id, type.label])) : new Map<string, string>();
  const modifiedDetail = (item: UndoPreviewItem): string | null => {
    const vendor = vendorDetails.find((entry) => entry.id === item.elementId);
    if (!vendor) return null;
    return [vendor.typeId ? typeLabels.get(vendor.typeId) : null, vendor.city].filter(Boolean).join(" · ") || null;
  };
  const modifiedAt = (item: UndoPreviewItem): Date | null => vendorDetails.find((entry) => entry.id === item.elementId)?.updatedAt ?? null;
  // Lot 63b, gardé au lot 71d : la fenêtre de retrait nomme les fiches modifiées à la main depuis.
  const modifiedNames = modified.map((item) => {
    const detail = modifiedDetail(item);
    const at = modifiedAt(item);
    return [itemTitle(item), detail, at ? t("undoModifiedAt", { date: formatDateTime(at, locale) }) : null].filter(Boolean).join(" · ");
  });
  const summary = view.result
    ? [
        { key: "created", value: view.result.created, href: listHref("crees") ?? (createdItems.length > 0 ? "#elements-crees" : null) },
        { key: "updated", value: view.result.updated, href: listHref("maj") ?? (updatedItems.length > 0 ? "#elements-maj" : null) },
        { key: "ignored", value: view.result.rejected + view.result.unchanged, href: view.result.rejected + view.result.unchanged > 0 ? "#lignes-ignorees" : null },
        { key: "kept", value: view.keptColumns.length, href: view.keptColumns.length > 0 ? "#colonnes-gardees" : null },
      ]
    : [];

  return (
    <main>
      {back ? (
        <p className="takeover-back">
          <Link href={back.href}>‹ {back.eventName ? tTakeover("backTo", { event: back.eventName }) : tTakeover("backToNew")}</Link>
        </p>
      ) : finishHref ? (
        <p>
          <Link href={finishHref}>‹ {t(`finishBack.${view.entityType}`)}</Link>
        </p>
      ) : null}
      <h1>{budgetFigures && eventName && view.status === "applied" ? tBilan("title", { event: eventName }) : view.status === "applied" ? t("finishTitle") : t("journalEntryTitle", { fileName: view.fileName })}</h1>
      <ScreenHelp title={tHelp("importUndo.title")} body={tHelp("importUndo.body")} />
      {query.retrait ? <p role="alert">{tBilan(`takeoverFailed.${query.retrait === "expired" || query.retrait === "in_use" ? query.retrait : "failed"}`)}</p> : null}
      {undone !== null ? (
        <p role="status">
          {t("undoResult", { undone, kept: count(query.gardes) ?? 0, used: count(query.utilises) ?? 0 })}
        </p>
      ) : null}

      {budgetFigures ? (
        <BudgetBilan
          view={view}
          eventName={eventName}
          author={author?.email ?? null}
          answers={await getImportAnswers(db, organizationId, importId)}
          back={back}
          budgetHref={view.targetEventId ? `/events/${view.targetEventId}?onglet=budget` : null}
        />
      ) : view.result ? (
        <section className="card stack" aria-labelledby="import-summary-title">
          <h2 id="import-summary-title" className="sr-only">
            {t("finishSummaryTitle")}
          </h2>
          <p>{view.appliedAt ? t("finishImportedOn", { fileName: view.fileName, date: formatDateTime(view.appliedAt, locale) }) : view.fileName}</p>
          <ul className="import-summary">
            {summary.map((entry) => (
              <li key={entry.key}>
                <span className="import-summary-figure">{entry.value}</span>
                {entry.href && entry.value > 0 ? <Link href={entry.href}>{t(`finishFigure.${entry.key}`, { count: entry.value })}</Link> : <span className="meta">{t(`finishFigure.${entry.key}`, { count: entry.value })}</span>}
              </li>
            ))}
          </ul>
          {view.status === "applied" ? (
            <div className="import-finish-actions">
              {filteredList && checkCount > 0 ? (
                <Link href={listHref(null)!} className="button-link button-link-primary">
                  {t(`finishCheck.${view.entityType}`, { count: checkCount })}
                </Link>
              ) : finishHref ? (
                <Link href={finishHref} className="button-link button-link-primary">
                  {t(`finishLink.${view.entityType}`, { count: checkCount })}
                </Link>
              ) : null}
              {filteredList && finishHref ? (
                <Link href={finishHref} className="button-link">
                  {t(`finishBack.${view.entityType}`)}
                </Link>
              ) : null}
            </div>
          ) : null}
          {filteredList && view.status === "applied" && view.appliedAt ? <p className="meta">{t("finishCheckHint", { date: formatDayMonth(view.appliedAt, locale) })}</p> : null}
        </section>
      ) : null}

      {placeJob ? (
        <section aria-labelledby="import-placement" className="card">
          <h2 id="import-placement">{t("jobPlaceVendorsTitle")}</h2>
          {placeJob.status === "done" ? (
            <p role="status">
              {t("jobPlaceVendorsResult", { placed: placeJob.result.placed ?? 0, unplaced: placeJob.result.unplaced ?? 0 })}{" "}
              {(placeJob.result.unplaced ?? 0) > 0 ? <Link href="/prestataires?aplacer=1">{t("jobPlaceVendorsUnplacedLink")}</Link> : null}
            </p>
          ) : placeJob.status === "cancelled" ? (
            <p>{t("jobCancelled")}</p>
          ) : (
            <JobProgress label={t("jobPlaceVendors")} done={placeJob.done} total={placeJob.total} status={placeJob.status} />
          )}
          {placeJob.status === "failed" ? (
            <form action={retryImportJobAction}>
              <p role="alert">{t("jobFailed")}</p>
              <input type="hidden" name="importId" value={view.id} />
              <input type="hidden" name="jobId" value={placeJob.id} />
              <button type="submit">{t("jobRetry")}</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {!filteredList && !budgetFigures && createdItems.length > 0 ? (
        <details id="elements-crees">
          <summary>{t("finishCount", { count: createdItems.length, label: t("finishFigure.created", { count: createdItems.length }) })}</summary>
          <ul>
            {createdItems.map((item) => (
              <li key={item.id}>{itemTitle(item)}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {!filteredList && !budgetFigures && updatedItems.length > 0 ? (
        <details id="elements-maj">
          <summary>{t("finishCount", { count: updatedItems.length, label: t("finishFigure.updated", { count: updatedItems.length }) })}</summary>
          <ul>
            {updatedItems.map((item) => (
              <li key={item.id}>{itemTitle(item)}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {view.result && view.result.rejected + view.result.unchanged > 0 ? (
        <details id="lignes-ignorees">
          <summary>{t("finishCount", { count: view.result.rejected + view.result.unchanged, label: t("finishFigure.ignored", { count: view.result.rejected + view.result.unchanged }) })}</summary>
          <p>{t("finishIgnoredDetail", { rejected: view.result.rejected, unchanged: view.result.unchanged })}</p>
        </details>
      ) : null}
      {view.keptColumns.length > 0 ? (
        <details id="colonnes-gardees">
          <summary>{t("finishCount", { count: view.keptColumns.length, label: t("finishFigure.kept", { count: view.keptColumns.length }) })}</summary>
          <p>{t("finishKeptDetail", { columns: view.keptColumns.join(", ") })}</p>
        </details>
      ) : null}

      <details className="card">
        <summary>{t("finishJournalDetails")}</summary>
        <dl>
          <dt>{t("journalFile")}</dt>
          <dd>{view.fileName}</dd>
          <dt>{t("journalEntityType")}</dt>
          <dd>{t(`entityType.${view.entityType}`)}</dd>
          <dt>{t("journalAuthor")}</dt>
          <dd>{author?.email ?? t("journalAuthorUnknown")}</dd>
          <dt>{t("journalAppliedAt")}</dt>
          <dd>{view.appliedAt ? formatDateTime(view.appliedAt, locale) : "—"}</dd>
          <dt>{t("journalResult")}</dt>
          <dd>
            {view.result
              ? t("journalResultValue", { created: view.result.created, updated: view.result.updated, unchanged: view.result.unchanged, rejected: view.result.rejected })
              : "—"}
          </dd>
          <dt>{t("journalStatus")}</dt>
          <dd>{t(`status.${view.status}`)}</dd>
          {view.undoneAt ? (
            <>
              <dt>{t("journalUndoneAt")}</dt>
              <dd>{formatDateTime(view.undoneAt, locale)}</dd>
            </>
          ) : null}
        </dl>
      </details>

      <ImportWithdraw view={view} eventName={eventName} removal={removal} fromTakeover={back !== null} modifiedNames={modifiedNames} />

      <p>
        <Link href="/import" className="button-link">
          {t("finishHistory")}
        </Link>
      </p>
    </main>
  );
}
