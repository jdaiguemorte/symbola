// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D3 à D5) — écran du jour J, gardé
// sur l'appareil à la demande et servi sans réseau par le service worker (public/sw.js).
// Lot 30a (JRJ-01, JRJ-03, UX-05 ; décisions D2 à D5) : écran de terrain, sombre et à gros
// caractères : « Maintenant » et « Ensuite » (calculés sur l'appareil), barre du bas dans la
// zone du pouce (appel de la séquence en cours, quatre onglets), programme avec les durées,
// annuaire du jour (urgences, contacts du jour J, prestataires, clients : appel ou SMS en un
// toucher), documents embarqués (lot 29b).
// Accès : titulaire et membres de l'organisation, évènement confirmé (ou réalisé) et daté ;
// sinon la page est introuvable, sans dire si l'évènement existe.
// Lot 51 (EVT-04, JRJ-05 à JRJ-09, ARC-09 ; ADR 0091) : jours et temps forts, pointage, décalage,
// main courante, listes de contrôle et remises du jour (field-day.tsx) ; préparation des listes.
import { notFound, redirect } from "next/navigation";
import { venueChecksFor } from "@/lib/events/venue-checks";
import { bankToVerifyVendors } from "@/lib/vendors/bank-checks";
import { VenueFindings } from "@/app/events/[id]/venue-findings";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatFileSize, type Locale } from "@symbola/i18n";
import { starterEmergencyNumbers } from "@symbola/starter-templates";
import {
  dayOfSettings,
  eventNames,
  getDayState,
  getEvent,
  getEventProgram,
  listDayChecklistTemplates,
  listEventDayContacts,
  listEventPlaces,
  listEventVendorSlots,
  listKeyMoments,
  listNotifiableVendorSlots,
  listVendorCandidates,
} from "@/modules/events/service";
import { listDayHandovers } from "@/modules/budget/service";
import { getGuestEventSummary } from "@/modules/guests/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { eventDays } from "@/lib/day-of/rules";
import { DayChecklistsPrep } from "./day-checklists-prep";
import { getVendorContacts } from "@/modules/vendors/service";
import { resolveDayOfViewer } from "@/lib/day-of/viewer";
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
import { FieldDay } from "./field-day";

type Translate = Awaited<ReturnType<typeof getTranslations<"DayOf">>>;

// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) : aussi le renfort du jour J, par la session de son lien, pour
// son seul évènement et ses dates : « Maintenant », annuaire, documents gardés, pointage, main courante,
// listes ; ni remises d'argent, ni réglages (listes, documents), ni décalage du programme. Tout autre
// cas répond comme une page inexistante (SEC-13) ; sans session ni lien, la connexion.
export default async function DayOfPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!isValidId(eventId)) notFound();
  const resolved = await resolveDayOfViewer(eventId);
  if ("refused" in resolved) {
    if (resolved.refused === "signed_out") redirect("/login");
    if (resolved.refused === "mfa") redirect("/securite");
    if (resolved.refused === "not_planner") await requirePlanner();
    notFound();
  }
  const viewer = resolved.viewer;
  const helper = viewer.kind === "helper";
  const organizationId = viewer.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) notFound();
  const eventDate = event.eventDate as string;

  const locale = (await getLocale()) as Locale;
  const budgetEnabled = !helper && (await isBudgetModuleEnabled(organizationId));
  const [program, places, slots, candidates, dayContacts, moments, dayState, handovers, notifiable, templates] = await Promise.all([
    getEventProgram(organizationId, eventId),
    listEventPlaces(organizationId, eventId),
    listEventVendorSlots(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
    listEventDayContacts(organizationId, eventId),
    listKeyMoments(organizationId, eventId),
    getDayState(organizationId, eventId, { forHelper: helper }),
    budgetEnabled ? listDayHandovers(organizationId, eventId) : Promise.resolve(null),
    listNotifiableVendorSlots(organizationId, eventId),
    listDayChecklistTemplates(organizationId, locale),
  ]);
  if (!dayState) notFound();
  // Lot 48a (PRE-06, PRE-10) : contrôles du lieu, IBAN « à vérifier » des prestataires des remises.
  // Lot 52 (D3) : les contrôles du lieu sont ceux de la planner ; le renfort ne les voit pas.
  const venueFindings = helper ? [] : (await venueChecksFor(organizationId, eventId, program, event.guestsConfirmed ?? event.guestsEstimated)).findings;
  const bankVendors = await bankToVerifyVendors(organizationId, [...new Set((handovers ?? []).flatMap((handover) => handover.vendorIds ?? []))]);
  // EVT-04 : le nombre de présents du temps fort en cours, sans noms (règle du lot 49).
  const presentByMoment: Record<string, number> = {};
  if (await isGuestsAvailable(organizationId)) {
    try {
      const summary = await getGuestEventSummary(organizationId, eventId);
      for (const tally of summary.tallies) presentByMoment[tally.keyMomentId] = tally.yes;
      const auto = moments.find((entry) => entry.autoCreated);
      if (auto && moments.length === 1) presentByMoment[auto.id] = summary.confirmed;
    } catch {
      // Module Invités pas prêt (analyse d'impact) : pas de nombre.
    }
  }
  const vendorIds = candidates.filter((candidate) => candidate.outcome === "selected" && candidate.vendorId).map((candidate) => candidate.vendorId as string);
  const contacts = (await isVendorsModuleEnabled(organizationId)) ? await getVendorContacts(organizationId, vendorIds) : null;
  const view = buildDayOfView({ event, program, places, slots, candidates, contacts });

  const t = await getTranslations("DayOf");
  const tHelp = await getTranslations("Help");
  const title = eventNames(event.clients, event.name) || t("noClient");
  const venue = [event.venueName, event.venueCity].filter(Boolean).join(", ");
  const expiresAt = dayCopyExpiresAt(eventDate);
  // Lot 29b (JRJ-04, D8) : le PDF du programme, toujours ; puis les pièces choisies pour l'événement.
  const dayDocuments = await listDayDocumentCandidates(organizationId, eventId);
  const embedded = dayDocuments.filter((candidate) => candidate.embedded);
  // Lot 52 (D3) : le renfort ne voit que les documents gardés, sans le choix des pièces.
  const documents = [{ path: dayProgramPath(eventId), label: t("programPdf"), origin: null as string | null }, ...embedded.map((candidate) => ({ path: candidate.path, label: candidate.label, origin: candidate.origin }))];
  const embeddedBytes = embedded.reduce((sum, candidate) => sum + (candidate.sizeBytes ?? 0), 0);
  const settings = dayOfSettings(locale);
  const programById = new Map(program.items.map((item) => [item.id, item]));
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const days = eventDays(moments, eventDate).map((date) => ({ date, label: dayFormat.format(new Date(`${date}T12:00:00Z`)) }));
  const retainedBySlot = new Map<string, string[]>();
  for (const candidate of candidates.filter((entry) => entry.outcome === "selected")) retainedBySlot.set(candidate.vendorSlotId, [...(retainedBySlot.get(candidate.vendorSlotId) ?? []), candidate.vendorName]);
  const participantsOf = (item: (typeof view.items)[number]) =>
    item.participants.map((participant) => (participant.vendors.length > 0 ? `${participant.label} (${participant.vendors.join(", ")})` : participant.label)).join(" · ");
  const emergencies = starterEmergencyNumbers(locale);

  return (
    <EventVocabulary>
      <main className="day-of field-screen">
        {/* Lot 30a : retour et aide sur une ligne, pour garder « Maintenant » et « Ensuite » en vue. */}
        <div className="field-top">
          {helper ? (
            <p className="day-of-back">{t("helperWelcome", { name: viewer.personName })}</p>
          ) : (
            <p className="day-of-back">
              <a href={`/events/${eventId}`}>{t("backToEvent")}</a>
            </p>
          )}
          <ScreenHelp title={tHelp("dayOf.title")} body={tHelp("dayOf.body")} />
        </div>
        <h1>{title}</h1>
        <p className="meta">
          {formatCalendarDate(eventDate, locale)}
          {venue ? ` · ${venue}` : ""}
        </p>

        <FieldDay
          eventId={eventId}
          userId={viewer.actorId}
          helper={helper}
          eventDate={eventDate}
          timeZone={event.timeZone}
          moments={moments.map((entry) => ({ id: entry.id, name: entry.name, date: entry.date }))}
          days={days}
          vendors={slots.map((slot) => ({ slotId: slot.id, names: retainedBySlot.get(slot.id) ?? [], notifiable: notifiable.includes(slot.id) }))}
          presentByMoment={presentByMoment}
          settings={{ shiftThresholdMinutes: settings.shiftThresholdMinutes, photoMaxSide: settings.photoMaxSide, refreshSeconds: settings.refreshSeconds }}
          showHandovers={budgetEnabled}
          bankToVerify={(handovers ?? []).filter((handover) => (handover.vendorIds ?? []).some((vendorId) => bankVendors.has(vendorId))).map((handover) => handover.paymentId)}
          initial={{ state: dayState, items: program.items.map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, keyMomentId: item.keyMomentId })), handovers }}
          items={view.items.map((item) => ({
            keyMomentId: programById.get(item.id)?.keyMomentId ?? null,
            vendorSlotIds: (programById.get(item.id)?.participants ?? []).flatMap((participant) => (participant.vendorSlotId ? [participant.vendorSlotId] : [])),
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

        {helper ? null : (
        <DayChecklistsPrep
          eventId={eventId}
          moments={moments.map((entry) => ({ id: entry.id, name: entry.name }))}
          templates={templates.map((template) => ({ id: template.id, name: template.name, phase: template.phase }))}
          lists={dayState.checklists.map((list) => ({ id: list.id, name: list.name, items: list.items.map((item) => ({ id: item.id, label: item.label, checked: item.checkedAt !== null })) }))}
        />
        )}

        {/* Lot 48a (PRE-06, D4) : contraintes du lieu, signalées, jamais bloquantes. */}
        {venueFindings.length > 0 ? (
          <div className="card">
            <VenueFindings findings={venueFindings} labels={new Map(program.items.map((item) => [item.id, item.label]))} headingId="day-venue-title" />
          </div>
        ) : null}

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
          {helper ? null : dayDocuments.length > 0 ? (
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
          userId={viewer.actorId}
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
