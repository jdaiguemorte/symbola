// Lot 13 (L13-HUB-15) — éléments du bloc « À traiter » : devis envoyés sans
// réponse et prospects sans nouvelle au-delà des délais de relance de
// l'organisation, les plus anciens d'abord.
import { appDatabase } from "@symbola/db/client";
import { eventNames, listEvents, listStaleProspects } from "@/modules/events/service";
import { listQuotesAwaitingAnswer } from "@/modules/quotes/service";
import { getFollowUpDelays } from "@/modules/hub/service";

export type FollowUpItem = { key: string; label: string; href: string; days: number };

export async function loadFollowUps(
  organizationId: string,
  modules: { events: boolean; quotes: boolean },
  labels: { quote: (number: string, names: string) => string; prospect: (names: string) => string },
  now: Date = new Date(),
): Promise<FollowUpItem[]> {
  const db = appDatabase();
  const delays = await getFollowUpDelays(db, organizationId);
  const items: FollowUpItem[] = [];
  if (modules.quotes && modules.events) {
    const quotes = await listQuotesAwaitingAnswer(organizationId, delays.quoteFollowUpDays, now);
    if (quotes.length > 0) {
      const names = new Map((await listEvents({ organizationId })).map((event) => [event.id, eventNames(event.clients)]));
      for (const quote of quotes) {
        items.push({ key: `q-${quote.quoteId}`, label: labels.quote(quote.number, names.get(quote.eventId) ?? ""), href: `/devis/${quote.quoteId}`, days: quote.daysSince });
      }
    }
  }
  if (modules.events) {
    for (const prospect of await listStaleProspects(organizationId, delays.prospectFollowUpDays, now)) {
      items.push({ key: `p-${prospect.eventId}`, label: labels.prospect(prospect.names), href: `/events/${prospect.eventId}`, days: prospect.daysSince });
    }
  }
  return items.sort((a, b) => b.days - a.days);
}
