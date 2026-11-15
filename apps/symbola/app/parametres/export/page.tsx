import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { getOrganizationExportRetentionDays, listOrganizationExports, type OrganizationExportView } from "@/modules/hub/service";
import { ExportProgress } from "./export-progress";
import { RequestExportForm } from "./request-form";

// Lot 35a (HUB-13, DAT-13 ; décisions D2 à D5 ; ADR 0068) — export complet des données de
// l'organisation, en libre-service et gratuit : ce qu'il contient et ce qui en est exclu, la
// demande, l'avancement de la préparation et les derniers exports, téléchargeables le temps
// réglé par l'Admin. Propriétaire seulement.
export default async function OrganizationExportPage() {
  const auth = await requireOwner();
  const t = await getTranslations("OrganizationExport");
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
  const db = appDatabase();
  const [exports, retentionDays] = await Promise.all([listOrganizationExports(db, auth.user.organizationId), getOrganizationExportRetentionDays(db)]);

  const statusLabel = (item: OrganizationExportView) => {
    if (item.status === "ready") return item.downloadable ? t("statusReady") : t("statusExpired");
    if (item.status === "running") return t("statusRunning");
    if (item.status === "failed") return t("statusFailed");
    return t("statusPending");
  };

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("organizationExport.title")} body={tHelp("organizationExport.body")} />
      <p>{t("intro")}</p>

      <section aria-labelledby="export-format">
        <h2 id="export-format">{t("formatTitle")}</h2>
        <p>{t("format")}</p>
        <h3>{t("excludedTitle")}</h3>
        <ul>
          <li>{t("excludedSecrets")}</li>
          <li>{t("excludedIdentity")}</li>
          <li>{t("excludedDemo")}</li>
          <li>{t("excludedOperations")}</li>
        </ul>
      </section>

      <section aria-labelledby="export-request">
        <h2 id="export-request">{t("requestTitle")}</h2>
        <p className="meta">{t("requestHint", { days: retentionDays })}</p>
        <RequestExportForm />
      </section>

      <section aria-labelledby="export-history">
        <h2 id="export-history">{t("historyTitle")}</h2>
        {exports.length === 0 ? (
          <p>{t("none")}</p>
        ) : (
          <ul className="export-list">
            {exports.map((item) => {
              const requestedAt = formatDateTime(item.requestedAt, locale);
              return (
                <li key={item.id}>
                  <p>
                    <strong>{statusLabel(item)}</strong> · {t("requestedAt", { date: requestedAt })}
                  </p>
                  <ExportProgress id={item.id} status={item.status} filesDone={item.filesDone} filesTotal={item.filesTotal} />
                  {item.status === "ready" && item.downloadable ? (
                    <>
                      <p className="meta">
                        {t("readySummary", { rows: item.rowCount, files: item.filesTotal - item.missingFiles, size: formatFileSize(item.sizeBytes ?? 0, locale) })}
                        {item.expiresAt ? ` · ${t("availableUntil", { date: formatDateTime(item.expiresAt, locale) })}` : null}
                      </p>
                      {item.missingFiles > 0 ? <p role="note">{t("missingFiles", { count: item.missingFiles })}</p> : null}
                      <p>
                        <a className="button-link" href={`/parametres/export/${item.id}`} download aria-label={t("downloadLabel", { date: requestedAt })}>
                          {t("download")}
                        </a>
                      </p>
                    </>
                  ) : null}
                  {item.status === "ready" && !item.downloadable ? <p className="meta">{t("expiredOn")}</p> : null}
                  {item.status === "failed" ? <p role="alert">{item.error === "too_large" ? t("errorTooLarge") : t("errorFailed")}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
