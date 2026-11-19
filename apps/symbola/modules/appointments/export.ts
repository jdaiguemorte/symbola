// Lot 46 (HUB-13, DAT-13 ; ADR 0068, ADR 0082) — entités du module Rendez-vous dans l'export complet
// de l'organisation (contrat export/v1) : page de réservation, types, disponibilités, agendas
// extérieurs (sans leur adresse secrète), rendez-vous, comptes rendus et actions. Les rendez-vous
// d'essai sont exclus ; le jeton de gestion n'est jamais exporté. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { eraseOrganizationSchema } from "@symbola/db/erase";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import {
  appointmentReportActions,
  appointmentReports,
  appointments,
  appointmentTypes,
  availabilityClosures,
  availabilityRules,
  bookingPages,
  calendarSources,
} from "@symbola/db/schema/appointments";

export const APPOINTMENTS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: bookingPages },
  { table: appointmentTypes },
  { table: availabilityRules },
  { table: availabilityClosures },
  // L'adresse secrète est chiffrée avec la clé de Symbola : illisible ailleurs, et un justificatif.
  // Lot 35b : sans elle, l'agenda est à relier de nouveau après une reprise.
  { table: calendarSources, omit: ["urlSealed"], importSkip: "secret" },
  { table: appointments, demoField: "isDemo", eventField: "eventId", omit: ["manageTokenHash"], parents: { typeId: "appointment_types" } },
  { table: appointmentReports, parents: { appointmentId: "appointments" } },
  { table: appointmentReportActions, parents: { reportId: "appointment_reports" } },
];

export const APPOINTMENTS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  busy_intervals: "technique : plages occupées relues dans les agendas extérieurs toutes les quinze minutes, sans titre ; l'agenda d'origine les garde",
};

export function exportAppointmentsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "appointments", context, specs: APPOINTMENTS_EXPORT_ENTITIES });
}

export function describeAppointmentsExport(): ExportEntitySchema[] {
  return describeModuleEntities("appointments", APPOINTMENTS_EXPORT_ENTITIES);
}

// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide (transaction de la
// reprise) ; les réglages de départ et les essais de l'organisation sont remplacés par ceux de l'archive.
export function registerAppointmentsImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(APPOINTMENTS_EXPORT_ENTITIES, rows, context);
}

export async function importAppointmentsData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: APPOINTMENTS_EXPORT_ENTITIES });
  return { module: "appointments", entities: await importModuleEntities(tx, { specs: APPOINTMENTS_EXPORT_ENTITIES, rows, context }) };
}

// Lot 35c (RGP-11, D8, ADR 0100) : effacement de toutes les lignes du module d'une organisation fermée,
// à sa date de suppression (la base le refuse avant) ; fichiers effacés par l'orchestrateur.
export function eraseAppointmentsData(tx: OrganizationTransaction, organizationId: string): Promise<number> {
  return eraseOrganizationSchema(tx, organizationId, "appointments");
}
