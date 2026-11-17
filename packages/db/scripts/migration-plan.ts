// Lot 40a (ARC-14, décision D5, ADR 0075) — `pnpm --filter @symbola/db migrate:plan` : liste les
// migrations qui restent à appliquer et dit si l'une d'elles demande d'arrêter l'app. Lu par
// infra/server/deploy.sh, avant `migrate`. Lecture seule, avec le rôle admin (comme migrate.ts).
// Sortie : une ligne « en attente : <tag> » par migration (« arrêt requis » quand c'est le cas),
// puis une dernière ligne « arret-requis=oui » ou « arret-requis=non ».
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { pendingEntries, requiresStop, stopReason, type JournalEntry } from "../src/migration-compatibility";
import { parseAdminEnv } from "./admin-env";

const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;

async function lastAppliedWhen(sql: postgres.Sql): Promise<number | null> {
  const [table] = await sql<{ name: string | null }[]>`select to_regclass('drizzle.__drizzle_migrations')::text as name`;
  if (!table?.name) return null;
  const [last] = await sql<{ created_at: string | null }[]>`select max(created_at)::text as created_at from drizzle.__drizzle_migrations`;
  return last?.created_at ? Number(last.created_at) : null;
}

async function main() {
  const env = parseAdminEnv(process.env);
  const sql = postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database: env.POSTGRES_DB, username: env.POSTGRES_ADMIN_USER, password: env.POSTGRES_ADMIN_PASSWORD, max: 1 });
  try {
    const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8")) as { entries: JournalEntry[] };
    let stop = false;
    for (const entry of pendingEntries(journal.entries, await lastAppliedWhen(sql))) {
      const body = readFileSync(`${migrationsFolder}/${entry.tag}.sql`, "utf8");
      const needsStop = requiresStop(entry, body);
      stop ||= needsStop;
      const reason = stopReason(body);
      console.log(`en attente : ${entry.tag}${needsStop ? ` (arrêt requis${reason ? ` : ${reason}` : ""})` : ""}`);
    }
    console.log(`arret-requis=${stop ? "oui" : "non"}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
