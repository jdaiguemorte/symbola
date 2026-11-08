// HUB-11 (lot 10) — prise en main des organisations : visites et tutoriels
// suivis par chaque compte d'équipe. Aucune donnée d'événement, aucun mot
// cherché : la progression dans l'aide seulement (ADR 0029).
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { listTeamHelpProgress } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { TUTORIALS } from "@/lib/help/catalog";
import { uniqueLabels } from "../unique-labels";
import { AdminListPagination, AdminListSearch, filterByName } from "../admin-list";
import { paginate } from "@/app/ui/pagination";

const DAY_MS = 86_400_000;

export default async function AdminOnboardingPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const t = await getTranslations("AdminOnboarding");
  const tHelp = await getTranslations("Help");
  const tCenter = await getTranslations("HelpCenter");
  const locale = (await getLocale()) as Locale;
  const now = Date.now();

  const db = appDatabase();
  const organizations = await listTeamHelpProgress(db);

  const rows = organizations.map((organization) => {
    const available = TUTORIALS.filter((tutorial) => tutorial.module === "hub" || (organization.modules as Record<string, boolean | undefined>)[tutorial.module]);
    return {
      ...organization,
      total: available.length,
      accounts: organization.accounts.map((account) => {
        const tutorialEntries = account.help.filter((entry) => available.some((tutorial) => entry.itemKey === `tutorial:${tutorial.key}`));
        const done = tutorialEntries.filter((entry) => entry.status === "completed");
        const inProgress = tutorialEntries.filter((entry) => entry.status !== "completed");
        const last = account.help.reduce<Date | null>((latest, entry) => (!latest || entry.updatedAt > latest ? entry.updatedAt : latest), null);
        return {
          ...account,
          completed: done.length,
          doneTitles: done.map((entry) => tCenter(`items.${entry.itemKey.slice("tutorial:".length)}.title`)),
          inProgressTitles: inProgress.map((entry) => `${tCenter(`items.${entry.itemKey.slice("tutorial:".length)}.title`)} · ${t("step", { step: entry.step + 1 })}`),
          last,
        };
      }),
    };
  });
  const allAccounts = rows.flatMap((organization) => organization.accounts.map((account) => ({ ...account, total: organization.total })));
  const average = allAccounts.length > 0 ? Math.round((allAccounts.reduce((sum, account) => sum + account.completed / Math.max(account.total, 1), 0) / allAccounts.length) * 100) : 0;
  const recentDone = allAccounts.flatMap((account) => account.help).filter((entry) => entry.itemKey.startsWith("tutorial:") && entry.completedAt && now - entry.completedAt.getTime() <= 30 * DAY_MS).length;
  const { q, page: pageParam } = await searchParams;
  const page = paginate(filterByName(rows, q), pageParam);
  const labels = uniqueLabels(page.items.map((organization) => organization.name));

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("adminOnboarding.title")} body={tHelp("adminOnboarding.body")} />
      <p>{t("intro")}</p>
      <ul className="kpi-list" aria-label={t("summary")}>
        <li>
          <span>{t("averageProgress")}</span> <strong>{average} %</strong>
        </li>
        <li>
          <span>{t("recentDone")}</span> <strong>{recentDone}</strong>
        </li>
      </ul>
      <AdminListSearch q={q} total={page.total} />
      {page.items.length === 0 ? <p>{t("empty")}</p> : null}
      {page.items.map((organization, position) => (
        <div key={organization.id} className="card">
          <h2>{organization.name}</h2>
          <div role="region" aria-label={t("tableOf", { organization: labels[position]! })} tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("account")}</th>
                  <th scope="col">{t("progress")}</th>
                  <th scope="col">{t("done")}</th>
                  <th scope="col">{t("inProgress")}</th>
                  <th scope="col">{t("lastActivity")}</th>
                </tr>
              </thead>
              <tbody>
                {organization.accounts.map((account) => (
                  <tr key={account.userId}>
                    <th scope="row">
                      {account.email} · {t(account.role === "owner" ? "roleOwner" : "roleMember")}
                    </th>
                    <td>
                      <progress value={account.completed} max={Math.max(organization.total, 1)} aria-label={t("progressOf", { email: account.email })} />{" "}
                      {t("progressValue", { completed: account.completed, total: organization.total })}
                    </td>
                    <td>{account.doneTitles.length > 0 ? account.doneTitles.join(", ") : "—"}</td>
                    <td>{account.inProgressTitles.length > 0 ? account.inProgressTitles.join(", ") : "—"}</td>
                    <td>{account.last ? formatDateTime(account.last, locale) : t("never")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <AdminListPagination page={page} basePath="/admin/prise-en-main" q={q} />
    </main>
  );
}
