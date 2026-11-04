// Accès aux écrans du carnet de prestataires (lot 11, ADR 0031) :
// dégradation propre quand le module est désactivé pour l'organisation.
import { createAppConnection } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";

export async function isVendorsModuleEnabled(organizationId: string): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    return await isModuleEnabled(db, organizationId, "vendors");
  } finally {
    await sql.end();
  }
}
