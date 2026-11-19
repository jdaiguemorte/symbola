// Lot 60 — un évènement purgé (corbeille, effacement RGPD) emporte ses plans de salle ; un fond de
// plan n'est supprimé du stockage que s'il ne sert plus à aucun espace ni version diffusée.
import { removeEventFloorplanRows } from "./layouts";
import { releaseBackground } from "./spaces";

export async function removeEventFloorplansData(organizationId: string, eventIds: string[]): Promise<void> {
  const keys = await removeEventFloorplanRows(organizationId, eventIds);
  for (const key of new Set(keys)) await releaseBackground(organizationId, key);
}
