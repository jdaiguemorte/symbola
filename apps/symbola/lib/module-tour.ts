// AIDE-01 — la visite d'un module s'ouvre d'office à la première visite de
// l'utilisateur sur ce module, jamais ensuite (relance par le bouton « ? »).
import { createAppConnection } from "@symbola/db/client";
import { hasSeenTour } from "@/modules/hub/service";

export async function isTourInitiallyOpen(userId: string, moduleKey: "events" | "budget" | "quotes"): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    return !(await hasSeenTour(db, userId, moduleKey));
  } finally {
    await sql.end();
  }
}
