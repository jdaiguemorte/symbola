// Lot 9 (ADR 0029) — statistiques d'usage par organisation pour l'Admin :
// des nombres seulement (comptes, connexions, événements, devis, factures par
// mois), jamais un nom, un montant ni un contenu ; les essais sont exclus.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { formatDateTime, formatMonth, type Locale } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import { getOrganizationsActivity } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";
import { uniqueLabels } from "../unique-labels";

export default async function AdminActivityPage() {
  await requireAdmin();
  const t = await getTranslations("AdminActivity");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const { sql, db } = createAppConnection();
  let organizations;
  try {
    organizations = await getOrganizationsActivity(db);
  } finally {
    await sql.end();
  }

  const labels = uniqueLabels(organizations.map((organization) => organization.name));

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("adminActivity.title")} body={tHelp("adminActivity.body")} />
      <p>
        <Link href="/admin">{t("backToAdmin")}</Link>
      </p>
      <p>{t("intro")}</p>
      {organizations.length === 0 ? <p>{t("empty")}</p> : null}
      {organizations.map((organization, position) => (
        <div key={organization.id} className="card">
          <h2>{organization.name}</h2>
          <ul aria-label={t("summaryOf", { organization: labels[position]! })}>
            <li>{t("teamAccounts", { count: organization.teamAccounts })}</li>
            <li>{t("clientAccounts", { count: organization.clientAccounts })}</li>
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
    </main>
  );
}
