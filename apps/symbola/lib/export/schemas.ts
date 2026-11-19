// Lot 35a (DAT-13, ADR 0068) — format documenté de chaque entité de l'export complet : la liste
// des entités, module par module (chaque module la donne par son service.ts), et leur schéma JSON
// (JSON Schema 2020-12, tiré du schéma Zod par z.toJSONSchema, sans dépendance). Les mêmes
// schémas sont rangés dans chaque archive (schemas/) et publiés dans docs/schemas/export/v1 ;
// un test vérifie que la publication est à jour (pnpm --filter @symbola/app export:schemas).
import { z } from "zod";
import { ORGANIZATION_EXPORT_FORMAT, type ExportEntitySchema } from "@symbola/contracts";
import { describeBudgetExport } from "@/modules/budget/service";
import { describeEventsExport } from "@/modules/events/service";
import { describeHubExport } from "@/modules/hub/service";
import { describeQuotesExport } from "@/modules/quotes/service";
import { describeVendorsExport } from "@/modules/vendors/service";
import { describeGuestsExport } from "@/modules/guests/service";
import { describeAppointmentsExport } from "@/modules/appointments/service";
import { describeFloorplansExport } from "@/modules/floorplans/service";

export function exportEntitySchemas(): ExportEntitySchema[] {
  return [...describeHubExport(), ...describeEventsExport(), ...describeBudgetExport(), ...describeQuotesExport(), ...describeVendorsExport(), ...describeGuestsExport(), ...describeAppointmentsExport(), ...describeFloorplansExport()];
}

export function entitySchemaPath(entity: Pick<ExportEntitySchema, "module" | "name">): string {
  return `schemas/${entity.module}/${entity.name}.schema.json`;
}

// Schéma JSON d'une entité : une ligne de son fichier json/<module>/<entité>.json.
export function entityJsonSchema(entity: ExportEntitySchema): Record<string, unknown> {
  return {
    title: `${entity.module}/${entity.name}`,
    description: `${ORGANIZATION_EXPORT_FORMAT} : une ligne de json/${entity.module}/${entity.name}.json`,
    ...z.toJSONSchema(entity.schema, { target: "draft-2020-12" }),
  };
}

export function entityJsonSchemaText(entity: ExportEntitySchema): string {
  return `${JSON.stringify(entityJsonSchema(entity), null, 2)}\n`;
}
