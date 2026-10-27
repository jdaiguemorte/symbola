// Accès aux écrans du module devis : dégradation propre (CLAUDE.md §2.3)
// quand le module est désactivé pour l'organisation, et validation des
// identifiants venus de l'URL avant toute requête. Même patron que
// app/budget/module-access.ts.
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";

export async function isQuotesModuleEnabled(organizationId: string): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    return await isModuleEnabled(db, organizationId, "quotes");
  } finally {
    await sql.end();
  }
}

const idSchema = z.uuid();

export function isValidId(value: string): boolean {
  return idSchema.safeParse(value).success;
}
