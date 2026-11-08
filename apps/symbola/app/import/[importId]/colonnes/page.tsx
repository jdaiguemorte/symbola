import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatFileSize, type Locale } from "@symbola/i18n";
import { notFound } from "next/navigation";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { getImportColumns } from "@/modules/hub/service";
import { columnDecisionValue, columnNeedsChoice } from "@/lib/import/columns";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { ColumnsForm, type ColumnRow } from "./columns-form";

const DELIMITER_KEYS = { ",": "delimiterComma", ";": "delimiterSemicolon", "\t": "delimiterTab" } as const;

// IMP-02 — étape « colonnes ». Lot 16 (IMP-11, ADR 0041) : seules les colonnes
// qui demandent un choix sont présentées, en tableau (Colonne du fichier ·
// Exemples · Devient · Confiance) ; les autres se résument en une ligne. Une
// colonne devient un champ, reste en champ libre sur la fiche, ou est ignorée.
export default async function ImportColumnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId);
  const { sql, db } = createAppConnection();
  let view;
  try {
    view = await getImportColumns(db, organizationId, importId);
  } finally {
    await sql.end();
  }
  if (!view) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const draft = wizard.draft;
  const rows: ColumnRow[] = view.columns.map((column) => ({
    columnIndex: column.columnIndex,
    name: column.header || t("unnamedColumn", { number: column.columnIndex + 1 }),
    samples: column.samples,
    value: columnDecisionValue(column, view.lowConfidenceThreshold),
    confidence: column.proposedFieldKey ? column.confidence : null,
    proposal: column.proposedFieldKey && column.confidence < view.lowConfidenceThreshold && !column.saved ? column.proposedFieldKey : null,
    byProfile: column.profileDecision !== null && !column.proposedFieldKey,
    needsChoice: columnNeedsChoice(column, view.lowConfidenceThreshold),
  }));

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="columns" abandon={wantsAbandon(await searchParams)} />
      <ScreenHelp title={tHelp("importColumns.title")} body={tHelp("importColumns.body")} />
      {/* IMP-01 : ce que l'app a reconnu du fichier, et un aperçu, à la demande. */}
      <details className="file-read">
        <summary>{t("fileRead", { format: t(`format.${draft.fileFormat}`), size: formatFileSize(draft.fileSizeBytes, locale), rows: draft.rowCount })}</summary>
        <dl className="vendor-summary">
          {draft.encoding ? (
            <div>
              <dt>{t("detectedEncoding")}</dt>
              <dd>{t(`encoding.${draft.encoding}`)}</dd>
            </div>
          ) : null}
          {draft.delimiter && draft.delimiter in DELIMITER_KEYS ? (
            <div>
              <dt>{t("detectedDelimiter")}</dt>
              <dd>{t(DELIMITER_KEYS[draft.delimiter as keyof typeof DELIMITER_KEYS])}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("detectedHeader")}</dt>
            <dd>{draft.headerRowIndex === -1 ? t("detectedNoHeader") : t("detectedHeaderLine", { line: draft.headerRowIndex + 1 })}</dd>
          </div>
          <div>
            <dt>{t("detectedRows")}</dt>
            <dd>{t("rowCount", { count: draft.rowCount })}</dd>
          </div>
        </dl>
        <div className="list-table-wrap" role="region" aria-label={t("previewScrollLabel")} tabIndex={0}>
          <table className="list-table">
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
      </details>
      {draft.neutralizedCells > 0 ? <p role="status">{t("neutralizedNotice", { count: draft.neutralizedCells })}</p> : null}
      <ColumnsForm
        importId={view.importId}
        rows={rows}
        fields={view.fields.map((field) => ({ key: field.key, required: field.required === true }))}
      />
      <ActionBar label={t("actionBarLabel")} backHref="/import" backLabel={t("back")}>
        <button type="submit" form="columns-form">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
