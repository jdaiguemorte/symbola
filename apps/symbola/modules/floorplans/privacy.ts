// Lot 60 — contrat privacy/v1 du module floorplans (ADR 0023, RGP-05). Un plan ne porte aucun champ
// qui désigne une personne : le prestataire est désigné par son identifiant (son nom reste au module
// events), et seules les notes libres d'un élément ou d'une installation peuvent nommer quelqu'un
// (privacy.registry.yaml). Une personne n'est donc jamais trouvée « par ses champs » ici ; les plans
// d'un évènement de la personne sont une fiche « plans de salle », effacée avec l'évènement.
import { inArray } from "drizzle-orm";
import { spaces } from "@symbola/db/schema/floorplans";
import { idsOfKind, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { inOrganization, UUID } from "./repository";
import { removeEventFloorplansData } from "./removal";

const MODULE = "floorplans";

async function eventsWithPlans(organizationId: string, eventIds: string[]): Promise<{ eventId: string; spaces: number }[]> {
  const valid = eventIds.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select({ eventId: spaces.eventId }).from(spaces).where(inArray(spaces.eventId, valid)));
  const counts = new Map<string, number>();
  for (const row of rows) if (row.eventId) counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1);
  return [...counts].map(([eventId, count]) => ({ eventId, spaces: count }));
}

const deleted = (ids: string[]): ErasurePlanItem[] => ids.map((recordId) => ({ kind: "event_floorplans", recordId, fate: "deleted", legalBasis: null, keptUntil: null }));

export const floorplansPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async find() {
    return [];
  },

  async related({ organizationId, eventIds }) {
    return (await eventsWithPlans(organizationId, eventIds)).map(
      ({ eventId, spaces: count }): PrivacyRecord => ({ module: MODULE, kind: "event_floorplans", recordId: eventId, label: "Plans de salle de l'évènement", fields: { spaces: String(count) }, eventId }),
    );
  },

  async planErasure(input) {
    return deleted((await eventsWithPlans(input.organizationId, idsOfKind(input.records, "event_floorplans"))).map((entry) => entry.eventId));
  },

  async erase(input) {
    const ids = (await eventsWithPlans(input.organizationId, idsOfKind(input.records, "event_floorplans"))).map((entry) => entry.eventId);
    await removeEventFloorplansData(input.organizationId, ids);
    return deleted(ids);
  },
};
