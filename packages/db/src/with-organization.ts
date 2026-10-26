// Helper de transaction (SOC-05, ADR 0012) : fixe app.organization_id pour
// toute la transaction, via set_config plutôt que SET LOCAL + paramètre
// (SET ne supporte pas les paramètres liés en protocole étendu). Les
// policies RLS lisent ce paramètre — voir packages/db/drizzle pour la
// policy du module hello.
import { sql } from "drizzle-orm";
import type { AppDatabase } from "./client";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export async function withOrganization<T>(
  db: AppDatabase,
  organizationId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
    return fn(tx);
  });
}
