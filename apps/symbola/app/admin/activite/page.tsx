// Lot 9 (ADR 0029) — statistiques d'usage par organisation pour l'Admin :
// des nombres seulement (comptes, connexions, événements, devis, factures par
// mois), jamais un nom, un montant ni un contenu ; les essais sont exclus.
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, formatMonth, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationsActivity } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { uniqueLabels } from "../unique-labels";
import { AdminListPagination, AdminListSearch, filterByName } from "../admin-list";
import { paginate } from "@/app/ui/pagination";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const t = await getTranslations("AdminActivity");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const db = appDatabase();
  const organizations = await getOrganizationsActivity(db);

  const { q, page: pageParam } = await searchParams;
  const page = paginate(filterByName(organizations, q), pageParam);
  const labels = uniqueLabels(page.items.map((organization) => organization.name));

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("adminActivity.title")} body={tHelp("adminActivity.body")} />
      <p>{t("intro")}</p>
      <AdminListSearch q={q} total={page.total} />
      {page.items.length === 0 ? <p>{t("empty")}</p> : null}
      {page.items.map((organization, position) => (
        <div key={organization.id} className="card">
          <h2>{organization.name}</h2>
          <ul aria-label={t("summaryOf", { organization: labels[position]! })}>
            <li>{t("teamAccounts", { count: organization.teamAccounts })}</li>
            <li>{t("activeAccounts", { count: organization.activeAccounts })}</li>
            <li>
              {organization.lastLoginAt
                ? t("lastLogin", { date: formatDateTime(organization.lastLoginAt, locale) })
                : t("neverLoggedIn")}
            </li>
          </ul>
          <div role="region" aria-label={t("monthlyTable", { organization: labels[position]! })} tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("month")}</th>
                  <th scope="col" className="num">{t("events")}</th>
                  <th scope="col" className="num">{t("quotes")}</th>
                  <th scope="col" className="num">{t("invoices")}</th>
                </tr>
              </thead>
              <tbody>
                {organization.months.map((month, index) => (
                  <tr key={month}>
                    <th scope="row">{formatMonth(`${month}-01`, locale)}</th>
                    <td className="num">{organization.events[index]!.count}</td>
                    <td className="num">{organization.quotes[index]!.count}</td>
                    <td className="num">{organization.invoices[index]!.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <AdminListPagination page={page} basePath="/admin/activite" q={q} />
    </main>
  );
}
