// Lot 32a (HUB-08, UX-06, EVT-02 ; décisions D4 et D6) — accès aux données des urgences propres au
// module Évènements, pour toute l'organisation : décisions du client sans réponse, prestataires
// retenus sans contrat signé, relance d'un prestataire inscrite dans l'activité. Jamais importé hors
// de modules/events/ (ADR 0011) ; tout se lit et s'écrit sous RLS, dans l'organisation. Les essais
// et les évènements clos (faits ou perdus) ne demandent rien.
import { and, asc, desc, eq, gt, gte, isNull, notExists, notInArray, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventActivities, eventDecisions, events, eventVendorCandidateNotes, eventVendorCandidates, eventVendorSlots, vendorReminders } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";

// Lot 34a : un évènement clôturé ou annulé ne demande plus rien.
const CLOSED_STATUSES: ("cancelled" | "closed")[] = ["cancelled", "closed"];

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
          // Lot 65d (M16) : une relance notée le retire jusqu'à son rappel ; il revient le jour du rappel.
          notExists(tx.select({ id: vendorReminders.id }).from(vendorReminders).where(and(eq(vendorReminders.candidateId, eventVendorCandidates.id), gt(vendorReminders.recallOn, today)))),
        ),
      )
      .orderBy(asc(eventVendorCandidates.updatedAt)),
  );
}

// La relance va à l'activité de l'évènement, au nom du prestataire ; null si le prestataire n'est
// pas celui de cet évènement (ou d'une autre organisation : invisible sous RLS). Lot 65d (M16) : la
// planner la déclare (moyen, date, rappel) ; sa note facultative devient une note interne du
// prestataire.
export async function insertVendorReminder(input: {
  organizationId: string;
  eventId: string;
  candidateId: string;
  userId: string;
  channel: "phone" | "email" | "sms" | "in_person";
  remindedOn: string;
  recallOn: string | null;
  note: string | null;
}): Promise<{ vendorName: string; vendorId: string | null; slotLabel: string } | null> {
  return await withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [found] = await tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(and(eq(eventVendorCandidates.id, input.candidateId), eq(eventVendorCandidates.eventId, input.eventId)));
    if (!found) return null;
    const { candidate } = found;
    const [note] = input.note
      ? await tx.insert(eventVendorCandidateNotes).values({ organizationId: input.organizationId, candidateId: candidate.id, body: input.note, visibleToClients: false, createdByUserId: input.userId }).returning({ id: eventVendorCandidateNotes.id })
      : [];
    await tx.insert(vendorReminders).values({
      organizationId: input.organizationId,
      eventId: input.eventId,
      candidateId: candidate.id,
      channel: input.channel,
      remindedOn: input.remindedOn,
      recallOn: input.recallOn,
      noteId: note?.id ?? null,
    });
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

// Lot 65d (M16) : la dernière relance notée de chaque prestataire d'un évènement (« Relancé le … »).
export async function findLastVendorReminders(organizationId: string, eventId: string): Promise<Map<string, { remindedOn: string; channel: string; recallOn: string | null }>> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ candidateId: vendorReminders.candidateId, remindedOn: vendorReminders.remindedOn, channel: vendorReminders.channel, recallOn: vendorReminders.recallOn })
      .from(vendorReminders)
      .where(eq(vendorReminders.eventId, eventId))
      .orderBy(desc(vendorReminders.remindedOn), desc(vendorReminders.createdAt)),
  );
  const last = new Map<string, { remindedOn: string; channel: string; recallOn: string | null }>();
  for (const row of rows) if (!last.has(row.candidateId)) last.set(row.candidateId, { remindedOn: row.remindedOn, channel: row.channel, recallOn: row.recallOn });
  return last;
}
