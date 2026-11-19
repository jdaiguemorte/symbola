import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { ORGANIZATION_IMPORT_MAX_BYTES } from "@/lib/export/import-limits";
import { organizationHasRealData } from "@/lib/export/organization-import";
import { requireOwner } from "@/lib/guards";
import { listOrganizationImports, type OrganizationImportView } from "@/modules/hub/service";
import { ImportArchiveForm } from "./import-form";
import { ImportProgress } from "./import-progress";

// Lot 35b (HUB-13 ; décisions D6 et D7 ; ADR 0098) — reprise d'un export Symbola dans un espace
// vide : ce qui est vérifié, ce qui n'est pas repris, le dépôt de l'archive (Propriétaire, espace
// vide), l'avancement de la reprise en arrière-plan et son bilan, entité par entité.
export default async function OrganizationImportPage() {
  const auth = await requireOwner();
  const t = await getTranslations("OrganizationImport");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const organizationId = auth.user.organizationId;
  const [imports, hasData] = await Promise.all([listOrganizationImports(appDatabase(), organizationId), organizationHasRealData(organizationId)]);
  const active = imports.some((item) => item.status === "pending" || item.status === "running");
  const done = imports.some((item) => item.status === "done");

  const statusLabel = (item: OrganizationImportView) =>
    item.status === "done" ? t("statusDone") : item.status === "failed" ? t("statusFailed") : item.status === "running" ? t("statusRunning") : t("statusPending");

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("organizationImport.title")} body={tHelp("organizationImport.body")} />
      <p>{t("intro")}</p>

      <section aria-labelledby="import-empty">
        <h2 id="import-empty">{t("emptyTitle")}</h2>
        <p>{t("emptyBody")}</p>
        <h3>{t("checksTitle")}</h3>
        <p>{t("checks")}</p>
        <h3>{t("notTakenTitle")}</h3>
        <p>{t("notTaken")}</p>
      </section>

      <section aria-labelledby="import-upload">
        <h2 id="import-upload">{t("uploadTitle")}</h2>
        {hasData && !done ? <p role="note">{t("notEmpty")}</p> : null}
        {!hasData && !active ? <ImportArchiveForm maxSizeLabel={formatFileSize(ORGANIZATION_IMPORT_MAX_BYTES, locale)} /> : null}
      </section>

      <section aria-labelledby="import-history">
        <h2 id="import-history">{t("historyTitle")}</h2>
        {imports.length === 0 ? (
          <p>{t("none")}</p>
        ) : (
          <ul className="export-list">
            {imports.map((item) => {
              const report = item.report;
              const rows = report ? report.entities.reduce((sum, entity) => sum + entity.imported, 0) : 0;
              return (
                <li key={item.id}>
                  <p>
                    <strong>{statusLabel(item)}</strong> · {t("requestedAt", { date: formatDateTime(item.requestedAt, locale) })}
                    {item.sourceGeneratedAt ? ` · ${t("sourceDate", { date: formatDateTime(item.sourceGeneratedAt, locale) })}` : null}
                  </p>
                  <ImportProgress status={item.status} />
                  {item.status === "failed" && item.error ? <p role="alert">{t(`errors.${item.error}`, { detail: item.errorDetail ?? "" })}</p> : null}
                  {report ? (
                    <div className="stack">
                      <h3>{t("reportTitle")}</h3>
                      <p>{t("reportRows", { rows, files: report.files.imported })}</p>
                      {report.files.missing > 0 ? <p role="note">{t("reportMissing", { count: report.files.missing })}</p> : null}
                      {report.ledger ? <p>{t("reportLedger", { entries: report.ledger.entries })}</p> : null}
                      {report.teamMembersToInvite > 0 ? <p>{t("reportInvite", { count: report.teamMembersToInvite })}</p> : null}
                      {report.linksToRecreate > 0 ? <p>{t("reportLinks", { count: report.linksToRecreate })}</p> : null}
                      <details>
                        <summary>{t("detailsSummary")}</summary>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th scope="col">{t("entityHeader")}</th>
                                <th scope="col">{t("rowsHeader")}</th>
                                <th scope="col">{t("importedHeader")}</th>
                                <th scope="col">{t("reasonHeader")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.entities.map((entity) => (
                                <tr key={entity.entity}>
                                  <th scope="row">{entity.entity}</th>
                                  <td>{entity.rows}</td>
                                  <td>{entity.imported}</td>
                                  <td>{entity.reason ? t(`reasons.${entity.reason}`) : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
