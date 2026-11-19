// Lot 43 (FAC-02, FAC-15, GC-01 ; D2, D3 ; ADR 0089) — la page de proposition d'une version envoyée,
// en une colonne : les blocs dans l'ordre du modèle (mot d'accueil, organisation, photos, devis et
// options, échéancier et conditions, validité), puis l'enchaînement « Accepter et signer ». Le même
// rendu sert l'aperçu « vu par le client » de la planner (preview) : rien ne s'enregistre.
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import type { ProposalView, SigningFlowView } from "@symbola/contracts";
import { ClientQuoteOptionsForm } from "../client-quote-options";
import { SigningFlow } from "./signing-flow";

function quantity(milli: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 3 }).format(milli / 1000);
}

export async function ProposalContent({ proposal, flow, locale, preview = false, basePath, banner }: { proposal: ProposalView; flow: SigningFlowView | null; locale: Locale; preview?: boolean; basePath: string; banner?: ReactNode }) {
  const t = await getTranslations("Proposal");
  const tClient = await getTranslations("ClientSpace");
  const amount = (cents: number) => formatAmount(cents, locale);
  const blocks: Record<string, ReactNode> = {
    greeting: proposal.greeting ? (
      <section key="greeting" aria-label={t("greetingLabel")} className="proposal-greeting">
        {proposal.greeting.split(/\n\s*\n/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </section>
    ) : null,
    organization: (
      <section key="organization" aria-labelledby="proposal-organization" className="proposal-organization card">
        {proposal.organization.hasLogo && !preview ? <img src="/portail/logo" alt="" className="proposal-logo" /> : null}
        <h2 id="proposal-organization">{proposal.organization.name}</h2>
        <ul className="meta">
          {proposal.organization.email ? <li>{proposal.organization.email}</li> : null}
          {proposal.organization.phone ? <li>{proposal.organization.phone}</li> : null}
          {proposal.organization.website ? <li>{proposal.organization.website}</li> : null}
        </ul>
      </section>
    ),
    photos:
      proposal.photoCount > 0 ? (
        <section key="photos" aria-label={t("photosLabel")} className="proposal-photos">
          {Array.from({ length: proposal.photoCount }, (_, index) => (
            <img key={index} src={`${basePath}/photo/${index + 1}`} alt={t("photoAlt", { number: index + 1 })} loading="lazy" />
          ))}
        </section>
      ) : null,
    quote: (
      <section key="quote" aria-labelledby="proposal-quote" className="proposal-quote">
        <h2 id="proposal-quote">{t("quoteTitle", { number: proposal.number, version: proposal.version })}</h2>
        {proposal.sections.map((section, index) => (
          <section key={index} aria-label={section.title ?? t("linesLabel")} className="proposal-section">
            {section.title ? <h3>{section.title}</h3> : null}
            <ul className="proposal-lines">
              {section.lines.map((line) => (
                <li key={line.id} className={line.isOption && !line.chosen ? "proposal-line proposal-line-option" : "proposal-line"}>
                  <span className="proposal-line-label">
                    <strong>{line.label}</strong>
                    {line.description ? <span className="meta"> — {line.description}</span> : null}
                    <span className="meta"> · {quantity(line.quantityMilli, locale)} {line.unit}</span>
                    {line.isOption ? <span className="meta"> · {line.chosen ? t("optionChosen") : t("optionNotChosen")}</span> : null}
                  </span>
                  <span className="proposal-line-amount">{amount(line.amountCents)}</span>
                </li>
              ))}
            </ul>
            {section.title ? <p className="proposal-subtotal">{t("subtotal", { title: section.title, amount: amount(section.subtotalCents) })}</p> : null}
          </section>
        ))}
        {proposal.options && proposal.status === "open" ? (
          <div id="options" className="proposal-options">
            <ClientQuoteOptionsForm quote={proposal.options} preview={preview} />
          </div>
        ) : null}
        <dl className="proposal-totals">
          {proposal.vatApplicable ? (
            <>
              <dt>{t("totalHt")}</dt>
              <dd>{amount(proposal.totals.totalHtCents)}</dd>
              <dt>{t("totalVat")}</dt>
              <dd>{amount(proposal.totals.totalVatCents)}</dd>
            </>
          ) : null}
          <dt>{proposal.vatApplicable ? t("totalTtc") : t("total")}</dt>
          <dd>
            <strong>{amount(proposal.totals.totalTtcCents)}</strong>
          </dd>
        </dl>
        {proposal.legalMention ? <p className="meta">{proposal.legalMention}</p> : null}
      </section>
    ),
    schedule:
      proposal.schedule.length > 0 ? (
        <section key="schedule" aria-labelledby="proposal-schedule" className="proposal-schedule">
          <h2 id="proposal-schedule">{proposal.advanceKind === "earnest" ? t("scheduleEarnest") : t("scheduleDeposit")}</h2>
          <ul>
            {proposal.schedule.map((item) => (
              <li key={item.id}>
                {t("scheduleLine", { label: item.label, amount: amount(item.amountCents), date: formatCalendarDate(item.dueDate, locale) })}
              </li>
            ))}
            {proposal.balanceCents > 0 ? <li>{t("balance", { amount: amount(proposal.balanceCents) })}</li> : null}
          </ul>
          {proposal.advanceKind ? <p className="meta">{tClient(proposal.advanceKind === "earnest" ? "advanceEarnest" : "advanceDeposit")}</p> : null}
        </section>
      ) : null,
    validity: (
      <section key="validity" aria-label={t("validityLabel")} className="proposal-validity">
        {proposal.status === "expired" ? (
          <p role="status" className="badge-warning">
            {t("expired", { organization: proposal.organization.name })}
          </p>
        ) : proposal.validUntil && proposal.status === "open" ? (
          <p>{t("validUntil", { date: formatCalendarDate(proposal.validUntil, locale) })}</p>
        ) : null}
        {proposal.status === "signed" ? <p role="status">{t("signed")}</p> : null}
        {proposal.status === "superseded" ? <p role="status">{t("superseded")}</p> : null}
        {proposal.status === "declined" ? <p role="status">{t("declined")}</p> : null}
      </section>
    ),
  };
  return (
    <main className="portal proposal">
      {banner}
      <p className="muted">{t("sentOn", { date: formatDateTime(new Date(proposal.sentAt), locale) })}</p>
      <h1>{t("title", { organization: proposal.organization.name })}</h1>
      {proposal.blocks.map((block) => blocks[block] ?? null)}
      <p>{preview ? <span>{t("downloadPdf")}</span> : <a href={`${basePath}/pdf`} download>{t("downloadPdf")}</a>}</p>
      {flow ? <SigningFlow flow={flow} proposal={proposal} preview={preview} /> : null}
      {proposal.versions.length > 1 ? (
        <section aria-labelledby="proposal-versions">
          <h2 id="proposal-versions">{t("versionsTitle")}</h2>
          <ul>
            {proposal.versions.map((version) => (
              <li key={version.versionId}>
                {version.versionId === proposal.versionId ? (
                  <strong>{t("versionLine", { version: version.version, date: formatCalendarDate(version.sentAt.slice(0, 10), locale) })}</strong>
                ) : preview ? (
                  <span>{t("versionLine", { version: version.version, date: formatCalendarDate(version.sentAt.slice(0, 10), locale) })}</span>
                ) : (
                  <a href={`/portail/proposition/${version.versionId}`}>{t("versionLine", { version: version.version, date: formatCalendarDate(version.sentAt.slice(0, 10), locale) })}</a>
                )}
                {version.current ? ` — ${t("versionCurrent")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p>{preview ? <span>{t("backToSpace")}</span> : <a href="/portail">{t("backToSpace")}</a>}</p>
    </main>
  );
}
