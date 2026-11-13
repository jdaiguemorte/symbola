"use server";

// Lot 32b (CRM-04 ; décision D10) — à la saisie d'une date d'évènement, les évènements confirmés et
// les options (prospect, devis envoyé) du même jour, avant l'enregistrement. L'alerte n'empêche
// rien. Contrôles côté serveur : session planner, organisation, module Évènements ; les noms ne
// sortent que pour l'organisation de la planner (RLS).
import { getPlannerAuthContext } from "@/lib/auth-context";
import { sameDayEvents } from "@/lib/portfolio/portfolio";
import { eventNames, listEvents } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "./module-access";

export type SameDayEvent = { names: string; confirmed: boolean };

export async function sameDayEventsAction(date: string, excludeEventId: string | null): Promise<SameDayEvent[]> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return [];
  const organizationId = auth.user.organizationId;
  if (typeof date !== "string" || !(await isEventsModuleEnabled(organizationId))) return [];
  const exclude = typeof excludeEventId === "string" && isValidId(excludeEventId) ? excludeEventId : undefined;
  return sameDayEvents(await listEvents({ organizationId }), date, exclude).map((event) => ({
    names: eventNames(event.clients),
    confirmed: event.status === "confirmed",
  }));
}
