// Lot 49 (HUB-13, DAT-13, ADR 0068) — entités du module Invités dans l'export complet de
// l'organisation (contrat export/v1). Les régimes (chiffrés, données de santé) et les empreintes des
// liens ne sortent pas ; une archive qui contient des foyers est supprimée à la purge des invités de
// l'évènement (RGP-08). Les lignes d'un évènement d'essai sont exclues. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { dietaryOptions, dietConsents, eventSettings, guestImports, guests, householdGroups, households, moduleSettings, purgePostponements, rsvpAnswers } from "@symbola/db/schema/guests";

const ofEvent = { eventField: "eventId" } as const;

export const GUESTS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: moduleSettings, idField: "organizationId" },
  { table: dietaryOptions },
  { table: eventSettings, ...ofEvent },
  { table: householdGroups, ...ofEvent },
  { table: guestImports, ...ofEvent },
  { table: households, ...ofEvent },
  { table: guests, ...ofEvent, parents: { householdId: "households" } },
  { table: rsvpAnswers, parents: { guestId: "guests" } },
  { table: dietConsents, ...ofEvent },
  { table: purgePostponements, ...ofEvent },
];

export const GUESTS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  diets: "régimes et allergies des invités, chiffrés au niveau du champ (données de santé, article 9) : ils restent dans Symbola, réservés à la titulaire, et sont purgés sept jours après l'évènement",
  guest_links: "empreintes des jetons des liens personnels des invités : sans usage hors de Symbola",
};

export function exportGuestsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "guests", context, specs: GUESTS_EXPORT_ENTITIES });
}

export function describeGuestsExport(): ExportEntitySchema[] {
  return describeModuleEntities("guests", GUESTS_EXPORT_ENTITIES);
}
