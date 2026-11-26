// Lot 53 (HUB-15, UX-16 ; D3 ; ADR 0095) — faits publiés par les modules (domain_events) qui deviennent
// des notifications de l'équipe : nouvelle demande de contact, réponse d'un prestataire. Chaque module
// est lu par son service (ARC-01) ; une notification n'est créée qu'une fois par objet.
import { listTeam } from "@symbola/auth";
import { EVT_PROSPECT_RECEIVED, EVT_TASK_ASSIGNED, EVT_VENDOR_ANSWERED, prospectReceivedPayloadSchema, taskAssignedPayloadSchema, vendorAnsweredPayloadSchema } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import type { DomainEventRecord, EventHandler } from "@symbola/db/events/worker";
import { getEvent, getTaskBrief } from "@/modules/events/service";
import { notify } from "@/modules/hub/service";

async function eventFacts(organizationId: string, eventId: string | null): Promise<{ eventDate: string | null; isDemo: boolean } | null> {
  if (!eventId) return { eventDate: null, isDemo: false };
  const event = await getEvent(organizationId, eventId).catch(() => null);
  return event ? { eventDate: event.eventDate, isDemo: event.isDemo } : null;
}

// Lot 70a (A19) : la personne est encore une titulaire ou une Planner active de cette organisation.
async function isActiveMember(organizationId: string, userId: string): Promise<boolean> {
  const member = (await listTeam(appDatabase(), organizationId)).find((entry) => entry.id === userId && !entry.disabledAt);
  return member?.role === "owner" || member?.role === "member";
}

export const NOTIFICATION_CONSUMERS: Record<string, EventHandler> = {
  // Lot 70a (CHR-02, HUB-15 ; A19) : une tâche confiée à un collègue. Seule une tâche (ou un lot) par
  // personne et par geste (clé d'objet) ; jamais à quelqu'un d'une autre organisation ou qui n'en est plus
  // membre ; rien si la tâche a disparu, est faite ou a changé de mains entre-temps. Le titre (court) et
  // le nombre ; l'identifiant de qui a confié, dont le nom se lit à l'affichage.
  [EVT_TASK_ASSIGNED]: async (event: DomainEventRecord) => {
    const payload = taskAssignedPayloadSchema.parse(event.payload);
    if (!(await isActiveMember(event.organizationId, payload.assigneeUserId))) return;
    const facts = await eventFacts(event.organizationId, payload.eventId);
    if (!facts) return;
    const batch = payload.batch && payload.batch.count > 1 ? payload.batch : null;
    if (batch) {
      await notify({
        organizationId: event.organizationId,
        type: "task_assigned",
        eventId: null,
        objectKey: `assign:${payload.assigneeUserId}:${batch.id}`,
        params: { count: batch.count, by: payload.assignedByUserId },
        href: "/taches?qui=moi",
        userIds: [payload.assigneeUserId],
        isDemo: facts.isDemo,
        now: event.occurredAt,
      });
      return;
    }
    const task = await getTaskBrief(event.organizationId, payload.taskId);
    if (!task || task.done || task.assigneeUserId !== payload.assigneeUserId) return;
    await notify({
      organizationId: event.organizationId,
      type: "task_assigned",
      eventId: payload.eventId,
      objectKey: `${payload.taskId}:${event.id}`,
      params: { label: task.label.slice(0, 200), count: 1, by: payload.assignedByUserId },
      href: `/taches?tache=${payload.taskId}`,
      userIds: [payload.assigneeUserId],
      eventDate: facts.eventDate,
      isDemo: facts.isDemo,
      now: event.occurredAt,
    });
  },
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
