// HUB-03, revu au lot 13 (HUB-17, ADR 0033) — organisations en tableau :
// modules souscrits, comptes d'équipe, prise en main, dernière connexion.
// Une ligne ouvre un panneau (?organisation=id) : modules à activer ou
// désactiver, comptes, prise en main ; « Nouvelle organisation » ouvre le
// formulaire de création (?panneau=nouvelle). Recherche par nom, 20 par page.
// Aucune donnée métier (ADR 0029) : des comptes, des dates et des nombres.
import { PageHeader } from "@/app/ui/page-header";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, formatMonth, type Locale } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import { foldSearchText } from "@symbola/db/search";
import {
  getOrganizationsActivity,
  listOrganizationModuleStates,
  listOrganizationsSupport,
  listTeamHelpProgress,
  MODULE_KEYS,
} from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";
import { TUTORIALS } from "@/lib/help/catalog";
import { FilterBar } from "@/app/ui/filter-bar";
import { ListRow, ListTable } from "@/app/ui/list-table";
import { SidePanel } from "@/app/ui/side-panel";
import { paginate, Pagination } from "@/app/ui/pagination";
import { AdminOrganizationForm } from "./organization-form";
import { toggleModuleAction } from "./actions";

const BASE = "/admin/organisations";

type Query = { q?: string | undefined; page?: string | undefined; organisation?: string | undefined; panneau?: string | undefined };

function href(query: Query, changes: Partial<Query>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...changes })) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
}

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireAdmin();
  const t = await getTranslations("Admin");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  const tPage = await getTranslations("Pagination");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const now = new Date();

  const { sql, db } = createAppConnection();
  let activity, support, help, modules;
  try {
    [activity, support, help, modules] = await Promise.all([
      getOrganizationsActivity(db, { now }),
      listOrganizationsSupport(db, now),
      listTeamHelpProgress(db),
      listOrganizationModuleStates(db, MODULE_KEYS),
    ]);
  } finally {
    await sql.end();
  }

  // Prise en main : part des tutoriels proposés à l'organisation que l'équipe a terminés.
  const onboarding = (organizationId: string) => {
    const progress = help.find((organization) => organization.id === organizationId);
    if (!progress) return null;
    const available = TUTORIALS.filter((tutorial) => tutorial.module === "hub" || (progress.modules as Record<string, boolean | undefined>)[tutorial.module]);
    const done = available.filter((tutorial) =>
      progress.accounts.some((account) => account.help.some((entry) => entry.itemKey === `tutorial:${tutorial.key}` && entry.status === "completed")),
    ).length;
    return { done, total: available.length };
  };

  const needle = foldSearchText((query.q ?? "").trim());
  const matching = needle ? activity.filter((organization) => foldSearchText(organization.name).includes(needle)) : activity;
  const page = paginate(matching, query.page);
  const opened = query.organisation ? activity.find((organization) => organization.id === query.organisation) : undefined;
  const openedSupport = opened ? support.find((organization) => organization.id === opened.id) : undefined;
  const creating = query.panneau === "nouvelle";
  const closeHref = href(query, { organisation: undefined, panneau: undefined });

  return (
    <main>
      <PageHeader
        title={t("organizationsTitle")}
        actions={
          <Link href={href(query, { panneau: "nouvelle", organisation: undefined })} scroll={false} className="button-link button-link-primary">
            {t("newOrganization")}
          </Link>
        }
      />
      <ScreenHelp title={tHelp("adminOrganizations.title")} body={tHelp("adminOrganizations.body")} />

      <FilterBar label={t("filtersLabel")} applyLabel={t("filter")}>
        <label>
          {t("searchName")}
          <input type="search" name="q" defaultValue={query.q ?? ""} />
        </label>
      </FilterBar>
      <p className="muted" role="status">
        {t("resultCount", { count: page.total })}
      </p>

      {page.items.length === 0 ? (
        <p>{t("noOrganization")}</p>
      ) : (
        <ListTable
          label={t("listTitle")}
          head={
            <tr>
              <th scope="col">{t("name")}</th>
              <th scope="col">{t("modules")}</th>
              <th scope="col" className="num">
                {t("accounts")}
              </th>
              <th scope="col">{t("onboarding")}</th>
              <th scope="col">{t("lastLogin")}</th>
            </tr>
          }
        >
          {page.items.map((organization) => {
            const rowHref = href(query, { organisation: organization.id, panneau: undefined });
            const progress = onboarding(organization.id);
            const enabled = MODULE_KEYS.filter((moduleKey) => modules[organization.id]?.[moduleKey]);
            return (
              <ListRow key={organization.id} href={rowHref}>
                <th scope="row">
                  <Link href={rowHref} scroll={false}>
                    {organization.name}
                  </Link>
                  <span className="cell-note">{t("since", { month: formatMonth(organization.createdAt.toISOString().slice(0, 10), locale) })}</span>
                </th>
                <td>
                  <span className="pill-list">
                    {enabled.map((moduleKey) => (
                      <span key={moduleKey} className="badge">
                        {t(`moduleNames.${moduleKey}`)}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="num">{organization.teamAccounts}</td>
                <td>
                  {progress && progress.done > 0 ? (
                    t("onboardingDone", { done: progress.done, total: progress.total })
                  ) : (
                    <span className="badge badge-ambre">{t("notStarted")}</span>
                  )}
                </td>
                <td>{organization.lastLoginAt ? formatDateTime(organization.lastLoginAt, locale) : "—"}</td>
              </ListRow>
            );
          })}
        </ListTable>
      )}
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        basePath={BASE}
        params={{ q: query.q }}
        labels={{
          nav: tPage("label"),
          previous: tPage("previous"),
          next: tPage("next"),
          status: tPage("status", { page: page.page, count: page.pageCount }),
        }}
      />

      {opened ? (
        <SidePanel title={opened.name} closeHref={closeHref} closeLabel={tCommon("closePanel")}>
          <section aria-labelledby="org-modules-title" className="panel-section">
            <h3 id="org-modules-title">{t("modules")}</h3>
            <ul className="toggle-list">
              {MODULE_KEYS.map((moduleKey) => {
                const enabled = modules[opened.id]?.[moduleKey] ?? true;
                return (
                  <li key={moduleKey}>
                    <span>{t(`moduleNames.${moduleKey}`)}</span>
                    <form action={toggleModuleAction} className="inline-form">
                      <input type="hidden" name="organizationId" value={opened.id} />
                      <input type="hidden" name="moduleKey" value={moduleKey} />
                      <input type="hidden" name="enabled" value={(!enabled).toString()} />
                      <button type="submit" className={enabled ? "button-ghost" : undefined}>
                        {t(enabled ? "moduleEnabledLabel" : "moduleDisabledLabel", { module: moduleKey })}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-labelledby="org-accounts-title" className="panel-section">
            <h3 id="org-accounts-title">{t("accounts")}</h3>
            {openedSupport && openedSupport.accounts.length > 0 ? (
              <ul className="plain-list">
                {openedSupport.accounts.map((account) => (
                  <li key={account.userId}>
                    {account.email} · {t(account.role === "owner" ? "roleOwner" : "roleMember")} · {t(account.mfaConfigured ? "mfaConfigured" : "mfaPending")}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{openedSupport && openedSupport.pendingInvitations.length > 0 ? t("invitationPending") : t("noAccount")}</p>
            )}
            <p>
              <Link href={`/admin/comptes?q=${encodeURIComponent(opened.name)}`}>{t("seeAccounts")}</Link>
            </p>
          </section>
          <section aria-labelledby="org-onboarding-title" className="panel-section">
            <h3 id="org-onboarding-title">{t("onboarding")}</h3>
            <p>
              {(() => {
                const progress = onboarding(opened.id);
                return progress ? t("onboardingDone", { done: progress.done, total: progress.total }) : t("notStarted");
              })()}
            </p>
            <p>{opened.lastLoginAt ? t("lastLoginAt", { date: formatDateTime(opened.lastLoginAt, locale) }) : t("neverLoggedIn")}</p>
          </section>
        </SidePanel>
      ) : null}
      {creating ? (
        <SidePanel title={t("createOrganizationTitle")} closeHref={closeHref} closeLabel={tCommon("closePanel")}>
          <AdminOrganizationForm />
        </SidePanel>
      ) : null}
    </main>
  );
}
