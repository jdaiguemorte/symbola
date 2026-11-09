// Lot 18 (RGPD-07) — pastille d'échéance d'une demande : close, dépassée,
// proche (alerte) ou à venir. Le libellé porte toujours l'information ; la
// couleur ne fait que l'accompagner.
import { formatDateTime, type Locale } from "@symbola/i18n";
import type { PrivacyRequestView } from "@/modules/hub/service";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function deadlineBadge(request: PrivacyRequestView, t: Translate, locale: Locale): { className: string; label: string } {
  if (request.status === "closed") {
    return { className: "badge badge-sauge", label: request.closedAt ? t("deadlineClosedOn", { date: formatDateTime(request.closedAt, locale) }) : t("requestClosed") };
  }
  const days = request.daysLeft ?? 0;
  if (days < 0) return { className: "badge badge-terracotta", label: t("requestOverdue", { days: -days }) };
  return { className: request.dueSoon ? "badge badge-terracotta" : "badge", label: t("requestDaysLeft", { days }) };
}
