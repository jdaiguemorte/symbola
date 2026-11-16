// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — le contenu d'un flux de calendrier, dans la langue de la
// personne. Son flux : les évènements datés de l'organisation (ni essai, ni perdu ou annulé), en
// journée entière, intitulés « Type — prénoms des clients » (D12), avec le lien vers la fiche. Le
// flux d'un évènement : son programme du jour, séquence par séquence, aux heures de son fuseau ;
// jamais de note interne.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { eventNames, getEvent, getEventProgram, listCalendarEvents, listEventTypes } from "@/modules/events/service";
import { getDocumentHeader, getUserContact, type CalendarFeedAccess } from "@/modules/hub/service";
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
    const [events, types] = await Promise.all([listCalendarEvents(access.organizationId), listEventTypes(access.organizationId)]);
    const typeLabel = new Map(types.map((type) => [type.id, type.label]));
    const items: IcsEvent[] = events.map((event) => {
      const names = eventNames(event.clients);
      const type = event.eventTypeId ? typeLabel.get(event.eventTypeId) : undefined;
      return {
        uid: `${event.id}@symbola`,
        summary: type ? `${type} — ${names}` : names,
        start: { date: event.eventDate! },
        location: [event.venueName, event.venueCity].filter(Boolean).join(", ") || null,
        url: `${appUrl}/events/${event.id}`,
        status: event.status === "option" ? "TENTATIVE" : "CONFIRMED",
      };
    });
    return buildIcs({ name: t("personFeed", { organization }), events: items, now });
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
