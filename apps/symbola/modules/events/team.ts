// Lot 52 (EVT-06 ; D2 ; ADR 0094) — l'équipe d'un évènement : un planner principal (un seul, il reçoit
// les alertes et récapitulatifs du lot 53) et des assistants (tout l'évènement, sauf sa suppression).
// Visibilité : la Propriétaire voit tout ; une Planner voit les évènements de son équipe, ou tous si le
// réglage d'organisation « toutes les Planners voient tout » est activé (par défaut). Le membre est un
// compte de l'organisation, vérifié par l'appelant (hub, adhésions actives). Accès aux données du
// module events ; exposé seulement par service.ts (ADR 0011).
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { eventTeamMembers, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventTeamMember, EventTeamRole } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export async function findEventTeam(organizationId: string, eventId: string): Promise<EventTeamMember[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ userId: eventTeamMembers.userId, role: eventTeamMembers.role })
      .from(eventTeamMembers)
      .where(eq(eventTeamMembers.eventId, eventId))
      .orderBy(asc(eventTeamMembers.role), asc(eventTeamMembers.createdAt)),
  );
  return rows.map((row) => ({ userId: row.userId, role: row.role as EventTeamRole }));
}

export type SetTeamMemberResult = "saved" | "not_found";

// Ajoute un membre ou change son rôle ; un nouveau planner principal fait de l'ancien un assistant.
export async function upsertEventTeamMember(input: { organizationId: string; eventId: string; userId: string; role: EventTeamRole; byUserId: string }): Promise<SetTeamMemberResult> {
  const saved = await inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) return false;
    if (input.role === "lead") {
      await tx
        .update(eventTeamMembers)
        .set({ role: "assistant" })
        .where(and(eq(eventTeamMembers.eventId, input.eventId), eq(eventTeamMembers.role, "lead"), ne(eventTeamMembers.userId, input.userId)));
    }
    await tx
      .insert(eventTeamMembers)
      .values({ organizationId: input.organizationId, eventId: input.eventId, userId: input.userId, role: input.role })
      .onConflictDoUpdate({ target: [eventTeamMembers.eventId, eventTeamMembers.userId], set: { role: input.role } });
    return true;
  });
  if (!saved) return "not_found";
  await recordAudit(appDatabase(), {
    organizationId: input.organizationId,
    action: "events.team.changed",
    objectId: input.eventId,
    details: { userId: input.userId, role: input.role },
    actor: { kind: "member", id: input.byUserId },
  });
  return "saved";
}

export async function deleteEventTeamMember(input: { organizationId: string; eventId: string; userId: string; byUserId: string }): Promise<boolean> {
  const removed = await inOrganization(input.organizationId, (tx) =>
    tx
      .delete(eventTeamMembers)
      .where(and(eq(eventTeamMembers.eventId, input.eventId), eq(eventTeamMembers.userId, input.userId)))
      .returning({ id: eventTeamMembers.id }),
  );
  if (removed.length === 0) return false;
  await recordAudit(appDatabase(), {
    organizationId: input.organizationId,
    action: "events.team.changed",
    objectId: input.eventId,
    details: { userId: input.userId, role: null },
    actor: { kind: "member", id: input.byUserId },
  });
  return true;
}

// HUB-04 : un membre retiré de l'organisation est retiré de toutes ses équipes d'évènement.
export async function deleteMemberFromAllTeams(organizationId: string, userId: string): Promise<number> {
  const removed = await inOrganization(organizationId, (tx) => tx.delete(eventTeamMembers).where(eq(eventTeamMembers.userId, userId)).returning({ id: eventTeamMembers.id }));
  return removed.length;
}

// Les évènements dont ce compte est dans l'équipe.
export async function findTeamEventIds(organizationId: string, userId: string): Promise<Set<string>> {
  const rows = await inOrganization(organizationId, (tx) => tx.select({ eventId: eventTeamMembers.eventId }).from(eventTeamMembers).where(eq(eventTeamMembers.userId, userId)));
  return new Set(rows.map((row) => row.eventId));
}

// Rôle de ce compte dans l'équipe de l'évènement, ou null.
export async function findTeamRole(organizationId: string, eventId: string, userId: string): Promise<EventTeamRole | null> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ role: eventTeamMembers.role })
      .from(eventTeamMembers)
      .where(and(eq(eventTeamMembers.eventId, eventId), eq(eventTeamMembers.userId, userId))),
  );
  return (row?.role as EventTeamRole | undefined) ?? null;
}

// Le planner principal de chaque évènement demandé (lot 53 : à qui adresser alertes et récapitulatifs).
export async function findEventLeads(organizationId: string, eventIds: string[]): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ eventId: eventTeamMembers.eventId, userId: eventTeamMembers.userId })
      .from(eventTeamMembers)
      .where(and(inArray(eventTeamMembers.eventId, eventIds), eq(eventTeamMembers.role, "lead"))),
  );
  return new Map(rows.map((row) => [row.eventId, row.userId]));
}

// D2 — ce qu'une personne de l'équipe voit : tout (null), ou les évènements de son équipe.
export type EventViewer = { userId: string; role: "owner" | "member"; allPlannersSeeAll: boolean };

export function seesAllEvents(viewer: EventViewer): boolean {
  return viewer.role === "owner" || viewer.allPlannersSeeAll;
}
