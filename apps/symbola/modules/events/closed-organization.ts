// Lot 35c (RGP-11, ADR 0100) — un espace fermé ferme les liens des tiers : client, payeur,
// prestataire, renfort du jour J, partage de document, brochure, formulaire de contact. Lus par le
// hub, à chaque ouverture ; ils se rouvrent avec l'espace.
import { appDatabase } from "@symbola/db/client";
import { isOrganizationClosed } from "@/modules/hub/service";

export function organizationLinksClosed(organizationId: string): Promise<boolean> {
  return isOrganizationClosed(appDatabase(), organizationId);
}
