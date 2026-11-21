import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getEvent, eventNames } from "@/modules/events/service";
import { computeLegalMention, getContactsByIds, getOrganizationProfile } from "@/modules/hub/service";
import {
  getQuote,
  getQuoteScheduledDeposit,
  isSignatureAvailable,
  listCatalogItems,
  listPaymentMethods,
  listQuoteInvoices,
  listQuoteReceipts,
  listQuoteTemplates,
  quoteMissingMentions,
  quoteComplianceFindings,
  QuoteNotFoundError,
  type QuoteDetail,
} from "@/modules/quotes/service";
import { MissingMentionsList } from "../missing-mentions";
import { PlannerMoneySection } from "./planner-money-section";
import { requirePlanner } from "@/lib/guards";
import { isQuotesModuleEnabled, isValidId } from "../module-access";
import { parisTodayString, QUOTE_STATUS_LABEL_KEYS } from "../quote-display";
import { AddCatalogLineForm, AddFreeLineForm, AddSectionForm, AdvanceKindForm, ChooseOptionsForm, GlobalDiscountForm, ReviseQuoteForm, SaveAsTemplateForm } from "./quote-forms";
import { QuoteLinesTable, QuoteTotalsList, QuoteVersionTable } from "./quote-totals";
import { ScheduleSection } from "./schedule-section";
import { PageHeader } from "@/app/ui/page-header";
import { InvoicesSection } from "./invoices-section";
import { SignatureSection } from "./signature-section";
import { ContractSection } from "./contract-section";
import { CompliancePanel } from "../compliance-panel";
import { BuyerDetailsForm } from "./buyer-forms";
import { ProposalSection, SettlementSection } from "./proposal-section";
import { DisclosureButton, DisclosureGroup, DisclosurePanel } from "./disclosure";
import { NextActionButton, NextActionFeedback, NextActionProvider } from "./next-action";
import { QuoteSummary } from "./quote-summary";
import { loadRubricStates } from "./rubric-states";
import { RubricTabs } from "./rubric-tabs";
import { availableRubrics, invoicePlan, nextAction, parseRubric, rubricHref } from "./rubrics";

// Lot 62d (UX-12, UX-13) — le devis en rubriques. L'écran s'ouvre sur les lignes et les totaux ; la
// page de proposition, le paiement et l'acompte, l'acheteur et la livraison, les honoraires et
// commissions, le contrat et la signature, les factures et avoirs sont des onglets, chacun à son adresse
// (`?rubrique=`). L'en-tête porte le seul bouton principal de l'écran : la prochaine action du devis
// selon son statut. Aucune règle de calcul, de numérotation, de signature ou d'immutabilité ne change.
export default async function QuotePage({ params, searchParams }: { params: Promise<{ quoteId: string }>; searchParams: Promise<{ modele?: string; rubrique?: string | string[] }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tRubrics = await getTranslations("QuoteRubrics");
  const tProposal = await getTranslations("QuoteProposal");
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
  const { modele: selectedTemplate, rubrique } = await searchParams;
  if (!isValidId(quoteId)) notFound();
  let quote: QuoteDetail;
  try {
    quote = await getQuote(organizationId, quoteId);
  } catch (error) {
    if (error instanceof QuoteNotFoundError) notFound();
    throw error;
  }

  const [event, invoices, receipts] = await Promise.all([
    getEvent(organizationId, quote.eventId),
    listQuoteInvoices(organizationId, quote.id),
    // Lot 31c (D21) : reçus d'arrhes.
    listQuoteReceipts(organizationId, quote.id),
  ]);
  const clientNames = (event ? eventNames(event.clients, event.name) : "") || t("noClient");

  const current = quote.current;
  const isDraft = current.sentAt === null;
  const rubrics = availableRubrics({ status: quote.status, invoiceCount: invoices.length, receiptCount: receipts.length });
  const rubric = parseRubric(rubrique, rubrics);
  // La prochaine action du devis : le seul bouton principal de l'écran, sur chaque rubrique.
  const next = nextAction({ quote, plan: invoicePlan(quote, invoices), signatureAvailable: isSignatureAvailable(quote.isDemo) });
  const nextLabel =
    next?.kind === "send" ? t("sendQuote") : next?.kind === "revise" ? t(next.reason === "regime" ? "reviseWithNewRegime" : "reviseQuote") : next?.kind === "sign" ? tRubrics("nextSign") : next?.kind === "invoice" ? tRubrics("nextInvoice") : null;
  // Modifier un devis envoyé (nouvelle version) : action secondaire, sauf quand c'est la prochaine action.
  const canRevise = ((quote.status === "sent" && quote.signature?.status !== "pending") || quote.status === "declined") && !quote.regimeChangedSinceSent;

  const header = (
    <PageHeader
      title={t("quoteTitle", { number: quote.number })}
      badge={<span className="badge">{t("statusBadge", { status: t(QUOTE_STATUS_LABEL_KEYS[quote.status]), version: current.version })}</span>}
      subtitle={
        // Un seul bloc de texte : le lien reste dans sa phrase.
        <span>
          {t("forEvent")} <Link href={`/events/${quote.eventId}`}>{clientNames}</Link>
          {event?.eventDate ? ` — ${formatCalendarDate(event.eventDate, locale)}` : ""}
        </span>
      }
      actions={
        <>
          {!isDraft || current.lines.length > 0 ? (
            <>
              {/* Lot 37a (DOC-07, D5) : l'aperçu est le PDF lui-même, rendu à la demande depuis les données de la version, jamais stocké. */}
              <a href={`/devis/${quote.id}/pdf?version=${current.version}&apercu=1`} className="button-link" target="_blank" rel="noopener noreferrer">
                {t("previewPdf", { version: current.version })}
              </a>
              <a href={`/devis/${quote.id}/pdf?version=${current.version}`} className="button-link">
                {t("downloadPdf", { version: current.version })}
              </a>
            </>
          ) : null}
          {/* Lot 43 (FAC-02, UX-17) : l'aperçu « vu par le client » de la version envoyée. */}
          {!isDraft ? (
            <Link href={`/devis/${quote.id}/proposition`} className="button-link">
              {tProposal("previewLink")}
            </Link>
          ) : null}
          {next?.kind === "send" || next?.kind === "revise" ? <NextActionButton quoteId={quote.id} label={nextLabel!} /> : null}
          {/* Sur la rubrique où l'action se fait, son bouton d'envoi est le bouton principal. */}
          {next?.kind === "sign" && rubric !== "contrat" ? (
            <Link href={rubricHref(quote.id, "contrat", "signature")} className="button-link button-link-primary">
              {nextLabel}
            </Link>
          ) : null}
          {next?.kind === "invoice" && rubric !== "factures" ? (
            <Link href={rubricHref(quote.id, "factures")} className="button-link button-link-primary">
              {nextLabel}
            </Link>
          ) : null}
        </>
      }
    />
  );

  return (
    <main className="quote-screen">
      {/* Lot 16 (L16-HUB-20) : en-tête commun — statut en badge, événement en sous-titre, PDF en action. */}
      {next?.kind === "send" || next?.kind === "revise" ? (
        <NextActionProvider action={next.kind}>
          {header}
          <NextActionFeedback label={nextLabel!} successMessage={t(next.kind === "send" ? "quoteSent" : "versionCreated")} />
        </NextActionProvider>
      ) : (
        header
      )}
      {quote.isDemo ? <p role="status">{t("demoQuote")}</p> : null}
      <ScreenHelp title={tHelp("quotesDetail.title")} body={tHelp("quotesDetail.body")} />
      {/* Après l'envoi, la version est figée : l'état est annoncé ici, sur chaque rubrique. */}
      {current.sentAt || current.validUntil ? (
        <div className="quote-status">
          {current.sentAt ? (
            <p role="status">
              {t("quoteSent")} {t("sentOn", { date: formatDateTime(new Date(current.sentAt), locale) })}
            </p>
          ) : null}
          {current.validUntil ? <p>{t("validUntil", { date: formatCalendarDate(current.validUntil, locale) })}</p> : null}
        </div>
      ) : null}

      {/* ONB-02 : le régime a changé depuis l'envoi, le devis n'est pas signé ; la nouvelle version est la prochaine action. */}
      {quote.regimeChangedSinceSent ? (
        <section aria-labelledby="regime-changed-title">
          <h2 id="regime-changed-title">{t("regimeChangedTitle")}</h2>
          <p>{t("regimeChangedBody")}</p>
        </section>
      ) : null}

      <RubricTabs label={tRubrics("nav")} current={rubric} tabs={rubrics.map((item) => ({ rubric: item, label: tRubrics(`rubric_${item}`), href: rubricHref(quote.id, item) }))} />

      {rubric === "lignes" ? <LinesRubric organizationId={organizationId} quote={quote} rubrics={rubrics} invoices={invoices} receipts={receipts} canRevise={canRevise && next?.kind !== "revise"} locale={locale} /> : null}

      {/* Lot 43 (FAC-02, FAC-15 ; D1, D2) : la page de proposition, son mot d'accueil et sa validité. */}
      {rubric === "proposition" ? <ProposalSection organizationId={organizationId} quote={quote} locale={locale} /> : null}

      {rubric === "paiement" ? (
        <>
          {/* Lot 31a (JUR-08, D5) : acompte ou arrhes. */}
          <section id="acompte-arrhes" aria-labelledby="advance-kind-title">
            <h2 id="advance-kind-title">{t("advanceKindTitle")}</h2>
            <p className="field-hint">{t("advanceKindHint")}</p>
            {isDraft ? (
              <AdvanceKindForm quoteId={quote.id} value={current.advanceKind} />
            ) : (
              <p>{current.advanceKind === "earnest" ? t("advanceEarnest") : current.advanceKind === "deposit" ? t("advanceDeposit") : t("advanceUnset")}</p>
            )}
          </section>
          <ScheduleSection quote={quote} methods={await listPaymentMethods(organizationId)} locale={locale} today={parisTodayString()} />
          {/* Lot 43 (FAC-08, FAC-09 ; ADR 0087) : référence, déclaration du payeur, relances de chaque échéance. */}
          <SettlementSection organizationId={organizationId} quote={quote} locale={locale} />
        </>
      ) : null}

      {/* Lot 41 (JUR-02, JUR-13 ; D6, D8) : acheteur, références d'achat, livraison ; modifiables jusqu'à chaque émission. */}
      {rubric === "acheteur" ? <BuyerRubric organizationId={organizationId} quote={quote} event={event} /> : null}

      {/* Lot 48b (BUD-08, PRE-07, JUR-10) : modes, commissions, honoraires, forfait touristique, franchise. */}
      {rubric === "honoraires" ? <PlannerMoneySection organizationId={organizationId} quote={quote} locale={locale} /> : null}

      {rubric === "contrat" ? (
        <>
          {/* Lot 31b (FAC-04, DOC-03 ; D7, D9, D11) : contrat du devis envoyé, signé avec lui. */}
          <ContractSection
            organizationId={organizationId}
            userId={auth.user.id}
            quote={quote}
            eventTypeId={event?.eventTypeId ?? null}
            selectedTemplateId={isValidId(selectedTemplate ?? "") ? (selectedTemplate ?? null) : null}
            locale={locale}
          />
          {/* Lot 41 (GC-03, D12) : points d'attention avant d'envoyer le devis en signature. */}
          {quote.status === "sent" && quote.signature?.status !== "completed" ? (
            <CompliancePanel document="quote" {...(await quoteComplianceFindings({ organizationId, quoteId: quote.id, document: "quote", locale }))} />
          ) : null}
          <SignatureSection organizationId={organizationId} quote={quote} event={event} primary={next?.kind === "sign"} />
        </>
      ) : null}

      {rubric === "factures" ? (
        <InvoicesSection
          quote={quote}
          invoices={invoices}
          locale={locale}
          scheduled={await getQuoteScheduledDeposit(organizationId, quote.id)}
          receipts={receipts}
          // Lot 41 (GC-03, D12) : points d'attention avant l'émission.
          compliance={quote.status === "signed" ? await quoteComplianceFindings({ organizationId, quoteId: quote.id, document: "invoice", locale }) : null}
          next={next}
        />
      ) : null}
    </main>
  );
}

// Rubrique « Lignes et totaux » : les lignes (composées en place sur un brouillon), les totaux, l'encart
// qui résume les autres rubriques ; puis le choix des options, la nouvelle version, le modèle et les
// versions précédentes.
async function LinesRubric({
  organizationId,
  quote,
  rubrics,
  invoices,
  receipts,
  canRevise,
  locale,
}: {
  organizationId: string;
  quote: QuoteDetail;
  rubrics: ReturnType<typeof availableRubrics>;
  invoices: Awaited<ReturnType<typeof listQuoteInvoices>>;
  receipts: Awaited<ReturnType<typeof listQuoteReceipts>>;
  canRevise: boolean;
  locale: Locale;
}) {
  const t = await getTranslations("Quotes");
  const tRubrics = await getTranslations("QuoteRubrics");
  const current = quote.current;
  const isDraft = current.sentAt === null;
  const db = appDatabase();
  const [profile, catalog, templates, states, missingMentions, compliance] = await Promise.all([
    getOrganizationProfile(db, organizationId),
    isDraft ? listCatalogItems(organizationId) : Promise.resolve([]),
    listQuoteTemplates(organizationId),
    loadRubricStates({ organizationId, quote, rubrics: rubrics.filter((item) => item !== "lignes"), invoices, receipts, locale }),
    // Lot 31a (FAC-07, JUR-08 ; D4, D5) : ce qui manque pour envoyer, nommé, avec où le remplir.
    isDraft ? quoteMissingMentions(organizationId, quote.id) : Promise.resolve([]),
    // Lot 41 (GC-03, D12) : points d'attention avant l'envoi du devis.
    isDraft ? quoteComplianceFindings({ organizationId, quoteId: quote.id, document: "quote", locale }) : Promise.resolve(null),
  ]);
  // Brouillon : aperçu de la mention qui sera figée à l'envoi (issue du hub,
  // jamais en dur ici) ; version envoyée : sa copie figée.
  const legalMention = isDraft ? computeLegalMention(profile) || null : current.legalMention;
  const defaultRate = profile.vatRateDefaultBasisPoints ?? 0;
  const olderVersions = quote.versions.filter((version) => version.version !== current.version).reverse();
  const options = current.lines.filter((line) => line.isOption);
  const optionsOpen = quote.status === "sent" && !quote.signature && options.length > 0;

  return (
    <div className="quote-layout">
      <div className="quote-main">
        <section className="card" aria-labelledby="quote-lines-title">
          <h2 id="quote-lines-title">{tRubrics("linesTitle")}</h2>
          {/* Une seule chose ouverte à la fois : la ligne en cours de modification, ou un formulaire d'ajout. */}
          <DisclosureGroup initial={isDraft && current.lines.length === 0 ? (catalog.length > 0 ? "catalogue" : "libre") : null}>
            <QuoteLinesTable version={current} locale={locale} caption={t("linesCaption", { version: current.version })} captionHidden edit={isDraft ? { quoteId: quote.id } : undefined} />
            {current.lines.length === 0 ? <p>{t("noLines")}</p> : null}
            {isDraft ? (
              <>
                <div className="quote-composer" role="group" aria-label={tRubrics("compose")}>
                  <DisclosureButton id="catalogue" className="button-secondary">
                    {t("addFromCatalog")}
                  </DisclosureButton>
                  <DisclosureButton id="libre" className="button-secondary">
                    {t("addFreeLine")}
                  </DisclosureButton>
                  {/* Lot 31a (FAC-01, D2) : sections titrées, chacune avec son sous-total. */}
                  <DisclosureButton id="section" className="button-secondary">
                    {tRubrics("addSection")}
                  </DisclosureButton>
                  <DisclosureButton id="remise" className="button-secondary">
                    {t("globalDiscount")}
                  </DisclosureButton>
                </div>
                <DisclosurePanel id="catalogue" className="quote-edit-panel">
                  {catalog.length === 0 ? (
                    <p>
                      {t("emptyCatalog")} <Link href="/devis/catalogue">{t("catalogLink")}</Link>
                    </p>
                  ) : (
                    <AddCatalogLineForm quoteId={quote.id} items={catalog} sections={current.sections} />
                  )}
                </DisclosurePanel>
                <DisclosurePanel id="libre" className="quote-edit-panel">
                  <AddFreeLineForm quoteId={quote.id} vatApplicable={current.vatApplicable} defaultVatRateBasisPoints={defaultRate} sections={current.sections} />
                </DisclosurePanel>
                <DisclosurePanel id="section" className="quote-edit-panel">
                  <AddSectionForm quoteId={quote.id} />
                </DisclosurePanel>
                <DisclosurePanel id="remise" className="quote-edit-panel">
                  <GlobalDiscountForm quoteId={quote.id} discount={current.globalDiscount} />
                </DisclosurePanel>
              </>
            ) : null}
          </DisclosureGroup>
          {legalMention ? <p className="field-hint">{legalMention}</p> : null}
          {current.template ? <p className="field-hint">{t("fromTemplateVersion", { version: current.template.version })}</p> : null}
        </section>

        {/* Lot 31a (FAC-01, D2) : options choisies par le client (ou par la planner pour lui). */}
        {!isDraft && options.length > 0 ? (
          <section className="card" aria-labelledby="options-choice-title">
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
            {optionsOpen ? <ChooseOptionsForm quoteId={quote.id} options={options} /> : <p className="field-hint">{t("optionsLockedHint")}</p>}
          </section>
        ) : null}

        {canRevise ? (
          <section className="card" aria-labelledby="revise-title">
            <h2 id="revise-title">{t("reviseTitle")}</h2>
            <p>{t("reviseHint")}</p>
            <ReviseQuoteForm quoteId={quote.id} label={t("reviseQuote")} />
          </section>
        ) : null}

        {/* Lot 31a (HUB-21, D3) : le devis devient modèle, ou remplace un modèle (version + 1). */}
        {current.lines.length > 0 ? (
          <section className="card" aria-labelledby="save-template-title">
            <h2 id="save-template-title">{tRubrics("templateTitle")}</h2>
            <p className="field-hint">{t("saveAsTemplateHint")}</p>
            <DisclosureGroup>
              <DisclosureButton id="modele" className="button-secondary">
                {t("saveAsTemplate")}
              </DisclosureButton>
              <DisclosurePanel id="modele" className="quote-edit-panel">
                <SaveAsTemplateForm quoteId={quote.id} templates={templates} />
              </DisclosurePanel>
            </DisclosureGroup>
          </section>
        ) : null}

        {olderVersions.length > 0 ? (
          <section className="card" aria-labelledby="versions-title">
            <h2 id="versions-title">{t("previousVersions")}</h2>
            <ul className="quote-versions">
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
      </div>

      <div className="quote-aside">
        <section className="card" aria-labelledby="quote-totals-title">
          <h2 id="quote-totals-title">{tRubrics("totalsTitle")}</h2>
          <QuoteTotalsList version={current} locale={locale} />
        </section>
        <QuoteSummary quoteId={quote.id} title={tRubrics(isDraft ? "beforeSending" : "follow")} states={states}>
          {isDraft ? (
            <>
              {/* Lot 31a (FAC-07, D4) : avant l'envoi, chaque mention manquante est nommée. */}
              {missingMentions.length > 0 ? (
                <div role="note" aria-labelledby="missing-mentions-title" className="missing-mentions-panel">
                  <p id="missing-mentions-title">{t("mentionsMissingBeforeSend")}</p>
                  <MissingMentionsList fields={missingMentions} />
                </div>
              ) : null}
              {compliance ? <CompliancePanel document="quote" {...compliance} /> : null}
              <p className="field-hint">{t("sendQuoteHint")}</p>
            </>
          ) : null}
        </QuoteSummary>
      </div>
    </div>
  );
}

async function BuyerRubric({ organizationId, quote, event }: { organizationId: string; quote: QuoteDetail; event: Awaited<ReturnType<typeof getEvent>> }) {
  const t = await getTranslations("Quotes");
  // Lot 41 (JUR-02, JUR-13 ; D6, D8) : entreprises parmi les clients de l'évènement (et l'acheteur
  // déjà désigné), pour l'acheteur d'un devis professionnel.
  const clientContacts = await getContactsByIds(organizationId, [
    ...(event?.clients ?? []).map((client) => client.contactId).filter((id): id is string => id !== null),
    ...(quote.buyer.buyerContactId ? [quote.buyer.buyerContactId] : []),
  ]);
  const companies = [...clientContacts.values()].filter((contact) => contact.kind === "company" && !contact.anonymized).map((contact) => ({ id: contact.id, name: contact.displayName }));
  const buyerName = quote.buyer.buyerContactId ? (clientContacts.get(quote.buyer.buyerContactId)?.displayName ?? null) : null;
  return (
    <section id="acheteur" aria-labelledby="buyer-title">
      <h2 id="buyer-title">{t("buyerTitle")}</h2>
      <p className="field-hint">{t("buyerHint")}</p>
      {quote.clientKind === "professional" ? <p>{buyerName ? t("buyerCompanyIs", { name: buyerName }) : t("buyerCompanyMissing")}</p> : null}
      <BuyerDetailsForm quoteId={quote.id} buyer={quote.buyer} companies={companies} professional={quote.clientKind === "professional"} venue={{ name: event?.venueName ?? null, city: event?.venueCity ?? null }} />
    </section>
  );
}
