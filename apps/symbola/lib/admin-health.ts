// Lot 13 (HUB-17) — vérifications des services du socle pour la console
// d'Administration (vue d'ensemble et page Santé), les mêmes que la page
// publique /health (SOC-11), sans jamais exposer un message d'erreur.
import { sql as rawSql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { checkBucket, createStorageClient, pingClamav } from "@symbola/files";
import { runHealthChecks, type HealthReport } from "./health";

export const ADMIN_HEALTH_SERVICES = ["database", "storage", "antivirus"] as const;

export async function runAdminHealthChecks(): Promise<HealthReport> {
  const env = parseEnv(process.env);
  return runHealthChecks(
    {
      database: async () => {
        const db = appDatabase();
        await db.execute(rawSql`select 1`);
      },
      storage: () => checkBucket(createStorageClient()),
      antivirus: () => pingClamav({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT }),
    },
    { version: env.APP_VERSION },
  );
}
