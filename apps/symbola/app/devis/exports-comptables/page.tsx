// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097 ; réponse 8 de l'expert-comptable) — exports comptables : la
// période (mois, trimestre, année, exercice), le format proposé d'après la forme juridique (micro :
// journal des recettes ; société ou EI au réel : journaux des ventes et des encaissements, FEC), les PDF
// d'origine en ZIP, et le contrôle de rapprochement, visible et bloquant. La Propriétaire, les Planners
// et le Comptable (lecture seule) y accèdent ; seul le plan de comptes demande d'être planner.
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireAccountingReader } from "@/lib/guards";
import { getOrganizationProfile } from "@/modules/hub/service";
import { accountingFamilyFor, checkAccountingPeriod, formatAllowedForPeriod, FORMATS_BY_FAMILY, getAccountingSettings, listAccountingExports, PERIOD_KINDS, type ReconciliationIssue } from "@/modules/quotes/service";
import { ACCOUNTING_FAMILIES } from "@symbola/starter-templates";
import { isQuotesModuleEnabled } from "../module-access";
import { parseFamily, parsePeriod, periodIndex, periodSearch, type ExportQuery } from "./export-query";
import { AccountingSettingsForm } from "./settings-form";

export default async function AccountingExportsPage({ searchParams }: { searchParams: Promise<ExportQuery> }) {
  const auth = (await requireAccountingReader())!;
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("AccountingExports");
  const tHelp = await getTranslations("Help");
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <PageHeader title={t("title")} />
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const settings = await getAccountingSettings(organizationId, locale === "en" ? "en" : "fr");
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  const suggested = accountingFamilyFor(profile.legalForm).family;
  const family = parseFamily(query.famille, suggested);
  const period = parsePeriod(query, settings.fiscalYearStartMonth);
  const { reconciliation } = await checkAccountingPeriod(organizationId, period);
  const history = await listAccountingExports(organizationId);
  const money = (cents: number) => formatAmount(cents, locale);
  const year = Number(period.start.slice(0, 4));
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, index, 1))));
  const issueText = (issue: ReconciliationIssue) => {
    switch (issue.kind) {
      case "missing_number":
      case "unbalanced":
      case "missing_original":
        return t(`issues.${issue.kind}`, { number: issue.number });
      case "total_mismatch":
        return t("issues.total_mismatch", { total: t(`totals.${issue.total}`), exportAmount: money(issue.exportCents), expectedAmount: money(issue.expectedCents) });
    }
  };
  const search = periodSearch(period, family);

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("accountingExports.title")} body={tHelp("accountingExports.body")} />
      {auth.readOnly ? (
        <p>
          <span className="badge">{t("readOnly")}</span>
        </p>
      ) : null}
      <section className="card stack" aria-labelledby="period-title">
        <h2 id="period-title">{t("periodTitle")}</h2>
        <form method="get" className="row-wrap">
          <label>
            {t("periodKind")}
            <select name="type" defaultValue={period.kind}>
              {PERIOD_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`periodKinds.${kind}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("year")}
            <input name="annee" inputMode="numeric" pattern="\d{4}" defaultValue={String(year)} size={4} />
          </label>
          <label>
            {`${t("month")} / ${t("quarter")}`}
            <select name="index" defaultValue={String(periodIndex(period))}>
              {months.map((month, index) => (
                <option key={index} value={index + 1}>
                  {index < 4 ? `${month} · ${t("quarterOption", { index: index + 1 })}` : month}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("familyLabel")}
            <select name="famille" defaultValue={family}>
              {ACCOUNTING_FAMILIES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {t(`families.${candidate}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{t("show")}</button>
        </form>
        <p>
          <strong>{t("periodLabel", { start: formatCalendarDate(period.start, locale), end: formatCalendarDate(period.end, locale) })}</strong>
        </p>
        <p className="muted">{t("familyDefault")}</p>
      </section>

      <section className="card stack" aria-labelledby="check-title" data-testid="reconciliation">
        <h2 id="check-title">{t("checkTitle")}</h2>
        <dl className="row-wrap">
          <div>
            <dt>{t("invoiced")}</dt>
            <dd className="num">{money(reconciliation.invoicedCents)}</dd>
          </div>
          <div>
            <dt>{t("credited")}</dt>
            <dd className="num">{money(reconciliation.creditedCents)}</dd>
          </div>
          <div>
            <dt>{t("received")}</dt>
            <dd className="num">{money(reconciliation.receivedCents)}</dd>
          </div>
          <div>
            <dt>{t("documents")}</dt>
            <dd className="num">{reconciliation.documentCount}</dd>
          </div>
        </dl>
        {reconciliation.ok ? (
          <p role="status">{t("checkOk")}</p>
        ) : (
          <div role="alert">
            <p>{t("checkBlocked")}</p>
            <ul>
              {reconciliation.issues.map((issue, index) => (
                <li key={index}>{issueText(issue)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="files-title">
        <h2 id="files-title">{t("filesTitle")}</h2>
        <ul className="plain-list stack">
          {FORMATS_BY_FAMILY[family].map((format) => (
            <li key={format} className="row-wrap">
              <span>{t(`formats.${format}`)}</span>
              {!formatAllowedForPeriod(format, period.kind) ? (
                <span className="muted">{t("fecYearOnly")}</span>
              ) : reconciliation.ok ? (
                <a className="button-link" href={`/devis/exports-comptables/telecharger?${search}&format=${format}`} aria-label={t("downloadLabel", { format: t(`formats.${format}`) })}>
                  {t("download")}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {auth.readOnly ? null : (
        <section className="card stack" aria-labelledby="settings-title">
          <h2 id="settings-title">{t("settingsTitle")}</h2>
          <p className="muted">{t("settingsHelp")}</p>
          <AccountingSettingsForm fiscalYearStartMonth={settings.fiscalYearStartMonth} plan={settings.plan} months={months} />
        </section>
      )}

      <section className="card stack" aria-labelledby="history-title">
        <h2 id="history-title">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <p>{t("historyEmpty")}</p>
        ) : (
          <div className="list-table-wrap" role="region" aria-label={t("historyLabel")} tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("historyDate")}</th>
                  <th scope="col">{t("historyFormat")}</th>
                  <th scope="col">{t("historyPeriod")}</th>
                  <th scope="col">{t("historyStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">{formatDateTime(new Date(entry.createdAt), locale)}</th>
                    <td>{t(`formats.${entry.format}`)}</td>
                    <td>{t("periodLabel", { start: formatCalendarDate(entry.periodStart, locale), end: formatCalendarDate(entry.periodEnd, locale) })}</td>
                    <td>{entry.status === "done" ? t("statusDone") : t("statusBlocked")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
