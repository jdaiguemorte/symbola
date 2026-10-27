// Accès aux écrans du module events : dégradation propre (CLAUDE.md §2.3)
// quand le module est désactivé pour l'organisation, et validation des
// identifiants venus de l'URL ou d'un formulaire avant toute requête.
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";

export async function isEventsModuleEnabled(organizationId: string): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    return await isModuleEnabled(db, organizationId, "events");
  } finally {
    await sql.end();
  }
}

const idSchema = z.uuid();

export function isValidId(value: string): boolean {
  return idSchema.safeParse(value).success;
}
