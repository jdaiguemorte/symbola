// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D3 à D5) — écran du jour J, gardé
// sur l'appareil à la demande et servi sans réseau par le service worker (public/sw.js).
// Lot 30a (JRJ-01, JRJ-03, UX-05 ; décisions D2 à D5) : écran de terrain, sombre et à gros
// caractères : « Maintenant » et « Ensuite » (calculés sur l'appareil), barre du bas dans la
// zone du pouce (appel de la séquence en cours, quatre onglets), programme avec les durées,
// annuaire du jour (urgences, contacts du jour J, prestataires, clients : appel ou SMS en un
// toucher), documents embarqués (lot 29b).
// Accès : titulaire et membres de l'organisation, évènement confirmé (ou réalisé) et daté ;
// sinon la page est introuvable, sans dire si l'évènement existe.
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatFileSize, type Locale } from "@symbola/i18n";
import { starterEmergencyNumbers } from "@symbola/starter-templates";
import {
  eventNames,
  getEvent,
  getEventProgram,
  listEventDayContacts,
  listEventPlaces,
  listEventVendorSlots,
  listVendorCandidates,
} from "@/modules/events/service";
import { getVendorContacts } from "@/modules/vendors/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { EventVocabulary } from "@/app/event-vocabulary";
import { ScreenHelp } from "@/app/screen-help";
import { dayCopyExpiresAt, dayProgramPath, isDayCopyExpired } from "@/lib/offline/day-copy";
import { buildDayOfView, isDayOfOpen, telHref } from "./day-of-view";
import { DayCopyPanel } from "./day-copy-panel";
import { dayDocumentKey, listDayDocumentCandidates } from "./day-documents";
import { DayDocumentsForm } from "./day-documents-form";
import { durationParts } from "./day-timeline";
import { programSpans } from "@/lib/program-spans";
import { FieldDay } from "./field-day";

type Translate = Awaited<ReturnType<typeof getTranslations<"DayOf">>>;

function clock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function duration(t: Translate, minutes: number): string {
  const { hours, minutes: rest } = durationParts(minutes);
  return hours === 0 ? t("durationMinutes", { minutes: rest }) : rest === 0 ? t("durationHours", { hours }) : t("durationHoursMinutes", { hours, minutes: rest });
}

export default async function DayOfPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { eventId } = await params;
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) notFound();
  const eventDate = event.eventDate as string;

  const [program, places, slots, candidates, dayContacts] = await Promise.all([
    getEventProgram(organizationId, eventId),
    listEventPlaces(organizationId, eventId),
    listEventVendorSlots(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
    listEventDayContacts(organizationId, eventId),
  ]);
  const vendorIds = candidates.filter((candidate) => candidate.outcome === "selected" && candidate.vendorId).map((candidate) => candidate.vendorId as string);
  const contacts = (await isVendorsModuleEnabled(organizationId)) ? await getVendorContacts(organizationId, vendorIds) : null;
  const view = buildDayOfView({ event, program, places, slots, candidates, contacts });

  const t = await getTranslations("DayOf");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const title = eventNames(event.clients) || t("noClient");
  const venue = [event.venueName, event.venueCity].filter(Boolean).join(", ");
  const expiresAt = dayCopyExpiresAt(eventDate);
  // Lot 29b (JRJ-04, D8) : le PDF du programme, toujours ; puis les pièces choisies pour l'événement.
  const dayDocuments = await listDayDocumentCandidates(organizationId, eventId);
  const embedded = dayDocuments.filter((candidate) => candidate.embedded);
  const documents = [{ path: dayProgramPath(eventId), label: t("programPdf"), origin: null as string | null }, ...embedded.map((candidate) => ({ path: candidate.path, label: candidate.label, origin: candidate.origin }))];
  const embeddedBytes = embedded.reduce((sum, candidate) => sum + (candidate.sizeBytes ?? 0), 0);
  // Lot 30a (CHR-06 en partie, D2) : durée et fin de chaque séquence (fin absente : la suivante).
  const spans = new Map(programSpans(view.items).map((span) => [span.id, span]));
  const participantsOf = (item: (typeof view.items)[number]) =>
    item.participants.map((participant) => (participant.vendors.length > 0 ? `${participant.label} (${participant.vendors.join(", ")})` : participant.label)).join(" · ");
  const emergencies = starterEmergencyNumbers(locale);

  return (
    <EventVocabulary>
      <main className="day-of field-screen">
        {/* Lot 30a : retour et aide sur une ligne, pour garder « Maintenant » et « Ensuite » en vue. */}
        <div className="field-top">
          <p className="day-of-back">
            <a href={`/events/${eventId}`}>{t("backToEvent")}</a>
          </p>
          <ScreenHelp title={tHelp("dayOf.title")} body={tHelp("dayOf.body")} />
        </div>
        <h1>{title}</h1>
        <p className="meta">
          {formatCalendarDate(eventDate, locale)}
          {venue ? ` · ${venue}` : ""}
        </p>

        <FieldDay
          eventDate={eventDate}
          items={view.items.map((item) => ({
            id: item.id,
            startTime: item.startTime,
            endTime: item.endTime,
            label: item.label,
            location: item.location,
            note: item.note,
            responsible: item.responsible,
            participants: participantsOf(item),
            calls: item.calls.flatMap((call) => {
              const tel = telHref(call.phone);
              return tel ? [{ name: call.name, phone: call.phone, tel }] : [];
            }),
          }))}
        />

        <section id="programme" className="card" aria-labelledby="day-program-title">
          <h2 id="day-program-title">{t("programTitle")}</h2>
          {view.items.length === 0 ? (
            <p>{t("programEmpty")}</p>
          ) : (
            <ol className="day-program">
              {view.items.map((item) => {
                const span = spans.get(item.id)!;
                return (
                  <li key={item.id}>
                    {/* Lot 30b : la dernière séquence sans fin, son seul début. */}
                    <p className="day-program-time">
                      {span.openEnded ? item.startTime : t("timeRange", { start: item.startTime, end: clock(span.end) })}
                      {span.openEnded ? null : <span className="meta">{duration(t, span.end - span.start)}</span>}
                    </p>
                    <div>
                      <p className="day-program-label">{item.label}</p>
                      {item.location ? <p>{item.location}</p> : null}
                      {item.responsible ? <p>{t("responsible", { name: item.responsible })}</p> : null}
                      {item.participants.length > 0 ? (
                        <p>
                          {t("participants")} {participantsOf(item)}
                        </p>
                      ) : null}
                      {item.note ? (
                        <p className="day-program-note">
                          {t("note")} {item.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section id="lieux" className="card" aria-labelledby="day-places-title">
          <h2 id="day-places-title">{t("placesTitle")}</h2>
          {view.places.length === 0 ? (
            <p>{t("placesEmpty")}</p>
          ) : (
            <ul className="day-list">
              {view.places.map((place) => (
                <li key={place.id}>
                  <p className="day-list-name">{place.label}</p>
                  {place.address ? <p>{place.address}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="contacts" className="card" aria-labelledby="day-contacts-title">
          <h2 id="day-contacts-title">{t("contactsTitle")}</h2>
          <h3>{t("emergencyTitle")}</h3>
          <ul className="day-list day-emergencies">
            {emergencies.map((emergency) => (
              <li key={emergency.key}>
                <p className="day-list-name">
                  {emergency.label} <span className="field-number">{emergency.number}</span>
                </p>
                <div className="day-contact-actions">
                  {emergency.sms ? (
                    <a href={`sms:${emergency.number}`} aria-label={t("smsLabel", { name: emergency.label, phone: emergency.number })}>
                      {t("sms")}
                    </a>
                  ) : (
                    <a href={`tel:${emergency.number}`} aria-label={t("callLabel", { name: emergency.label, phone: emergency.number })}>
                      {t("call")}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <h3>{t("dayContactsTitle")}</h3>
          {dayContacts.length === 0 ? (
            <p>{t("dayContactsEmpty")}</p>
          ) : (
            <ul className="day-list">
              {dayContacts.map((contact) => (
                <li key={contact.id}>
                  <p className="day-list-name">{contact.name}</p>
                  <p className="meta">{[contact.role, contact.phone].filter(Boolean).join(" · ")}</p>
                  <ContactActions t={t} name={contact.name} phone={contact.phone} email={null} />
                </li>
              ))}
            </ul>
          )}
          <h3>{t("vendorsTitle")}</h3>
          {view.vendors.length === 0 ? (
            <p>{t("vendorsEmpty")}</p>
          ) : (
            <ul className="day-list">
              {view.vendors.map((vendor) => (
                <li key={vendor.id}>
                  <p className="day-list-name">{vendor.name}</p>
                  <p className="meta">{[vendor.slot, vendor.detail, vendor.phone].filter(Boolean).join(" · ")}</p>
                  <ContactActions t={t} name={vendor.name} phone={vendor.phone} email={vendor.email} />
                </li>
              ))}
            </ul>
          )}
          <h3>{t("clientsTitle")}</h3>
          {view.clients.length === 0 ? (
            <p>{t("clientsEmpty")}</p>
          ) : (
            <ul className="day-list">
              {view.clients.map((client) => (
                <li key={client.name}>
                  <p className="day-list-name">{client.name}</p>
                  {client.phone ? <p className="meta">{client.phone}</p> : null}
                  <ContactActions t={t} name={client.name} phone={client.phone} email={client.email} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="documents" className="card" aria-labelledby="day-documents-title">
          <h2 id="day-documents-title">{t("documentsTitle")}</h2>
          <ul className="day-list">
            {documents.map((document) => (
              <li key={document.path}>
                <a href={document.path}>{document.label}</a>
                {document.origin ? <p className="meta">{document.origin}</p> : null}
              </li>
            ))}
          </ul>
          <p className="meta">{t("documentsHint")}</p>
          {dayDocuments.length > 0 ? (
            <details className="day-documents-choice">
              <summary>{t("chooseTitle")}</summary>
              <p>{t("chooseHint")}</p>
              <DayDocumentsForm
                eventId={eventId}
                total={formatFileSize(embeddedBytes, locale)}
                choices={dayDocuments.map((candidate) => ({
                  key: dayDocumentKey(candidate.source, candidate.sourceId),
                  label: candidate.label,
                  origin: candidate.origin,
                  size: candidate.sizeBytes !== null ? formatFileSize(candidate.sizeBytes, locale) : null,
                  embedded: candidate.embedded,
                }))}
              />
            </details>
          ) : (
            <>
              <p>{t("chooseEmpty")}</p>
              <p>
                <a href={`/events/${eventId}?onglet=documents`}>{t("chooseEmptyLink")}</a>
              </p>
            </>
          )}
        </section>

        <DayCopyPanel
          eventId={eventId}
          userId={auth.user.id}
          title={title}
          eventDate={eventDate}
          expiresAt={expiresAt.toISOString()}
          canKeep={!isDayCopyExpired(expiresAt)}
          documents={documents.map((document) => ({ path: document.path, label: document.label }))}
          requiredBytes={embeddedBytes}
        />
        <div className="field-bar-spacer" aria-hidden="true" />
      </main>
    </EventVocabulary>
  );
}

// JRJ-03 : appel, SMS (et e-mail s'il y en a un) en un toucher ; libellé visible court,
// nom complet pour les lecteurs d'écran.
function ContactActions({ t, name, phone, email }: { t: Translate; name: string; phone: string | null; email: string | null }) {
  const tel = telHref(phone);
  if (!tel && !email) return null;
  return (
    <div className="day-contact-actions">
      {tel && phone ? (
        <>
          <a href={tel} aria-label={t("callLabel", { name, phone })}>
            {t("call")}
          </a>
          <a href={tel.replace(/^tel:/, "sms:")} aria-label={t("smsLabel", { name, phone })}>
            {t("sms")}
          </a>
        </>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} aria-label={t("mailLabel", { name, email })}>
          {t("mail")}
        </a>
      ) : null}
    </div>
  );
}
