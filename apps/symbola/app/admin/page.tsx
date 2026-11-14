// Lot 13 (L13-HUB-17, L13-HUB-18, ADR 0033) — vue d'ensemble de la console
// d'Administration : état des services, chiffres agrégés, ce qui demande une
// action (invitations expirées, double authentification non configurée,
// dernière sauvegarde) et tendance sur 6 mois. Jamais un nom, un montant ni un
// contenu d'organisation dans les chiffres (ADR 0029).
import { PageHeader } from "@/app/ui/page-header";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatMonth, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getAdminOverview, type AdminOverview } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { runAdminHealthChecks } from "@/lib/admin-health";
import { BackupBadge } from "./backup-badge";

// Courbe des 6 derniers mois, tracée en SVG (attributs, pas de style en ligne : CSP).
function Trend({ trend, label }: { trend: AdminOverview["trend"]; label: string }) {
  const width = 300;
  const height = 64;
  const max = Math.max(1, ...trend.map((point) => point.count));
  const step = trend.length > 1 ? width / (trend.length - 1) : 0;
  const points = trend.map((point, index) => [index * step, height - 6 - (point.count / max) * (height - 12)] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = points.at(-1);
  return (
    <svg className="admin-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {points.length > 0 ? <path d={`${line} L${width} ${height} L0 ${height} Z`} className="admin-trend-area" /> : null}
      {points.length > 0 ? <path d={line} className="admin-trend-line" /> : null}
      {last ? <circle cx={last[0]} cy={last[1]} r="4" className="admin-trend-dot" /> : null}
    </svg>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const t = await getTranslations("AdminOverview");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const now = new Date();

  const db = appDatabase();
  const overview: AdminOverview = await getAdminOverview(db, now);
  const health = await runAdminHealthChecks();
  const trendLabel = t("trendLabel", {
    values: overview.trend.map((point) => `${formatMonth(`${point.month}-01`, locale)} : ${point.count}`).join(", "),
  });

  return (
    <main>
      <PageHeader
        title={t("title")}
        actions={
          <p className={health.status === "ok" ? "status-pill status-pill-ok" : "status-pill status-pill-alert"} role="status">
            <span className="status-led" aria-hidden="true" />
            {health.status === "ok" ? t("servicesOk") : t("servicesDegraded")}
          </p>
        }
      />
      <ScreenHelp title={tHelp("admin.title")} body={tHelp("admin.body")} />

      <ul className="kpi-list kpi-list-4" aria-label={t("figures")}>
        <li>
          <span>{t("activeOrganizations")}</span> <strong>{t("outOf", { count: overview.activeOrganizations, total: overview.organizations })}</strong>
        </li>
        <li>
          <span>{t("teamAccounts")}</span> <strong>{overview.teamAccounts}</strong>
        </li>
        <li>
          <span>{t("activeAccounts")}</span> <strong>{t("outOf", { count: overview.activeAccounts, total: overview.teamAccounts })}</strong>
        </li>
        <li>
          <span>{t("eventsThisMonth")}</span> <strong>{overview.eventsThisMonth}</strong>
        </li>
      </ul>

      <div className="card-grid">
        <section aria-labelledby="admin-todo-title">
          <h2 id="admin-todo-title">{t("todoTitle")}</h2>
          <ul className="admin-todo">
            <li>
              <span>{t("expiredInvitations", { count: overview.expiredInvitations })}</span>
              {overview.expiredInvitations > 0 ? <Link href="/admin/comptes">{t("seeAccounts")}</Link> : <span className="badge badge-sauge">{t("nothingToDo")}</span>}
            </li>
            <li>
              <span>{t("lastBackup")}</span>
              <BackupBadge status={overview.backup} locale={locale} />
            </li>
          </ul>
        </section>
        <section aria-labelledby="admin-trend-title">
          <h2 id="admin-trend-title">{t("trendTitle")}</h2>
          <Trend trend={overview.trend} label={trendLabel} />
          <p className="muted">{t("trendNote")}</p>
        </section>
      </div>
      <p>
        <Link href="/admin/organisations" className="button-link">
          {t("seeOrganizations")}
        </Link>{" "}
        <Link href="/admin/health" className="button-link">
          {t("seeHealth")}
        </Link>
      </p>
    </main>
  );
}
