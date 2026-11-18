// Lot 50 (INV-05) — effets d'une réponse ou d'un effacement sur le plan de table, appelés dans la
// transaction de l'écriture (page de réponse, réponse notée par la planner, effacement RGPD) :
// - un invité placé qui se désiste quitte sa table ; la place garde la trace du désistement (date,
//   nom de la table) pour prévenir la planner sur le plan, jusqu'à ce qu'elle l'efface ;
// - une contrainte réduite à moins de deux personnes disparaît.
// Sans dépendance vers households.ts (pas de cycle).
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { rsvpAnswers, seatAssignments, seatingConstraintMembers, seatingConstraints, seatingPlans, seatingTables } from "@symbola/db/schema/guests";
import type { Tx } from "./repository";

export async function releaseDeclinedSeats(tx: Tx, guestIds: readonly string[], now: Date = new Date()): Promise<number> {
  if (guestIds.length === 0) return 0;
  const declined = await tx
    .select({ id: seatAssignments.id, tableName: seatingTables.name })
    .from(seatAssignments)
    .innerJoin(seatingPlans, eq(seatingPlans.id, seatAssignments.planId))
    .innerJoin(seatingTables, eq(seatingTables.id, seatAssignments.tableId))
    .innerJoin(rsvpAnswers, and(eq(rsvpAnswers.guestId, seatAssignments.guestId), eq(rsvpAnswers.keyMomentId, seatingPlans.keyMomentId)))
    .where(and(inArray(seatAssignments.guestId, [...guestIds]), isNull(seatAssignments.releasedAt), eq(rsvpAnswers.attending, false)));
  for (const seat of declined) {
    await tx.update(seatAssignments).set({ tableId: null, releasedAt: now, releasedTableName: seat.tableName.slice(0, 60), updatedAt: now }).where(eq(seatAssignments.id, seat.id));
  }
  return declined.length;
}

export async function pruneSeatingConstraints(tx: Tx): Promise<void> {
  const kept = tx
    .select({ id: seatingConstraintMembers.constraintId })
    .from(seatingConstraintMembers)
    .groupBy(seatingConstraintMembers.constraintId)
    .having(sql`count(*) >= 2`);
  await tx.delete(seatingConstraints).where(sql`${seatingConstraints.id} not in (${kept})`);
}
