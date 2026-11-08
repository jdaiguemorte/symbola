// Lot 16 (ADR 0045) — types d'événement : une organisation qui n'en a aucun
// (créée avant le lot 16, ou sans passer par l'assistant de démarrage) reçoit
// ceux de départ, dans l'ordre de son métier et dans la langue affichée.
import type { Locale } from "@symbola/i18n";
import { starterEventTypes } from "@symbola/starter-templates";
import { addStarterEventTypes, listEventTypes, type EventType } from "@/modules/events/service";
import { organizationMetier } from "@/lib/vendors/catalog";

export async function ensureEventTypes(organizationId: string, locale: Locale): Promise<EventType[]> {
  const types = await listEventTypes(organizationId);
  if (types.length > 0) return types;
  await addStarterEventTypes(organizationId, starterEventTypes(locale, await organizationMetier(organizationId)));
  return listEventTypes(organizationId);
}
