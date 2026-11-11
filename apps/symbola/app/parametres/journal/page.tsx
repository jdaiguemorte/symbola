import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AUDIT_CATEGORIES } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { FilterBar } from "@/app/ui/filter-bar";
import { PageHeader } from "@/app/ui/page-header";
import { Pagination } from "@/app/ui/pagination";
import { requireOwner } from "@/lib/guards";
import { ACTIVITY_PERIODS, listActivityLog, parseActivityFilters } from "@/modules/hub/service";
import { actionLabel, activityDetail, actorLabel, objectHref } from "./activity-summary";

type Query = { periode?: string; famille?: string; personne?: string; page?: string };

// Lot 23 (HUB-16, SEC-19, ADR 0060) — journal d'activité de l'organisation :
// qui, quoi, quand, sur quel objet. Titulaire du compte seulement (décision
// D4) ; lignes en ajout seul, que personne ne peut modifier ni effacer.
export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requireOwner();
  const t = await getTranslations("ActivityLog");
  const tHelp = await getTranslations("Help");
  const tPage = await getTranslations("Pagination");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const filters = parseActivityFilters(query);
  const log = await listActivityLog(appDatabase(), auth.user.organizationId, filters);
  const translate = (key: string, values?: Record<string, string | number>) => t(key as never, values as never);
  const has = (key: string) => t.has(key as never);
  const period = filters.periodDays === null ? "tout" : String(filters.periodDays);

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("activityLog.title")} body={tHelp("activityLog.body")} />

      <FilterBar label={t("filtersLabel")} applyLabel={t("apply")} even>
        <label>
          {t("person")}
          <select name="personne" defaultValue={filters.actorId ?? ""}>
            <option value="">{t("personAll")}</option>
            {log.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("period")}
          <select name="periode" defaultValue={period}>
            {ACTIVITY_PERIODS.map((days) => (
              <option key={days} value={String(days)}>
                {t("periodDays", { days })}
              </option>
            ))}
            <option value="tout">{t("periodAll")}</option>
          </select>
        </label>
        <label>
          {t("category")}
          <select name="famille" defaultValue={filters.category ?? ""}>
            <option value="">{t("categoryAll")}</option>
            {AUDIT_CATEGORIES.filter((category) => category !== "administration").map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>
      <p className="muted" role="status">
        {t("total", { count: log.total })}
      </p>

      {log.entries.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="list-table-wrap" role="region" aria-label={t("listLabel")} tabIndex={0}>
          <table className="list-table activity-log">
            <thead>
              <tr>
                <th scope="col">{t("columnWhen")}</th>
                <th scope="col">{t("columnWho")}</th>
                <th scope="col">{t("columnWhat")}</th>
                <th scope="col">{t("columnObject")}</th>
              </tr>
            </thead>
            <tbody>
              {log.entries.map((entry) => {
                const detail = activityDetail(entry, translate, locale);
                const link = objectHref(entry);
                return (
                  <tr key={entry.id}>
                    <td className="num">
                      <time dateTime={entry.occurredAt.toISOString()}>{formatDateTime(entry.occurredAt, locale)}</time>
                    </td>
                    <td>{actorLabel(entry, translate)}</td>
                    <td>
                      <span className="activity-action">{actionLabel(entry, translate, has)}</span>
                      <span className="muted"> · {t(`categories.${entry.category}`)}</span>
                    </td>
                    <td>
                      {detail ? <span>{detail}</span> : null}
                      {link ? (
                        <>
                          {detail ? " · " : null}
                          <Link href={link.href}>{link.kind === "quote" ? t("openQuote") : t("openEvent")}</Link>
                        </>
                      ) : null}
                      {!detail && !link ? <span className="muted">—</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={log.page}
        pageCount={log.pageCount}
        basePath="/parametres/journal"
        params={{ periode: query.periode, famille: query.famille, personne: query.personne }}
        labels={{ nav: tPage("label"), previous: tPage("previous"), next: tPage("next"), status: tPage("status", { page: log.page, count: log.pageCount }) }}
      />
    </main>
  );
}
