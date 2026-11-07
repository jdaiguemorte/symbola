// Lot 15 (DB-01) — `pnpm --filter @symbola/db rollback -- <tag>` : annule la
// dernière migration appliquée (voir rollback-migration.ts et le runbook de
// restauration). À lancer après une sauvegarde, jamais par l'app.
import postgres from "postgres";
import { parseAdminEnv } from "./admin-env";
import { rollbackMigration } from "./rollback-migration";

async function main() {
  const tag = process.argv.slice(2).find((arg) => arg !== "--");
  if (!tag) throw new Error("Indiquez la migration à annuler, par exemple : pnpm --filter @symbola/db rollback -- 0074_lot15_grant_import_jobs");
  const env = parseAdminEnv(process.env);
  const sql = postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database: env.POSTGRES_DB, username: env.POSTGRES_ADMIN_USER, password: env.POSTGRES_ADMIN_PASSWORD, max: 1 });
  try {
    await rollbackMigration(sql, tag, {
      migrations: new URL("../drizzle", import.meta.url).pathname,
      rollbacks: new URL("../drizzle-rollback", import.meta.url).pathname,
    });
    console.log(`Migration ${tag} annulée.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
