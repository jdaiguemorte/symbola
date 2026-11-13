// Lot 32a (HUB-08, UX-06, EVT-02 ; décisions D4 et D6) — accès aux données des urgences propres au
// module Évènements, pour toute l'organisation : décisions du client sans réponse, prestataires
// retenus sans contrat signé, relance d'un prestataire inscrite dans l'activité. Jamais importé hors
// de modules/events/ (ADR 0011) ; tout se lit et s'écrit sous RLS, dans l'organisation. Les essais
// et les évènements clos (faits ou perdus) ne demandent rien.
import { and, asc, eq, gte, isNull, notInArray, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventActivities, eventDecisions, events, eventVendorCandidates, eventVendorSlots } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";

const CLOSED_STATUSES: ("lost" | "done")[] = ["lost", "done"];

export type PendingDecisionRow = typeof eventDecisions.$inferSelect;

export async function findPendingDecisions(organizationId: string): Promise<PendingDecisionRow[]> {
  return await withOrganization(appDatabase(), organizationId, async (tx) =>
    (
      await tx
        .select({ decision: eventDecisions })
        .from(eventDecisions)
        .innerJoin(events, eq(events.id, eventDecisions.eventId))
        .where(and(eq(eventDecisions.status, "pending"), eq(events.isDemo, false), notInArray(events.status, CLOSED_STATUSES)))
        .orderBy(asc(eventDecisions.requestedAt))
    ).map((row) => row.decision),
  );
}

export type UncontractedVendorRow = { candidate: typeof eventVendorCandidates.$inferSelect; slotLabel: string };

// Retenu, sans contrat signé, sur un évènement en cours dont la date n'est pas passée.
export async function findUncontractedVendors(organizationId: string, today: string): Promise<UncontractedVendorRow[]> {
  return await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(
        and(
          eq(eventVendorCandidates.status, "retained"),
          eq(events.isDemo, false),
          notInArray(events.status, CLOSED_STATUSES),
          or(isNull(events.eventDate), gte(events.eventDate, today)),
        ),
      )
      .orderBy(asc(eventVendorCandidates.updatedAt)),
  );
}

// La relance va à l'activité de l'évènement, au nom du prestataire ; null si le prestataire n'est
// pas celui de cet évènement (ou d'une autre organisation : invisible sous RLS).
export async function insertVendorReminder(input: {
  organizationId: string;
  eventId: string;
  candidateId: string;
  userId: string;
}): Promise<{ vendorName: string; vendorId: string | null; slotLabel: string } | null> {
  return await withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [found] = await tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(and(eq(eventVendorCandidates.id, input.candidateId), eq(eventVendorCandidates.eventId, input.eventId)));
    if (!found) return null;
    const { candidate } = found;
    await tx.insert(eventActivities).values({
      organizationId: input.organizationId,
      eventId: input.eventId,
      actorUserId: input.userId,
      kind: "vendor_reminded",
      // RGP-05 : pas de copie du nom ; le fil le lit sur le prestataire (anonymisé ou retiré avec lui).
      taskLabel: "",
      vendorCandidateId: candidate.id,
    });
    return { vendorName: candidate.vendorName, vendorId: candidate.vendorId, slotLabel: found.slotLabel };
  });
}
