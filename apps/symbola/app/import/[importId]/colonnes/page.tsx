import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatFileSize, type Locale } from "@symbola/i18n";
import { notFound } from "next/navigation";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { getImportColumns } from "@/modules/hub/service";
import { STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { columnDecisionValue, columnNeedsChoice } from "@/lib/import/columns";
import { displayImportCell } from "@/lib/import/display";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { ColumnsForm, type ColumnRow } from "./columns-form";

const DELIMITER_KEYS = { ",": "delimiterComma", ";": "delimiterSemicolon", "\t": "delimiterTab" } as const;

// IMP-02 — étape « colonnes ». Lot 16 (IMP-11, ADR 0041) puis lot 63b (HUB-14, maquette M5) : un
// tableau (Colonne du fichier avec deux exemples · Devient, sur la fiche · État), les colonnes à
// décider d'abord, et l'aperçu de la première ligne en fiche. Une colonne devient un champ, une
// note sur la fiche, ou n'est pas importée.
export default async function ImportColumnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId);
  const db = appDatabase();
  const view = await getImportColumns(db, organizationId, importId);
  if (!view) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const draft = wizard.draft;
  // Lot 69 (C-56, C-60) : les valeurs se lisent comme à la confirmation (accents, dates, sommes) ; le
  // code de statut d'une fiche d'évènement se lit en mots. Affichage seulement.
  const tEvents = await getTranslations("Events");
  const isEventFile = wizard.entityType === "event_sheets" || wizard.entityType === "events";
  const statusLabel = isEventFile
    ? (value: string) => (value in STATUS_LABEL_KEYS ? tEvents(STATUS_LABEL_KEYS[value as keyof typeof STATUS_LABEL_KEYS]) : null)
    : undefined;
  const show = (value: string) => displayImportCell(value, { locale, statusLabel });
  const rows: ColumnRow[] = view.columns.map((column) => ({
    columnIndex: column.columnIndex,
    name: column.header || t("unnamedColumn", { number: column.columnIndex + 1 }),
    samples: column.samples.map(show),
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
                    <td key={cellIndex}>{show(cell)}</td>
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
        firstRow={(draft.previewRows[0] ?? []).map(show)}
      />
      <ActionBar label={t("actionBarLabel")} backHref="/import" backLabel={t("back")}>
        <button type="submit" form="columns-form">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
