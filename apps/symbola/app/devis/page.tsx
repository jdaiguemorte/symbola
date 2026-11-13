// DEV-01 — écran « Devis et factures » : tous les devis de l'organisation,
// les plus récents d'abord, filtrables par statut, avec leur mariage. On en
// crée un depuis la fiche de l'événement (onglet Devis).
import { PageHeader } from "@/app/ui/page-header";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { eventNames, listEvents } from "@/modules/events/service";
import { listQuotes, type QuoteStatus } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { SettingsLink } from "@/app/settings-link";
import { isQuotesModuleEnabled } from "./module-access";
import { QUOTE_STATUS_LABEL_KEYS } from "./quote-display";
import { RevenueTiles } from "./revenue-tiles";

const STATUS_CLASSES: Record<QuoteStatus, string> = {
  draft: "badge",
  sent: "badge badge-ambre",
  signed: "badge badge-sauge",
  declined: "badge badge-terracotta",
  expired: "badge",
};
const FILTERS = ["tous", "draft", "sent", "signed", "declined", "expired"] as const;

export default async function QuotesListPage({ searchParams }: { searchParams: Promise<{ statut?: string; annee?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("allQuotesTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const filter = FILTERS.includes(query.statut as (typeof FILTERS)[number]) ? (query.statut as (typeof FILTERS)[number]) : "tous";
  // Noms des mariés : par la porte d'entrée du module Événements (ADR 0011).
  const [quotes, events] = await Promise.all([listQuotes(organizationId), listEvents({ organizationId })]);
  const names = new Map(events.map((event) => [event.id, eventNames(event.clients)]));
  const shown = filter === "tous" ? quotes : quotes.filter((quote) => quote.status === filter);

  return (
    <main>
      <PageHeader
        title={t("allQuotesTitle")}
        subtitle={<span>{t("allQuotesIntro")}</span>}
        actions={<SettingsLink href="/devis/parametres" label={t("settingsTitle")} />}
      />
      <ScreenHelp title={tHelp("allQuotes.title")} body={tHelp("allQuotes.body")} />
      {/* Lot 32a (FAC-12, D8) : signé, facturé, encaissé, sur l'année civile. */}
      <RevenueTiles organizationId={organizationId} locale={locale} basePath="/devis" yearParam={query.annee} preserve={filter === "tous" ? {} : { statut: filter }} />
      {/* Lot 32a : sans nom, la section n'est plus un repère ; le tableau défilant garde le sien (axe landmark-unique). */}
      <section className="card">
        <h2 id="all-quotes-title" className="sr-only">
          {t("allQuotesTitle")}
        </h2>
        <nav aria-label={t("allQuotesFilter")} className="pills">
          {FILTERS.map((key) => (
            <Link key={key} href={key === "tous" ? "/devis" : `/devis?statut=${key}`} aria-current={filter === key ? "true" : undefined}>
              {key === "tous" ? t("allQuotesAll", { count: quotes.length }) : t(QUOTE_STATUS_LABEL_KEYS[key])}
            </Link>
          ))}
        </nav>
        {quotes.length === 0 ? <p>{t("allQuotesEmpty")}</p> : shown.length === 0 ? <p>{t("allQuotesNoneForFilter")}</p> : null}
        {shown.length > 0 ? (
          <div role="region" aria-label={t("allQuotesTitle")} tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("quoteNumberColumn")}</th>
                  <th scope="col">{t("quoteEventColumn")}</th>
                  <th scope="col">{t("quoteStatusColumn")}</th>
                  <th scope="col" className="num">
                    {t("totalTtc")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((quote) => (
                  <tr key={quote.id}>
                    <th scope="row">
                      <Link href={`/devis/${quote.id}`}>{quote.number}</Link>
                    </th>
                    <td>
                      <Link href={`/events/${quote.eventId}?onglet=devis`}>{names.get(quote.eventId) ?? "—"}</Link>
                    </td>
                    <td>
                      <span className={STATUS_CLASSES[quote.status]}>{t(QUOTE_STATUS_LABEL_KEYS[quote.status])}</span>{" "}
                      <span className="text-muted">{t("versionLabel", { version: quote.currentVersion })}</span>
                    </td>
                    <td className="num">{formatAmount(quote.totalTtcCents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
