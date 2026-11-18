"use server";

// Lot 39a (HUB-17, UX-07 ; D4, D6 ; ADR 0073) — « Supprimer l'évènement » : il va à la corbeille avec
// tout son contenu (« Annuler » pendant dix secondes, restauration pendant 30 jours). Refusé quand il
// porte une pièce à conserver : il s'annule alors, depuis son statut. Contrôles côté serveur :
// session, organisation, module ; la base ne touche que l'organisation.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { deleteEvent, EventDeletionRefusedError, TrashItemNotFoundError } from "@/lib/trash";
import { offerUndo } from "@/lib/undo";
import { eventTeamRole } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export async function deleteEventAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) redirect("/events");
  // Lot 52 (EVT-06, D2) : l'assistant d'un évènement ne le supprime pas.
  if (auth.user.role !== "owner" && (await eventTeamRole(organizationId, eventId, auth.user.id)) === "assistant") redirect(`/events/${eventId}?suppression=assistant`);
  let outcome: "deleted" | "refused" | "missing" = "deleted";
  try {
    await deleteEvent(organizationId, eventId);
  } catch (error) {
    if (error instanceof EventDeletionRefusedError) outcome = "refused";
    else if (error instanceof TrashItemNotFoundError) outcome = "missing";
    else throw error;
  }
  if (outcome === "refused") redirect(`/events/${eventId}?suppression=refusee`);
  if (outcome === "deleted") await offerUndo({ kind: "event", id: eventId });
  revalidatePath("/events");
  redirect("/events");
}
