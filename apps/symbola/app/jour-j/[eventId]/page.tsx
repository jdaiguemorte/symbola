// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D3 à D5) — écran du jour J, en
// lecture : programme du jour, lieux, contacts, PDF du programme. Gardé sur l'appareil à
// la demande (panneau « Sur cet appareil »), il s'ouvre ensuite sans réseau, servi par le
// service worker (public/sw.js). Le lot 30 y ajoutera « Maintenant » et « Ensuite ».
// Accès : titulaire et membres de l'organisation, évènement confirmé (ou réalisé) et daté ;
// sinon la page est introuvable, sans dire si l'évènement existe.
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { eventNames, getEvent, getEventProgram, listEventPlaces, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { getVendorContacts } from "@/modules/vendors/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { EventVocabulary } from "@/app/event-vocabulary";
import { ScreenHelp } from "@/app/screen-help";
import { dayCopyExpiresAt, dayProgramPath, isDayCopyExpired } from "@/lib/offline/day-copy";
import { buildDayOfView, isDayOfOpen, telHref, type DayOfPerson } from "./day-of-view";
import { DayCopyPanel } from "./day-copy-panel";

export default async function DayOfPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { eventId } = await params;
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) notFound();
  const eventDate = event.eventDate as string;

  const [program, places, slots, candidates] = await Promise.all([
    getEventProgram(organizationId, eventId),
    listEventPlaces(organizationId, eventId),
    listEventVendorSlots(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
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
  const documents = [{ path: dayProgramPath(eventId), label: t("programPdf") }];

  return (
    <EventVocabulary>
      <main className="day-of">
        <ScreenHelp title={tHelp("dayOf.title")} body={tHelp("dayOf.body")} />
        <p className="day-of-back">
          <a href={`/events/${eventId}`}>{t("backToEvent")}</a>
        </p>
        <h1>{title}</h1>
        <p className="meta">
          {formatCalendarDate(eventDate, locale)}
          {venue ? ` · ${venue}` : ""}
        </p>

        <DayCopyPanel
          eventId={eventId}
          userId={auth.user.id}
          title={title}
          eventDate={eventDate}
          expiresAt={expiresAt.toISOString()}
          canKeep={!isDayCopyExpired(expiresAt)}
          documents={documents}
        />

        <nav aria-label={t("sections")} className="day-of-nav">
          <a href="#programme">{t("navProgram")}</a>
          <a href="#lieux">{t("navPlaces")}</a>
          <a href="#contacts">{t("navContacts")}</a>
          <a href="#documents">{t("navDocuments")}</a>
        </nav>

        <section id="programme" className="card" aria-labelledby="day-program-title">
          <h2 id="day-program-title">{t("programTitle")}</h2>
          {view.items.length === 0 ? (
            <p>{t("programEmpty")}</p>
          ) : (
            <ol className="day-program">
              {view.items.map((item) => (
                <li key={item.id}>
                  <p className="day-program-time">{item.endTime ? t("timeRange", { start: item.startTime, end: item.endTime }) : item.startTime}</p>
                  <div>
                    <p className="day-program-label">{item.label}</p>
                    {item.location ? <p>{item.location}</p> : null}
                    {item.participants.length > 0 ? (
                      <p>
                        {t("participants")}{" "}
                        {item.participants
                          .map((participant) => (participant.vendors.length > 0 ? `${participant.label} (${participant.vendors.join(", ")})` : participant.label))
                          .join(" · ")}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="day-program-note">
                        {t("note")} {item.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
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
          <h3>{t("vendorsTitle")}</h3>
          {view.vendors.length === 0 ? (
            <p>{t("vendorsEmpty")}</p>
          ) : (
            <ul className="day-list">
              {view.vendors.map((vendor) => (
                <li key={vendor.id}>
                  <p className="day-list-name">{vendor.name}</p>
                  <p className="meta">{vendor.slot}</p>
                  <PersonContact person={vendor} callLabel={(phone) => t("callLabel", { name: vendor.name, phone })} mailLabel={(email) => t("mailLabel", { name: vendor.name, email })} />
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
                  <PersonContact person={client} callLabel={(phone) => t("callLabel", { name: client.name, phone })} mailLabel={(email) => t("mailLabel", { name: client.name, email })} />
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
              </li>
            ))}
          </ul>
          <p className="meta">{t("documentsHint")}</p>
        </section>
      </main>
    </EventVocabulary>
  );
}

function PersonContact({ person, callLabel, mailLabel }: { person: DayOfPerson; callLabel: (phone: string) => string; mailLabel: (email: string) => string }) {
  const tel = telHref(person.phone);
  if (!person.detail && !tel && !person.email) return null;
  return (
    <p className="day-contact">
      {person.detail ? <span>{person.detail}</span> : null}
      {tel && person.phone ? (
        <a href={tel} aria-label={callLabel(person.phone)}>
          {person.phone}
        </a>
      ) : null}
      {person.email ? (
        <a href={`mailto:${person.email}`} aria-label={mailLabel(person.email)}>
          {person.email}
        </a>
      ) : null}
    </p>
  );
}
