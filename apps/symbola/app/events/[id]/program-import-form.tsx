"use client";

// Lot 51 (CHR-08 ; ADR 0091) — « Importer un chrono » : un tableur (CSV, XLSX) dont les colonnes
// sont reconnues (jour ou temps fort, début, fin, séquence, lieu, responsable, note). L'écran de
// contrôle montre les séquences lues, les écarts expliqués ligne par ligne, les temps forts qui
// seront créés et les cellules neutralisées ; rien n'est écrit avant « Importer ».
// Lot 71e (HUB-14) : le PDF de programme d'un logiciel de planning (lot 63b) passe désormais par
// l'assistant commun des imports (journal, bilan, retrait d'ensemble) : voir app/import/[importId]/pdf.
import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ProgramImportRow } from "@symbola/contracts";
import { importProgramAction, type ProgramImportState } from "./program-actions";

function rowBadges(row: ProgramImportRow, t: ReturnType<typeof useTranslations<"Events">>): string[] {
  const badges: string[] = [];
  if (row.marker) badges.push(t("programImportMarker"));
  if (row.hiddenFromClients) badges.push(t("programImportHidden"));
  if (row.endsNextDay) badges.push(t("programImportNextDay"));
  return badges;
}

// Lot 71e (HUB-14) : un tableur ici ; un PDF de programme passe par l'assistant commun des imports.
export function ProgramImportForm({ eventId, open = false }: { eventId: string; open?: boolean }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(importProgramAction, {} as ProgramImportState);
  const result = state.result;
  // React vide le champ fichier après chaque action : le fichier choisi est gardé pour « Importer ».
  const file = useRef<File | null>(null);
  const run = (formData: FormData) => {
    const chosen = formData.get("file");
    if ((!(chosen instanceof File) || chosen.size === 0) && file.current) formData.set("file", file.current);
    return action(formData);
  };
  const preview = result?.status === "preview" ? result.preview : null;
  const hiddenCount = preview?.rows.filter((row) => row.hiddenFromClients).length ?? 0;
  return (
    <details className="program-import" id="importer-programme" open={open || undefined}>
      <summary>{t("programImportTitle")}</summary>
      <p className="muted">{t("programImportHint")}</p>
      <form action={run} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          {t("programImportFileLabel")}
          <input
            type="file"
            name="file"
            onChange={(change) => (file.current = change.target.files?.[0] ?? null)}
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </label>
        {preview ? (
          <>
            <h3>{t("programImportPreviewTitle", { count: preview.rows.length })}</h3>
            {preview.neutralizedCells > 0 ? <p>{t("programImportNeutralized", { count: preview.neutralizedCells })}</p> : null}
            {preview.unknownColumns.length > 0 ? <p>{t("programImportUnknownColumns", { columns: preview.unknownColumns.join(", ") })}</p> : null}
            {preview.newMoments.length > 0 ? (
              <p>{t("programImportNewMoments", { moments: preview.newMoments.map((moment) => `${moment.name} (${moment.date})`).join(", ") })}</p>
            ) : null}
            {preview.problems.length > 0 ? (
              <ul aria-label={t("programImportProblems")}>
                {preview.problems.map((problem) => (
                  <li key={`${problem.line}-${problem.problem}`}>{t("programImportProblem", { line: problem.line, problem: t(`programImportProblems_.${problem.problem}`) })}</li>
                ))}
              </ul>
            ) : null}
            {hiddenCount > 0 ? <p className="notice">{t("programImportHiddenNotice", { count: hiddenCount })}</p> : null}
            {/* Lot 62c (NFR-19) : le tableau défile dans sa zone, la page ne déborde pas en 375 px. */}
            <div className="list-table-wrap" role="region" tabIndex={0} aria-label={t("programImportPreviewTitle", { count: preview.rows.length })}>
              <table className="data-table">
                <caption className="sr-only">{t("programImportPreviewTitle", { count: preview.rows.length })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("programImportLine")}</th>
                    <th scope="col">{t("programKeyMoment")}</th>
                    <th scope="col">{t("programStartTime")}</th>
                    <th scope="col">{t("programItemLabel")}</th>
                    <th scope="col">{t("programImportSkip")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const badges = rowBadges(row, t);
                    return (
                      <tr key={row.line}>
                        <td>{row.line}</td>
                        <td>{[row.moment, row.momentDate].filter(Boolean).join(" · ")}</td>
                        <td>{row.endTime ? `${row.startTime} – ${row.endTime}` : row.startTime}</td>
                        <td>
                          {row.label}
                          {badges.map((badge) => (
                            <span key={badge} className="badge">
                              {" "}
                              {badge}
                            </span>
                          ))}
                        </td>
                        <td>
                          <input type="checkbox" name="skip" value={row.line} aria-label={t("programImportSkipLine", { line: row.line })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="submit" name="intent" value="apply" className="primary" disabled={pending || preview.rows.length === 0}>
              {t("programImportApply", { count: preview.rows.length })}
            </button>
          </>
        ) : null}
        <button type="submit" name="intent" value="preview" className="button-secondary" disabled={pending}>
          {t("programImportPreview")}
        </button>
        {pending ? (
          <p role="status" className="muted">
            {t("programImportReading")}
          </p>
        ) : null}
        {state.error ? <p role="alert">{state.error}</p> : null}
        {result?.status === "rejected" ? <p role="alert">{t.has(`programImportRejected.${result.reason}`) ? t(`programImportRejected.${result.reason}`) : t("programImportRejected.malformed")}</p> : null}
        {result?.status === "applied" ? (
          <p role="status">
            {t("programImportApplied", { items: result.items, moments: result.moments })}
          </p>
        ) : null}
      </form>
    </details>
  );
}
