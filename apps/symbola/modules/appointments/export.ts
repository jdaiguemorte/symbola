// Lot 46 (HUB-13, DAT-13 ; ADR 0068, ADR 0082) — entités du module Rendez-vous dans l'export complet
// de l'organisation (contrat export/v1) : page de réservation, types, disponibilités, agendas
// extérieurs (sans leur adresse secrète), rendez-vous, comptes rendus et actions. Les rendez-vous
// d'essai sont exclus ; le jeton de gestion n'est jamais exporté. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
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
  { table: calendarSources, omit: ["urlSealed"] },
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
