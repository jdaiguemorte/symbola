import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getOrganizationProfile } from "@/modules/hub/service";
import { getQuote, listCatalogItems, QuoteNotFoundError, type QuoteDetail } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled, isValidId } from "../module-access";
import { QUOTE_STATUS_LABEL_KEYS } from "../quote-display";
import { removeLineAction } from "./actions";
import {
  AddCatalogLineForm,
  AddFreeLineForm,
  EditLineForm,
  GlobalDiscountForm,
  ReviseQuoteForm,
  SendQuoteForm,
} from "./quote-forms";
import { QuoteVersionTable } from "./quote-totals";

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const { quoteId } = await params;
  if (!isValidId(quoteId)) notFound();
  let quote: QuoteDetail;
  try {
    quote = await getQuote(organizationId, quoteId);
  } catch (error) {
    if (error instanceof QuoteNotFoundError) notFound();
    throw error;
  }

  const { sql, db } = createAppConnection();
  let profile;
  try {
    profile = await getOrganizationProfile(db, organizationId);
  } finally {
    await sql.end();
  }
  const [event, catalog] = await Promise.all([getEvent(organizationId, quote.eventId), listCatalogItems(organizationId)]);
  const clientNames = event?.clients.map((client) => client.firstName).join(" & ") || t("noClient");

  const current = quote.current;
  const isDraft = current.sentAt === null;
  // Brouillon : aperçu de la mention qui sera figée à l'envoi (issue du hub,
  // jamais en dur ici) ; version envoyée : sa copie figée.
  const legalMention = isDraft ? computeLegalMention(profile) || null : current.legalMention;
  const defaultRate = profile.vatRateDefaultBasisPoints ?? 0;
  const olderVersions = quote.versions.filter((version) => version.version !== current.version).reverse();

  return (
    <main>
      <h1>{t("quoteTitle", { number: quote.number })}</h1>
      {quote.isDemo ? <p role="status">{t("demoQuote")}</p> : null}
      <HelpButton title={tHelp("quotesDetail.title")} body={tHelp("quotesDetail.body")} />
      <p>
        {t("forEvent")} <Link href={`/events/${quote.eventId}`}>{clientNames}</Link>
        {event?.eventDate ? ` — ${formatCalendarDate(event.eventDate, locale)}` : ""}
      </p>
      <p>
        {t("statusLabel")} : {t(QUOTE_STATUS_LABEL_KEYS[quote.status])} — {t("versionLabel", { version: current.version })}
      </p>
      {/* Après l'envoi, le formulaire disparaît : l'état figé est annoncé ici. */}
      {current.sentAt ? (
        <p role="status">
          {t("quoteSent")} {t("sentOn", { date: formatDateTime(new Date(current.sentAt), locale) })}
        </p>
      ) : null}
      {current.validUntil ? <p>{t("validUntil", { date: formatCalendarDate(current.validUntil, locale) })}</p> : null}

      {/* ONB-02 : le régime a changé depuis l'envoi, le devis n'est pas signé. */}
      {quote.regimeChangedSinceSent ? (
        <section aria-labelledby="regime-changed-title">
          <h2 id="regime-changed-title">{t("regimeChangedTitle")}</h2>
          <p>{t("regimeChangedBody")}</p>
          <ReviseQuoteForm quoteId={quote.id} label={t("reviseWithNewRegime")} />
        </section>
      ) : null}

      <QuoteVersionTable version={current} locale={locale} caption={t("linesCaption", { version: current.version })} />
      {current.lines.length === 0 ? <p>{t("noLines")}</p> : null}
      {legalMention ? <p>{legalMention}</p> : null}
      {!isDraft || current.lines.length > 0 ? (
        <p>
          <a href={`/devis/${quote.id}/pdf?version=${current.version}`}>{t("downloadPdf", { version: current.version })}</a>
        </p>
      ) : null}

      {isDraft ? (
        <>
          <h2>{t("composeTitle")}</h2>
          {current.lines.length > 0 ? (
            <ul>
              {current.lines.map((line) => (
                <li key={line.id}>
                  <details>
                    <summary>{t("editLineNamed", { label: line.label })}</summary>
                    <EditLineForm quoteId={quote.id} line={line} vatApplicable={current.vatApplicable} />
                  </details>
                  <form action={removeLineAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <button type="submit">{t("removeLine", { label: line.label })}</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <h3>{t("addFromCatalog")}</h3>
          {catalog.length === 0 ? (
            <p>
              {t("emptyCatalog")} <Link href="/devis/catalogue">{t("catalogLink")}</Link>
            </p>
          ) : (
            <AddCatalogLineForm quoteId={quote.id} items={catalog} />
          )}
          <h3>{t("addFreeLine")}</h3>
          <AddFreeLineForm quoteId={quote.id} vatApplicable={current.vatApplicable} defaultVatRateBasisPoints={defaultRate} />
          <h3>{t("globalDiscount")}</h3>
          <GlobalDiscountForm quoteId={quote.id} discount={current.globalDiscount} />
          <h2>{t("sendTitle")}</h2>
          <SendQuoteForm quoteId={quote.id} />
        </>
      ) : quote.status === "sent" && !quote.regimeChangedSinceSent ? (
        <>
          <h2>{t("reviseTitle")}</h2>
          <p>{t("reviseHint")}</p>
          <ReviseQuoteForm quoteId={quote.id} label={t("reviseQuote")} />
        </>
      ) : null}

      {olderVersions.length > 0 ? (
        <section aria-labelledby="versions-title">
          <h2 id="versions-title">{t("previousVersions")}</h2>
          <ul>
            {olderVersions.map((version) => (
              <li key={version.id}>
                <details>
                  <summary>
                    {t("versionLabel", { version: version.version })}
                    {version.sentAt ? ` — ${t("sentOn", { date: formatDateTime(new Date(version.sentAt), locale) })}` : ""}
                  </summary>
                  <QuoteVersionTable version={version} locale={locale} caption={t("linesCaption", { version: version.version })} />
                  {version.legalMention ? <p>{version.legalMention}</p> : null}
                </details>
                <a href={`/devis/${quote.id}/pdf?version=${version.version}`}>{t("downloadPdf", { version: version.version })}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
