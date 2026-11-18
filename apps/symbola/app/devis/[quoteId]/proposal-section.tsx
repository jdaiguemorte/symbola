// Lot 43 (FAC-02, FAC-15, FAC-08, FAC-09 ; D1, D2, D5, D7 ; ADR 0087) — sur la fiche du devis : la page
// de proposition (mot d'accueil, aperçu « vu par le client », annonce par e-mail, validité et
// prolongation), puis le règlement de chaque échéance (référence du virement, déclaration du payeur à
// confirmer par l'encaissement existant, relances envoyées, suspension avec motif).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatDateTime, parisToday, type Locale } from "@symbola/i18n";
import { getQuoteProposalGreeting, getQuoteSettlements, type QuoteDetail } from "@/modules/quotes/service";
import { ExtendValidityForm, GreetingForm, NotifyProposalForm, ResumeRemindersForm, SuspendRemindersForm } from "./proposal-forms";

export async function ProposalSection({ organizationId, quote, locale }: { organizationId: string; quote: QuoteDetail; locale: Locale }) {
  const t = await getTranslations("QuoteProposal");
  const current = quote.current;
  const today = parisToday();
  const { greeting, templateGreeting } = await getQuoteProposalGreeting(organizationId, quote.id);
  const expired = quote.status === "sent" && current.validUntil !== null && today > current.validUntil;
  return (
    <section id="proposition" aria-labelledby="proposal-title">
      <h2 id="proposal-title">{t("title")}</h2>
      {current.sentAt ? (
        <>
          {greeting ? (
            <blockquote className="proposal-greeting-preview">
              {greeting.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </blockquote>
          ) : null}
          <p>
            <Link href={`/devis/${quote.id}/proposition`}>{t("previewLink")}</Link>
          </p>
          {expired ? <p className="badge-warning">{t("expired", { date: formatCalendarDate(current.validUntil!, locale) })}</p> : null}
          {quote.status === "sent" ? (
            <>
              <NotifyProposalForm quoteId={quote.id} />
              <details>
                <summary>{t("extendSummary")}</summary>
                <ExtendValidityForm quoteId={quote.id} current={current.validUntil} today={today} />
              </details>
            </>
          ) : null}
        </>
      ) : (
        <>
          <p className="meta">{t("draftHint")}</p>
          <GreetingForm quoteId={quote.id} greeting={greeting} templateGreeting={templateGreeting} />
          <p className="meta">
            <Link href="/devis/modeles-proposition">{t("templatesLink")}</Link>
          </p>
        </>
      )}
    </section>
  );
}

export async function SettlementSection({ organizationId, quote, locale }: { organizationId: string; quote: QuoteDetail; locale: Locale }) {
  if (!quote.current.sentAt || quote.current.schedule.items.length === 0) return null;
  const t = await getTranslations("QuoteProposal");
  const settlements = await getQuoteSettlements(organizationId, quote.id);
  return (
    <section id="reglement" aria-labelledby="settlement-title">
      <h2 id="settlement-title">{t("settlementTitle")}</h2>
      <p className="meta">{t("settlementHint")}</p>
      <ul className="item-list">
        {quote.current.schedule.items.map((item) => {
          const settlement = settlements.find((entry) => entry.scheduleItemId === item.id);
          return (
            <li key={item.id} id={`reglement-${item.id}`}>
              <p>
                <strong>{item.label}</strong>
                {settlement?.reference ? ` — ${t("reference", { reference: settlement.reference })}` : ` — ${t("noReference")}`}
              </p>
              {settlement?.declaration && !item.paidOn ? (
                <p className="badge-warning">
                  {t("declared", { name: settlement.declaration.byName, date: formatCalendarDate(settlement.declaration.paidOn, locale) })}{" "}
                  <a href="#echeancier">{t("confirmLink")}</a>
                </p>
              ) : null}
              {settlement && settlement.remindersSent.length > 0 ? (
                <p className="meta">{t("remindersSent", { list: settlement.remindersSent.map((reminder) => t("reminderEntry", { rank: reminder.rank, date: formatDateTime(new Date(reminder.sentAt), locale) })).join(", ") })}</p>
              ) : null}
              {!item.paidOn && quote.status === "signed" ? (
                settlement?.remindersSuspended ? (
                  <>
                    <p className="meta">{t("suspendedSince", { date: formatDateTime(new Date(settlement.remindersSuspended.at), locale), reason: settlement.remindersSuspended.reason })}</p>
                    <ResumeRemindersForm quoteId={quote.id} scheduleItemId={item.id} label={item.label} />
                  </>
                ) : (
                  <details>
                    <summary>{t("suspendSummary", { label: item.label })}</summary>
                    <SuspendRemindersForm quoteId={quote.id} scheduleItemId={item.id} label={item.label} />
                  </details>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
