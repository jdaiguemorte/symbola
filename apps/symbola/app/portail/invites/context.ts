// Lot 49 (INV-01) — les clients de l'évènement du lien, pour choisir le côté d'un foyer.
import { guestEventContexts } from "@/modules/events/service";

export async function guestEventContextFor(organizationId: string, eventId: string): Promise<{ clients: { id: string; name: string }[] }> {
  const [context] = await guestEventContexts(organizationId, [eventId]);
  return { clients: (context?.clients ?? []).map((client) => ({ id: client.id, name: [client.firstName, client.lastName].filter(Boolean).join(" ") })) };
}
