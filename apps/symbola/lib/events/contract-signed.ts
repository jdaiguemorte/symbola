// Lot 72d (EVT-05 ; E2, J2 ; SEC-12, SEC-13) — « Le contrat est signé… » pour la personne connectée : refusé
// sans session de l'équipe (un lien des mariés n'en ouvre pas), pour un évènement d'une autre organisation
// et pour un évènement qu'une Planner ne voit pas (réglage de visibilité du lot 52) ; ces deux refus
// répondent comme un évènement inexistant (SEC-13). La règle de la date est celle du service (72a).
import { canViewEvent, ContractSignedDateError, EventArchivedError, EventNotFoundError, EventStatusTransitionError, markContractSigned } from "@/modules/events/service";

type EventViewer = Parameters<typeof canViewEvent>[1];

export type SignContractOutcome = { ok: true } | { ok: false; reason: "unauthenticated" | "not_found" | "transition" | "invalid" | "future" | "too_early" };

export async function signContractAs(
  viewer: (EventViewer & { organizationId: string }) | null,
  input: { eventId: string; signedOn: string; now?: Date },
): Promise<SignContractOutcome> {
  if (!viewer) return { ok: false, reason: "unauthenticated" };
  if (!(await canViewEvent(viewer.organizationId, viewer, input.eventId))) return { ok: false, reason: "not_found" };
  try {
    await markContractSigned({ organizationId: viewer.organizationId, eventId: input.eventId, changedByUserId: viewer.userId, signedOn: input.signedOn, ...(input.now ? { now: input.now } : {}) });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { ok: false, reason: "not_found" };
    // Un évènement archivé est en lecture seule (lot 58) : l'étape ne se franchit plus.
    if (error instanceof EventStatusTransitionError || error instanceof EventArchivedError) return { ok: false, reason: "transition" };
    if (error instanceof ContractSignedDateError) return { ok: false, reason: error.reason };
    throw error;
  }
  return { ok: true };
}
