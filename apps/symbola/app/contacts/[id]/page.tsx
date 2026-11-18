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
import { SidePanel } from "@/app/ui/side-panel";
import { requirePlanner } from "@/lib/guards";
import { listContactMessages, listEventDocuments, listEventsOfContact } from "@/modules/events/service";
import { getContact, getContactStamp, isModuleEnabled, listContactGroups, listContactMembers, listContactNotes } from "@/modules/hub/service";
import { listEventQuotes, listQuoteInvoices } from "@/modules/quotes/service";
import { deleteContactAction, removeContactMemberAction, removeContactNoteAction } from "../actions";
import { ContactForm, MemberForm, NoteForm } from "../contact-forms";
import { ContactAppointments } from "./contact-appointments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 36a (CRM-03 ; décision D7 ; ADR 0069) — fiche d'un contact : son identité et ses coordonnées,
// modifiées une fois pour toute l'organisation ; son historique, tiré de chaque module souscrit
// (évènements dont il est client, devis et factures de ces évènements, leurs documents) ; ses
// notes. Messages et rendez-vous viendront avec leurs modules. Un identifiant inconnu, d'essai ou
// d'une autre organisation répond comme une page absente (SEC-13). Lot 36b (D2) : un foyer ou une
// entreprise montre ses membres ; une personne, les foyers et entreprises dont elle fait partie.
export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ suppression?: string; modifier?: string }> }) {
  const auth = await requirePlanner();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const organizationId = auth.user.organizationId;
  const contact = await getContact(organizationId, id);
  if (!contact || contact.isDemo || contact.anonymized) notFound();
  // Lot 39b (UX-09, D8) : la version de la fiche, pour l'enregistrement automatique sans écrasement.
  const stamp = await getContactStamp(organizationId, id);
  const contactVersion = String((stamp?.updatedAt ?? contact.updatedAt).getTime());

  const t = await getTranslations("Contacts");
  const tEvents = await getTranslations("Events");
  const tQuotes = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const tTrash = await getTranslations("Trash");
  const tCommon = await getTranslations("Common");
  const query = await searchParams;
  const deletionRefused = query.suppression === "refusee";
  // Lot 39c (UX-13, relevé validé le 17/11) : la fiche se lit dans la page, se modifie en panneau.
  const editing = query.modifier === "1";
  const contactHref = `/contacts/${contact.id}`;
  const address = [contact.addressLine, [contact.postalCode, contact.city].filter(Boolean).join(" "), contact.country].filter(Boolean).join(", ");
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();
  const isGroup = contact.kind !== "person";
  const [eventsEnabled, quotesEnabled, notes, team, memberships] = await Promise.all([
    isModuleEnabled(db, organizationId, "events"),
    isModuleEnabled(db, organizationId, "quotes"),
    listContactNotes(organizationId, id),
    listTeam(db, organizationId),
    isGroup ? listContactMembers(organizationId, id) : listContactGroups(organizationId, id),
  ]);
  const events = eventsEnabled ? await listEventsOfContact(organizationId, id) : [];
  // Lot 45 (CRM-03, CRM-05) : les messages échangés avec le contact (envoyés, préparés, notés).
  const messages = eventsEnabled ? await listContactMessages(organizationId, id) : [];
  const tExchanges = await getTranslations("ProspectExchanges");
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
        subtitle={t(contact.kind === "company" ? "detailSubtitleCompany" : contact.kind === "household" ? "detailSubtitleHousehold" : "detailSubtitle")}
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
        <div className="section-head">
          <h2 id="contact-identity">{t("identityTitle")}</h2>
          <Link className="button-link" href={`${contactHref}?modifier=1`} scroll={false}>
            {t("editRecord")}
          </Link>
        </div>
        <dl className="identity-facts">
          {contact.kind === "company" ? (
            <>
              <dt>{t("companyIdNumber")}</dt>
              <dd>{contact.companyIdNumber ?? "—"}</dd>
              <dt>{t("vatNumber")}</dt>
              <dd>{contact.vatNumber ?? "—"}</dd>
            </>
          ) : null}
          <dt>{t("email")}</dt>
          <dd>{contact.email ?? "—"}</dd>
          <dt>{t("phone")}</dt>
          <dd>{contact.phone ?? "—"}</dd>
          <dt>{t("addressLine")}</dt>
          <dd>{address || "—"}</dd>
          <dt>{t("billingAddress")}</dt>
          <dd className="task-comment-body">{contact.billingAddress ?? "—"}</dd>
        </dl>
      </section>
      {editing ? (
        <SidePanel title={t("editRecord")} closeHref={contactHref} closeLabel={tCommon("closePanel")}>
          <ContactForm contact={contact} version={contactVersion} />
        </SidePanel>
      ) : null}

      {isGroup ? (
        <section aria-labelledby="contact-members" className="card">
          <h2 id="contact-members">{t(contact.kind === "company" ? "membersCompany" : "membersHousehold")}</h2>
          {memberships.length === 0 ? (
            <p>{t("noMembers")}</p>
          ) : (
            <ul className="contact-choices">
              {memberships.map((membership) => (
                <li key={membership.id}>
                  <span>
                    {membership.contact.anonymized ? membership.contact.displayName : <Link href={`/contacts/${membership.contact.id}`}>{membership.contact.displayName}</Link>}
                    {membership.role ? <span className="meta"> · {membership.role}</span> : null}
                  </span>
                  <form action={removeContactMemberAction} className="inline-form">
                    <input type="hidden" name="groupContactId" value={contact.id} />
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <button type="submit" className="button-ghost" aria-label={t("memberRemoveFor", { name: membership.contact.displayName })}>
                      {t("memberRemove")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <MemberForm groupContactId={contact.id} kind={contact.kind} />
        </section>
      ) : memberships.length > 0 ? (
        <section aria-labelledby="contact-groups" className="card">
          <h2 id="contact-groups">{t("groupsTitle")}</h2>
          <ul>
            {memberships.map((membership) => (
              <li key={membership.id}>
                {membership.contact.anonymized ? membership.contact.displayName : <Link href={`/contacts/${membership.contact.id}`}>{membership.contact.displayName}</Link>}
                <span className="meta">
                  {" "}
                  · {t(`kind.${membership.contact.kind}`)}
                  {membership.role ? ` · ${membership.role}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        {eventsEnabled ? (
          <>
            <h3>{tExchanges("historyTitle")}</h3>
            {messages.length === 0 ? (
              <p>{tExchanges("noHistory")}</p>
            ) : (
              <ul className="exchange-history">
                {messages.map((message) => (
                  <li key={message.id}>
                    {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium" }).format(new Date(message.occurredAt))} — {tExchanges(`kind.${message.kind}`)}
                    {message.delivery === "prepared" ? ` (${tExchanges("prepared")})` : ""}
                    {message.subject ? ` : ${message.subject}` : ""} · <Link href={`/events/${message.eventId}`}>{eventLabel(message.eventId)}</Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        {/* Lot 46 (CRM-03) : ses rendez-vous, si le module Rendez-vous est ouvert. */}
        <ContactAppointments organizationId={organizationId} contactId={contact.id} locale={locale} />
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
      {/* Lot 39a (HUB-17 ; ADR 0073) : le contact va à la corbeille ; refusé s'il est client d'un évènement. */}
      <section className="card" aria-labelledby="delete-contact-title">
        <h2 id="delete-contact-title">{tTrash("deleteContact")}</h2>
        {deletionRefused ? <p role="alert">{tTrash("contactRefused")}</p> : null}
        <form action={deleteContactAction}>
          <input type="hidden" name="id" value={contact.id} />
          <button type="submit" className="button-ghost">
            {tTrash("deleteContact")}
          </button>
        </form>
      </section>
    </main>
  );
}
