import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatDate, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getImportDraft } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { cancelImportAction, retryImportJobAction } from "../actions";
import { JobProgress } from "../job-progress";
import { isValidId } from "../access";
import { ImportSteps } from "../import-steps";

const DELIMITER_KEYS = { ",": "delimiterComma", ";": "delimiterSemicolon", "\t": "delimiterTab" } as const;

// IMP-01 — résultat de l'étape « fichier » : ce que l'app a reconnu
// (format, encodage, séparateur, ligne d'en-tête) et un aperçu des lignes.
export default async function ImportDraftPage({ params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const { sql, db } = createAppConnection();
  let draft;
  try {
    draft = await getImportDraft(db, auth.user.organizationId, importId);
  } finally {
    await sql.end();
  }
  if (!draft) notFound();

  const t = await getTranslations("Import");
  // IMP-04 : l'étape « écarts » est faite quand plus aucune colonne n'attend
  // de décision (champ libre ou ignorée).
  const undecidedColumns = draft.mapping?.filter((choice) => choice.target === "none").length ?? 0;
  const gapsDone = draft.matching !== null && undecidedColumns === 0;
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  // Lot 15 (IMP-10) : fiches PDF en cours de lecture, en tâche de fond.
  const readJob = draft.jobs.find((job) => job.kind === "read_sheets");
  const reading = readJob !== undefined && (readJob.status === "pending" || readJob.status === "running");

  return (
    <main>
      <h1>{t("draftTitle", { fileName: draft.fileName })}</h1>
      <ScreenHelp title={tHelp("importFile.title")} body={tHelp("importFile.body")} />
      <ImportSteps current={gapsDone ? 4 : draft.matching ? 3 : draft.mapping ? 2 : 1} />

      {readJob ? (
        <section aria-labelledby="import-reading" className="card">
          <h2 id="import-reading">{t("jobReadSheetsTitle")}</h2>
          <JobProgress
            label={t("jobReadSheets")}
            done={readJob.done}
            total={readJob.total}
            status={readJob.status}
            nextHref={`/import/${draft.id}/rapprochements`}
          />
          {readJob.status === "failed" ? (
            <form action={retryImportJobAction}>
              <p role="alert">{t("jobFailed")}</p>
              <input type="hidden" name="importId" value={draft.id} />
              <input type="hidden" name="jobId" value={readJob.id} />
              <button type="submit">{t("jobRetry")}</button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="import-detected">
        <h2 id="import-detected">{t("detectedTitle")}</h2>
        <dl>
          <dt>{t("detectedEntityType")}</dt>
          <dd>{t(`entityType.${draft.entityType}`)}</dd>
          <dt>{t("detectedFormat")}</dt>
          <dd>
            {t(`format.${draft.fileFormat}`)} ({formatFileSize(draft.fileSizeBytes, locale)})
          </dd>
          {draft.encoding ? (
            <>
              <dt>{t("detectedEncoding")}</dt>
              <dd>{t(`encoding.${draft.encoding}`)}</dd>
            </>
          ) : null}
          {draft.delimiter && draft.delimiter in DELIMITER_KEYS ? (
            <>
              <dt>{t("detectedDelimiter")}</dt>
              <dd>{t(DELIMITER_KEYS[draft.delimiter as keyof typeof DELIMITER_KEYS])}</dd>
            </>
          ) : null}
          <dt>{t("detectedHeader")}</dt>
          <dd>{draft.headerRowIndex === -1 ? t("detectedNoHeader") : t("detectedHeaderLine", { line: draft.headerRowIndex + 1 })}</dd>
          <dt>{t("detectedRows")}</dt>
          <dd>{t("rowCount", { count: draft.rowCount })}</dd>
        </dl>
        {draft.neutralizedCells > 0 ? <p role="status">{t("neutralizedNotice", { count: draft.neutralizedCells })}</p> : null}
        <p>{t("draftExpiresOn", { date: formatDate(draft.expiresAt, locale) })}</p>
      </section>

      <section aria-labelledby="import-preview">
        <h2 id="import-preview">{t("previewTitle", { count: draft.previewRows.length })}</h2>
        <div role="region" aria-label={t("previewScrollLabel")} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {draft.headers.map((header, index) => (
                  <th key={index} scope="col">
                    {header || t("unnamedColumn", { number: index + 1 })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.previewRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="import-columns">
        <h2 id="import-columns">{t("columnsStepTitle")}</h2>
        {draft.mapping ? (
          <>
            <p>
              {t("columnsSummary", {
                mapped: draft.mapping.filter((choice) => choice.target === "field").length,
                none: draft.mapping.filter((choice) => choice.target === "none" || choice.target === "free" || choice.decidedAtGaps).length,
                ignored: draft.mapping.filter((choice) => choice.target === "ignore" && !choice.decidedAtGaps).length,
              })}
            </p>
            <p>
              <Link href={`/import/${draft.id}/colonnes`}>{t("editColumns")}</Link>
            </p>
          </>
        ) : (
          <p>
            <Link href={`/import/${draft.id}/colonnes`}>{t("continueToColumns")}</Link>
          </p>
        )}
      </section>

      {draft.mapping && !reading ? (
        <section aria-labelledby="import-matches">
          <h2 id="import-matches">{t("matchesStepTitle")}</h2>
          {draft.matching ? (
            <p>
              {t("matchesSummary", {
                accepted: draft.matching.matches.filter((match) => match.status === "accepted").length,
                proposed: draft.matching.matches.filter((match) => match.status === "proposed").length,
                refused: draft.matching.matches.filter((match) => match.status === "refused").length,
              })}
            </p>
          ) : null}
          <p>
            <Link href={`/import/${draft.id}/rapprochements`}>{draft.matching ? t("editMatches") : t("continueToMatches")}</Link>
          </p>
        </section>
      ) : null}

      {draft.matching && !reading ? (
        <section aria-labelledby="import-gaps">
          <h2 id="import-gaps">{t("gapsStepTitle")}</h2>
          <p>
            {gapsDone
              ? t("gapsSummary", {
                  kept: draft.mapping?.filter((choice) => choice.target === "free").length ?? 0,
                  ignored: draft.mapping?.filter((choice) => choice.target === "ignore" && choice.decidedAtGaps).length ?? 0,
                })
              : t("gapsPending", { count: undecidedColumns })}
          </p>
          <p>
            <Link href={`/import/${draft.id}/ecarts`}>{t("continueToGaps")}</Link>
          </p>
        </section>
      ) : null}

      {gapsDone ? (
        <section aria-labelledby="import-confirmation">
          <h2 id="import-confirmation">{t("confirmStepTitle")}</h2>
          <p>
            <Link href={`/import/${draft.id}/confirmation`}>{t("continueToConfirmation")}</Link>
          </p>
        </section>
      ) : null}

      <form action={cancelImportAction}>
        <input type="hidden" name="importId" value={draft.id} />
        <button type="submit">{t("cancelImport")}</button>
      </form>
      <p>
        <Link href="/import">{t("backToImports")}</Link>
      </p>
    </main>
  );
}
