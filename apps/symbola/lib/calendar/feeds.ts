// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — le contenu d'un flux de calendrier, dans la langue de la
// personne. Son flux : les évènements datés de l'organisation (ni essai, ni perdu ou annulé),
// intitulés « Type — prénoms des clients » (D12), avec le lien vers la fiche. Lot 64 (HUB-29 ; D2,
// D3, D4) : un évènement de son équipe (ou sans équipe) est sa plage occupée, aux heures locales,
// « occupé » s'il bloque, « provisoire » et libre sinon ; celui d'une autre équipe reste une journée
// entière, libre. Le
// flux d'un évènement : son programme du jour, séquence par séquence, aux heures de son fuseau ;
// jamais de note interne.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { eventNames, getEvent, getEventProgram, listCalendarEvents, listEventBusyRanges, listEventTypes } from "@/modules/events/service";
import { getDocumentHeader, getUserContact, isModuleEnabled, type CalendarFeedAccess } from "@/modules/hub/service";
import { listHostAppointmentsForFeed } from "@/modules/appointments/service";
import { buildIcs, wallTimeToInstant, type IcsEvent } from "./ics";

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// Le calendrier ICS d'une adresse ; null si son évènement n'existe plus (ou est un essai).
export async function calendarFeedIcs(access: CalendarFeedAccess, now: Date = new Date()): Promise<string | null> {
  const db = appDatabase();
  const locale = (await getUserContact(db, access.organizationId, access.userId))?.language ?? "fr";
  const t = createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Calendar" });
  const organization = (await getDocumentHeader(db, access.organizationId))?.organizationName ?? "";
  const appUrl = parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");

  if (access.eventId === null) {
    // Lot 46 (RDV-04, HUB-29) : ses rendez-vous, s'il les reçoit (module Rendez-vous ouvert) ; les
    // évènements, si le module Évènements l'est.
    const eventsEnabled = await isModuleEnabled(db, access.organizationId, "events");
    const [events, types, appointments, busy] = await Promise.all([
      eventsEnabled ? listCalendarEvents(access.organizationId) : Promise.resolve([]),
      eventsEnabled ? listEventTypes(access.organizationId) : Promise.resolve([]),
      listHostAppointmentsForFeed(access.organizationId, access.userId, now),
      eventsEnabled ? listEventBusyRanges(access.organizationId, { userId: access.userId }) : Promise.resolve(new Map()),
    ]);
    const typeLabel = new Map(types.map((type) => [type.id, type.label]));
    const appointmentItems: IcsEvent[] = appointments.map((appointment) => ({
      uid: `${appointment.id}@symbola`,
      summary: t("appointment", { type: appointment.typeName, name: appointment.personName }),
      start: { dateTime: new Date(appointment.startsAt) },
      end: { dateTime: new Date(appointment.endsAt) },
      location: appointment.locationKind === "place" ? appointment.location : null,
      url: `${appUrl}/rendez-vous/${appointment.id}`,
      status: "CONFIRMED",
      transparency: "OPAQUE",
    }));
    const items: IcsEvent[] = events.map((event) => {
      const names = eventNames(event.clients);
      const type = event.eventTypeId ? typeLabel.get(event.eventTypeId) : undefined;
      const range = busy.get(event.id);
      const tentative = event.status === "option" || event.status === "postponed";
      return {
        uid: `${event.id}@symbola`,
        summary: type ? `${type} — ${names}` : names,
        ...(range ? { start: { dateTime: range.start }, end: { dateTime: range.end } } : { start: { date: event.eventDate! } }),
        location: [event.venueName, event.venueCity].filter(Boolean).join(", ") || null,
        url: `${appUrl}/events/${event.id}`,
        status: tentative ? "TENTATIVE" : "CONFIRMED",
        transparency: range?.blocking ? "OPAQUE" : "TRANSPARENT",
      };
    });
    return buildIcs({ name: t("personFeed", { organization }), events: [...items, ...appointmentItems], now });
  }

  const event = await getEvent(access.organizationId, access.eventId);
  if (!event || event.isDemo) return null;
  const program = await getEventProgram(access.organizationId, access.eventId);
  const date = event.eventDate;
  const items: IcsEvent[] = date
    ? program.items.map((item) => {
        const participants = item.participants.map((participant) => participant.label).filter(Boolean);
        const description = [item.responsible ? t("responsible", { name: item.responsible }) : null, participants.length > 0 ? t("participants", { names: participants.join(", ") }) : null]
          .filter(Boolean)
          .join("\n");
        const endDate = item.endTime !== null && item.endTime <= item.startTime ? nextDate(date) : date;
        return {
          uid: `${item.id}@symbola`,
          summary: item.label,
          start: { dateTime: wallTimeToInstant(date, item.startTime, event.timeZone) },
          ...(item.endTime !== null ? { end: { dateTime: wallTimeToInstant(endDate, item.endTime, event.timeZone) } } : {}),
          location: item.location,
          description: description || null,
          url: `${appUrl}/events/${event.id}?onglet=programme`,
        };
      })
    : [];
  return buildIcs({ name: t("eventFeed", { event: eventNames(event.clients), organization }), events: items, now });
}
