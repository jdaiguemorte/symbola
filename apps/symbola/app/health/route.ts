// GET /health (SOC-11) : état et version, lu par Uptime Kuma. Publique et
// sans session : ne renvoie aucune donnée métier ni détail d'erreur.
import { sql as rawSql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { checkBucket, createStorageClient, pingClamav } from "@symbola/files";
import { httpStatusFor, runHealthChecks } from "../../lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const env = parseEnv(process.env);

  const report = await runHealthChecks(
    {
      database: async () => {
        const { sql, db } = createAppConnection();
        try {
          await db.execute(rawSql`select 1`);
        } finally {
          await sql.end();
        }
      },
      storage: () => checkBucket(createStorageClient()),
      antivirus: () => pingClamav({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT }),
    },
    { version: env.APP_VERSION },
  );

  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "Cache-Control": "no-store" },
  });
}
