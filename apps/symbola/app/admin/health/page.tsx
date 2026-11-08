// HUB-03 — « Quand l'Admin ouvre la page Santé, il voit pour chaque app
// son état (en ligne/hors ligne) et sa version déployée. » Lot 13 (HUB-17,
// HUB-18) : le détail de chaque service du socle (mêmes vérifications que
// /health) et la dernière sauvegarde signalée par le script de sauvegarde.
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getBackupStatus, type BackupStatus } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { ADMIN_HEALTH_SERVICES, runAdminHealthChecks } from "@/lib/admin-health";
import { BackupBadge } from "../backup-badge";

export default async function AdminHealthPage() {
  await requireAdmin();
  const t = await getTranslations("AdminHealth");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const report = await runAdminHealthChecks();
  const db = appDatabase();
  const backup: BackupStatus = await getBackupStatus(db);
  const latest = backup.latest;

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("adminHealth.title")} body={tHelp("adminHealth.body")} />
      <section aria-labelledby="health-services-title">
        <h2 id="health-services-title">{t("servicesTitle")}</h2>
        <p>{t("versionLine", { version: report.version })}</p>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t("service")}</th>
              <th scope="col">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t("app")}</th>
              <td>
                <span className="badge badge-sauge">{t("online")}</span>
              </td>
            </tr>
            {ADMIN_HEALTH_SERVICES.map((service) => (
              <tr key={service}>
                <th scope="row">{t(`services.${service}`)}</th>
                <td>
                  <span className={report.checks[service] === "ok" ? "badge badge-sauge" : "badge badge-terracotta"}>
                    {report.checks[service] === "ok" ? t("online") : t("offline")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="health-backup-title">
        <h2 id="health-backup-title">{t("backupTitle")}</h2>
        <p>
          <BackupBadge status={backup} locale={locale} />
        </p>
        {latest ? (
          <dl className="definition-grid">
            <dt>{t("backupStarted")}</dt>
            <dd>{formatDateTime(latest.startedAt, locale)}</dd>
            <dt>{t("backupFinished")}</dt>
            <dd>{latest.finishedAt ? formatDateTime(latest.finishedAt, locale) : t("backupRunning")}</dd>
            <dt>{t("backupResult")}</dt>
            <dd>{t(`backupStatus.${latest.status}`)}</dd>
            <dt>{t("backupSize")}</dt>
            <dd>{latest.sizeBytes !== null ? formatFileSize(latest.sizeBytes, locale) : "—"}</dd>
          </dl>
        ) : (
          <p>{t("backupNever")}</p>
        )}
      </section>
    </main>
  );
}
