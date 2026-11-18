// Lot 53 (HUB-15, UX-16 ; D3 ; ADR 0095) — faits publiés par les modules (domain_events) qui deviennent
// des notifications de l'équipe : nouvelle demande de contact, réponse d'un prestataire. Chaque module
// est lu par son service (ARC-01) ; une notification n'est créée qu'une fois par objet.
import { EVT_PROSPECT_RECEIVED, EVT_VENDOR_ANSWERED, prospectReceivedPayloadSchema, vendorAnsweredPayloadSchema } from "@symbola/contracts";
import type { DomainEventRecord, EventHandler } from "@symbola/db/events/worker";
import { getEvent } from "@/modules/events/service";
import { notify } from "@/modules/hub/service";

async function eventFacts(organizationId: string, eventId: string | null): Promise<{ eventDate: string | null; isDemo: boolean } | null> {
  if (!eventId) return { eventDate: null, isDemo: false };
  const event = await getEvent(organizationId, eventId).catch(() => null);
  return event ? { eventDate: event.eventDate, isDemo: event.isDemo } : null;
}

export const NOTIFICATION_CONSUMERS: Record<string, EventHandler> = {
  // Une demande mise de côté (« à vérifier ») mène à la liste des demandes, les autres à leur fiche.
  [EVT_PROSPECT_RECEIVED]: async (event: DomainEventRecord) => {
    const payload = prospectReceivedPayloadSchema.parse(event.payload);
    const facts = await eventFacts(event.organizationId, payload.eventId);
    if (!facts) return;
    await notify({
      organizationId: event.organizationId,
      type: "prospect_request",
      eventId: payload.eventId,
      objectKey: payload.requestId,
      href: payload.eventId ? `/events/${payload.eventId}` : "/events/pipeline",
      eventDate: facts.eventDate,
      isDemo: facts.isDemo,
      now: event.occurredAt,
    });
  },
  [EVT_VENDOR_ANSWERED]: async (event: DomainEventRecord) => {
    const payload = vendorAnsweredPayloadSchema.parse(event.payload);
    const facts = await eventFacts(event.organizationId, payload.eventId);
    if (!facts) return;
    await notify({
      organizationId: event.organizationId,
      type: "vendor_answer",
      eventId: payload.eventId,
      objectKey: `${payload.candidateId}:${event.id}`,
      href: `/events/${payload.eventId}?onglet=prestataires`,
      eventDate: facts.eventDate,
      isDemo: facts.isDemo,
      now: event.occurredAt,
    });
  },
};
