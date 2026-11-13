import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getEvent } from "@/modules/events/service";
import { computeLegalMention, getOrganizationProfile } from "@/modules/hub/service";
import {
  getQuote,
  listCatalogItems,
  listPaymentMethods,
  listQuoteInvoices,
  listQuoteTemplates,
  quoteMissingMentions,
  QuoteNotFoundError,
  type QuoteDetail,
} from "@/modules/quotes/service";
import { MissingMentionsList } from "../missing-mentions";
import { requirePlanner } from "@/lib/guards";
import { isQuotesModuleEnabled, isValidId } from "../module-access";
import { parisTodayString, QUOTE_STATUS_LABEL_KEYS } from "../quote-display";
import { removeLineAction, removeSectionAction } from "./actions";
import {
  AddCatalogLineForm,
  AddFreeLineForm,
  AddSectionForm,
  AdvanceKindForm,
  ChooseOptionsForm,
  EditLineForm,
  GlobalDiscountForm,
  RenameSectionForm,
  ReviseQuoteForm,
  SaveAsTemplateForm,
  SendQuoteForm,
} from "./quote-forms";
import { QuoteVersionTable } from "./quote-totals";
import { ScheduleSection } from "./schedule-section";
import { PageHeader } from "@/app/ui/page-header";
import { InvoicesSection } from "./invoices-section";
import { SignatureSection } from "./signature-section";

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const auth = await requirePlanner();
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

  const db = appDatabase();
  const profile = await getOrganizationProfile(db, organizationId);
  const [event, catalog, paymentMethods, invoices, templates] = await Promise.all([
    getEvent(organizationId, quote.eventId),
    listCatalogItems(organizationId),
    listPaymentMethods(organizationId),
    listQuoteInvoices(organizationId, quote.id),
    listQuoteTemplates(organizationId),
  ]);
  const clientNames = event?.clients.map((client) => client.firstName).join(" & ") || t("noClient");

  const current = quote.current;
  const isDraft = current.sentAt === null;
  // Brouillon : aperçu de la mention qui sera figée à l'envoi (issue du hub,
  // jamais en dur ici) ; version envoyée : sa copie figée.
  const legalMention = isDraft ? computeLegalMention(profile) || null : current.legalMention;
  const defaultRate = profile.vatRateDefaultBasisPoints ?? 0;
  const olderVersions = quote.versions.filter((version) => version.version !== current.version).reverse();
  // Lot 31a (FAC-07, JUR-08 ; D4, D5) : ce qui manque pour envoyer, nommé, avec où le remplir.
  const missingMentions = isDraft ? await quoteMissingMentions(organizationId, quote.id) : [];
  const options = current.lines.filter((line) => line.isOption);
  const optionsOpen = quote.status === "sent" && !quote.signature && options.length > 0;

  return (
    <main>
      {/* Lot 16 (L16-HUB-20) : en-tête commun — statut en badge, événement en sous-titre, PDF en action. */}
      <PageHeader
        title={t("quoteTitle", { number: quote.number })}
        badge={<span className="badge">{t("statusBadge", { status: t(QUOTE_STATUS_LABEL_KEYS[quote.status]), version: current.version })}</span>}
        subtitle={
          <>
            {t("forEvent")} <Link href={`/events/${quote.eventId}`}>{clientNames}</Link>
            {event?.eventDate ? ` — ${formatCalendarDate(event.eventDate, locale)}` : ""}
          </>
        }
        actions={
          !isDraft || current.lines.length > 0 ? (
            <a href={`/devis/${quote.id}/pdf?version=${current.version}`} className="button-link">
              {t("downloadPdf", { version: current.version })}
            </a>
          ) : null
        }
      />
      {quote.isDemo ? <p role="status">{t("demoQuote")}</p> : null}
      <ScreenHelp title={tHelp("quotesDetail.title")} body={tHelp("quotesDetail.body")} />
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
      {current.template ? <p className="meta">{t("fromTemplateVersion", { version: current.template.version })}</p> : null}

      {/* Lot 31a (FAC-01, D2) : options choisies par le client (ou par la planner pour lui). */}
      {!isDraft && options.length > 0 ? (
        <section aria-labelledby="options-choice-title">
          <h2 id="options-choice-title">{t("optionsChoiceTitle")}</h2>
          {current.optionsChoice ? (
            <p>
              {t(current.optionsChoice.byKind === "client" ? "optionsChosenByClient" : "optionsChosenByPlanner", {
                name: current.optionsChoice.chosenBy,
                date: formatDateTime(new Date(current.optionsChoice.chosenAt), locale),
              })}
            </p>
          ) : (
            <p>{t("optionsNotChosenYet")}</p>
          )}
          {optionsOpen ? <ChooseOptionsForm quoteId={quote.id} options={options} /> : <p className="meta">{t("optionsLockedHint")}</p>}
        </section>
      ) : null}

      {/* Lot 31a (JUR-08, D5) : acompte ou arrhes. */}
      <section id="acompte-arrhes" aria-labelledby="advance-kind-title">
        <h2 id="advance-kind-title">{t("advanceKindTitle")}</h2>
        <p className="meta">{t("advanceKindHint")}</p>
        {isDraft ? (
          <AdvanceKindForm quoteId={quote.id} value={current.advanceKind} />
        ) : (
          <p>{current.advanceKind === "earnest" ? t("advanceEarnest") : current.advanceKind === "deposit" ? t("advanceDeposit") : t("advanceUnset")}</p>
        )}
      </section>

      <ScheduleSection quote={quote} methods={paymentMethods} locale={locale} today={parisTodayString()} />
      <SignatureSection organizationId={organizationId} quote={quote} event={event} />
      <InvoicesSection quote={quote} invoices={invoices} locale={locale} />

      {isDraft ? (
        <>
          <h2>{t("composeTitle")}</h2>
          {/* Lot 31a (FAC-01, D2) : sections titrées, chacune avec son sous-total. */}
          <h3>{t("sectionsTitle")}</h3>
          {current.sections.length > 0 ? (
            <ul>
              {current.sections.map((section) => (
                <li key={section.id}>
                  <details>
                    <summary>{t("renameSectionNamed", { title: section.title })}</summary>
                    <RenameSectionForm quoteId={quote.id} section={section} />
                  </details>
                  <form action={removeSectionAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="sectionId" value={section.id} />
                    <button type="submit">{t("removeSection", { title: section.title })}</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="meta">{t("noSections")}</p>
          )}
          <AddSectionForm quoteId={quote.id} />
          {current.lines.length > 0 ? (
            <ul>
              {current.lines.map((line) => (
                <li key={line.id}>
                  <details>
                    <summary>{t("editLineNamed", { label: line.label })}</summary>
                    <EditLineForm quoteId={quote.id} line={line} vatApplicable={current.vatApplicable} sections={current.sections} />
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
            <AddCatalogLineForm quoteId={quote.id} items={catalog} sections={current.sections} />
          )}
          <h3>{t("addFreeLine")}</h3>
          <AddFreeLineForm quoteId={quote.id} vatApplicable={current.vatApplicable} defaultVatRateBasisPoints={defaultRate} sections={current.sections} />
          <h3>{t("globalDiscount")}</h3>
          <GlobalDiscountForm quoteId={quote.id} discount={current.globalDiscount} />
          <h2>{t("sendTitle")}</h2>
          {/* Lot 31a (FAC-07, D4) : avant l'envoi, chaque mention manquante est nommée. */}
          {missingMentions.length > 0 ? (
            <div role="note" aria-labelledby="missing-mentions-title" className="missing-mentions-panel">
              <p id="missing-mentions-title">{t("mentionsMissingBeforeSend")}</p>
              <MissingMentionsList fields={missingMentions} />
            </div>
          ) : null}
          <SendQuoteForm quoteId={quote.id} />
        </>
      ) : ((quote.status === "sent" && quote.signature?.status !== "pending") || quote.status === "declined") &&
        !quote.regimeChangedSinceSent ? (
        <>
          <h2>{t("reviseTitle")}</h2>
          <p>{t("reviseHint")}</p>
          <ReviseQuoteForm quoteId={quote.id} label={t("reviseQuote")} />
        </>
      ) : null}

      {/* Lot 31a (HUB-21, D3) : le devis devient modèle, ou remplace un modèle (version + 1). */}
      {current.lines.length > 0 ? (
        <section aria-labelledby="save-template-title">
          <h2 id="save-template-title">{t("saveAsTemplate")}</h2>
          <p className="meta">{t("saveAsTemplateHint")}</p>
          <SaveAsTemplateForm quoteId={quote.id} templates={templates} />
        </section>
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
