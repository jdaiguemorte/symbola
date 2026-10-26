// HUB-03 — « Quand l'Admin ouvre la page Santé, il voit pour chaque app
// son état (en ligne/hors ligne) et sa version déployée. » Une seule app
// pour l'instant (ADR 0011) : réutilise les mêmes vérifications que
// /health plutôt que de les dupliquer.
import { sql as rawSql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { checkBucket, createStorageClient, pingClamav } from "@symbola/files";
import { requireAdmin } from "@/lib/require-admin";
import { runHealthChecks } from "@/lib/health";

export default async function AdminHealthPage() {
  await requireAdmin();

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

  return (
    <main>
      <h1>Santé</h1>
      <table>
        <thead>
          <tr>
            <th>App</th>
            <th>État</th>
            <th>Version</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Symbola</td>
            <td>{report.status === "ok" ? "en ligne" : "hors ligne"}</td>
            <td>{report.version}</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
