import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { QUOTE_STATUS_LABEL_KEYS } from "@/app/devis/quote-display";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { listEventDocuments, listEventsOfContact } from "@/modules/events/service";
import { getContact, isModuleEnabled, listContactNotes } from "@/modules/hub/service";
import { listEventQuotes, listQuoteInvoices } from "@/modules/quotes/service";
import { removeContactNoteAction } from "../actions";
import { ContactForm, NoteForm } from "../contact-forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 36a (CRM-03 ; décision D7 ; ADR 0069) — fiche d'un contact : son identité et ses coordonnées,
// modifiées une fois pour toute l'organisation ; son historique, tiré de chaque module souscrit
// (évènements dont il est client, devis et factures de ces évènements, leurs documents) ; ses
// notes. Messages et rendez-vous viendront avec leurs modules. Un identifiant inconnu, d'essai ou
// d'une autre organisation répond comme une page absente (SEC-13).
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlanner();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const organizationId = auth.user.organizationId;
  const contact = await getContact(organizationId, id);
  if (!contact || contact.isDemo || contact.anonymized) notFound();

  const t = await getTranslations("Contacts");
  const tEvents = await getTranslations("Events");
  const tQuotes = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();
  const [eventsEnabled, quotesEnabled, notes, team] = await Promise.all([
    isModuleEnabled(db, organizationId, "events"),
    isModuleEnabled(db, organizationId, "quotes"),
    listContactNotes(organizationId, id),
    listTeam(db, organizationId),
  ]);
  const events = eventsEnabled ? await listEventsOfContact(organizationId, id) : [];
  const documents = eventsEnabled ? (await Promise.all(events.map((event) => listEventDocuments(organizationId, event.id)))).flat() : [];
  const quotes = quotesEnabled ? (await Promise.all(events.map((event) => listEventQuotes(organizationId, event.id)))).flat().filter((quote) => !quote.isDemo) : [];
  const invoices = quotesEnabled ? (await Promise.all(quotes.map((quote) => listQuoteInvoices(organizationId, quote.id)))).flat().filter((invoice) => !invoice.isDemo) : [];
  const author = (userId: string | null) => team.find((member) => member.id === userId)?.email ?? t("noteAuthorUnknown");
  const eventLabel = (eventId: string) => {
    const event = events.find((candidate) => candidate.id === eventId);
    return event?.eventDate ? formatCalendarDate(event.eventDate, locale) : tEvents("dateUnset");
  };

  return (
    <main>
      <PageHeader
        title={contact.displayName}
        subtitle={t("detailSubtitle")}
        actions={
          <>
            <Link className="button-link" href="/contacts">
              {t("back")}
            </Link>
            {eventsEnabled ? (
              <Link className="button-link" href={`/events/new?contact=${contact.id}`}>
                {t("newEvent")}
              </Link>
            ) : null}
          </>
        }
      />
      <ScreenHelp title={tHelp("contactDetail.title")} body={tHelp("contactDetail.body")} />

      <section aria-labelledby="contact-identity" className="card">
        <h2 id="contact-identity">{t("identityTitle")}</h2>
        <ContactForm contact={contact} />
      </section>

      <section aria-labelledby="contact-history">
        <h2 id="contact-history">{t("historyTitle")}</h2>
        {eventsEnabled ? (
          <>
            <h3>{t("eventsTitle")}</h3>
            {events.length === 0 ? (
              <p>{t("noEvents")}</p>
            ) : (
              <ul>
                {events.map((event) => (
                  <li key={event.id}>
                    <Link href={`/events/${event.id}`}>{event.eventDate ? formatCalendarDate(event.eventDate, locale) : tEvents("dateUnset")}</Link>{" "}
                    <span className={EVENT_STATUS_CLASSES[event.phase]}>{tEvents(STATUS_LABEL_KEYS[event.phase])}</span>
                    {event.venueName ? ` · ${event.venueName}` : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        {quotesEnabled ? (
          <>
            <h3>{t("quotesTitle")}</h3>
            {quotes.length === 0 ? (
              <p>{t("noQuotes")}</p>
            ) : (
              <ul>
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/devis/${quote.id}`}>{quote.number}</Link> · {tQuotes(QUOTE_STATUS_LABEL_KEYS[quote.status])} · {formatAmount(quote.totalTtcCents, locale)} ·{" "}
                    {eventLabel(quote.eventId)}
                  </li>
                ))}
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    {t("invoiceLine", { number: invoice.number, date: formatCalendarDate(invoice.issuedOn, locale), amount: formatAmount(invoice.amountCents, locale), quote: invoice.quoteNumber })}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        {eventsEnabled ? (
          <>
            <h3>{t("documentsTitle")}</h3>
            {documents.length === 0 ? (
              <p>{t("noDocuments")}</p>
            ) : (
              <ul>
                {documents.map((document) => (
                  <li key={document.id}>
                    <a href={`/events/${document.eventId}/documents/${document.id}`}>{document.label}</a> · {eventLabel(document.eventId)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>

      <section aria-labelledby="contact-notes" className="card">
        <h2 id="contact-notes">{t("notesTitle")}</h2>
        {notes.length === 0 ? (
          <p>{t("noNotes")}</p>
        ) : (
          <ul className="contact-choices">
            {notes.map((note) => (
              <li key={note.id}>
                <span>
                  <span className="task-comment-body">{note.body}</span>
                  <span className="meta"> — {t("noteMeta", { author: author(note.authorUserId), date: formatDateTime(note.createdAt, locale) })}</span>
                </span>
                {note.authorUserId === auth.user.id ? (
                  <form action={removeContactNoteAction} className="inline-form">
                    <input type="hidden" name="contactId" value={contact.id} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="button-ghost">
                      {t("noteRemove")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <NoteForm contactId={contact.id} />
      </section>
    </main>
  );
}
