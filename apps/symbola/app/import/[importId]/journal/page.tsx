import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getUserContact, listImportJobs } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { getUndoPreview, type UndoPreviewItem } from "@/lib/import/apply";
import { isValidId } from "../../access";
import { retryImportJobAction } from "../../actions";
import { JobProgress } from "../../job-progress";
import { undoImportAction } from "./actions";

function count(value: string | undefined): number | null {
  const number = Number(value);
  return value !== undefined && Number.isInteger(number) && number >= 0 ? number : null;
}

// IMP-05 — « Chaque import est journalisé : fichier, auteur, date, résultat »,
// et un import confirmé reste annulable pendant le délai réglé par l'Admin.
// Lot 16 (IMP-11) — fin de l'assistant : la prochaine action, selon ce qui a été importé.
const FINISH_LINKS: Partial<Record<string, string>> = {
  vendors: "/prestataires",
  events: "/events",
  event_sheets: "/events",
  tasks: "/taches",
  catalog_items: "/devis/catalogue",
};

export default async function ImportJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ annule?: string; gardes?: string; utilises?: string }>;
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
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
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
    const label = item.kind === "vendor" ? values.name : values.label;
    return t(`itemKind.${item.kind}`, { title: typeof label === "string" ? label : t("rowWithoutLabel") });
  };

  const modified = view.pendingItems.filter((item) => item.modified && !item.usedElsewhere);
  const usedElsewhere = view.pendingItems.filter((item) => item.usedElsewhere);

  return (
    <main>
      <h1>{t("journalEntryTitle", { fileName: view.fileName })}</h1>
      <ScreenHelp title={tHelp("importUndo.title")} body={tHelp("importUndo.body")} />
      {view.status === "applied" && view.result && FINISH_LINKS[view.entityType] ? (
        <p className="primary-action">
          <Link href={FINISH_LINKS[view.entityType]!} className="button-link button-link-primary">
            {t(`finishLink.${view.entityType}`, { count: view.result.created + view.result.updated })}
          </Link>
        </p>
      ) : null}
      {undone !== null ? (
        <p role="status">
          {t("undoResult", { undone, kept: count(query.gardes) ?? 0, used: count(query.utilises) ?? 0 })}
        </p>
      ) : null}
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

      {view.undoable ? (
        <section aria-labelledby="undo-import">
          <h2 id="undo-import">{t("undoTitle")}</h2>
          <p>{t("undoIntro", { date: view.undoDeadline ? formatDateTime(view.undoDeadline, locale) : "" })}</p>
          <form action={undoImportAction}>
            <input type="hidden" name="importId" value={view.id} />
            {modified.length > 0 ? (
              <fieldset>
                <legend>{t("undoModifiedLegend", { count: modified.length })}</legend>
                <p>{t("undoModifiedIntro")}</p>
                {modified.map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" name="forceItemId" value={item.id} />
                    {t("undoForce", { title: itemTitle(item) })}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {usedElsewhere.length > 0 ? (
              <div>
                <p>{t("undoUsedElsewhereIntro")}</p>
                <ul>
                  {usedElsewhere.map((item) => (
                    <li key={item.id}>{itemTitle(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button type="submit">{t("undoSubmit")}</button>
          </form>
        </section>
      ) : view.status === "applied" ? (
        <p>{t("undoExpired")}</p>
      ) : null}

      <p>
        <Link href="/import">{t("backToImports")}</Link>
      </p>
    </main>
  );
}
