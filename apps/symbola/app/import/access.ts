// Accès aux écrans de l'import (lot 5) : la planner seulement, et pour chaque
// type d'éléments, le module qui le reçoit doit être souscrit (dégradation
// propre, CLAUDE.md §2.3). Identifiants venus de l'URL validés avant toute
// requête.
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { IMPORT_ENTITY_MODULE, IMPORT_ENTITY_TYPES, isModuleEnabled, type ImportEntityType } from "@/modules/hub/service";

export async function availableImportEntityTypes(organizationId: string): Promise<ImportEntityType[]> {
  const { sql, db } = createAppConnection();
  try {
    const enabled = new Map<string, boolean>();
    for (const moduleKey of new Set(Object.values(IMPORT_ENTITY_MODULE))) {
      enabled.set(moduleKey, await isModuleEnabled(db, organizationId, moduleKey));
    }
    return IMPORT_ENTITY_TYPES.filter((type) => enabled.get(IMPORT_ENTITY_MODULE[type]));
  } finally {
    await sql.end();
  }
}

const idSchema = z.uuid();

export function isValidId(value: string): boolean {
  return idSchema.safeParse(value).success;
}

export function parseEntityType(value: string): ImportEntityType | null {
  return (IMPORT_ENTITY_TYPES as readonly string[]).includes(value) ? (value as ImportEntityType) : null;
}
