// Lot 13 (HUB-18) — état de la dernière sauvegarde signalée par le script de
// sauvegarde : « Faite le … » ou, en alerte, « Échec » / « Aucune depuis plus
// de 26 h » / « Aucune sauvegarde signalée ».
import { getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { BACKUP_STALE_HOURS, type BackupStatus } from "@/modules/hub/service";

export async function BackupBadge({ status, locale }: { status: BackupStatus; locale: Locale }) {
  const t = await getTranslations("AdminBackup");
  if (status.state === "ok" && status.lastSucceeded?.finishedAt) {
    return <span className="badge badge-sauge">{t("ok", { date: formatDateTime(status.lastSucceeded.finishedAt, locale) })}</span>;
  }
  if (status.state === "failed" && status.latest) {
    return <span className="badge badge-terracotta">{t("failed", { date: formatDateTime(status.latest.startedAt, locale) })}</span>;
  }
  if (status.state === "stale") return <span className="badge badge-terracotta">{t("stale", { hours: BACKUP_STALE_HOURS })}</span>;
  return <span className="badge badge-terracotta">{t("none")}</span>;
}
