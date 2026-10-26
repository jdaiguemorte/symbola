// Applique les migrations (packages/db/drizzle) avec le rôle admin — ces
// DDL créent les schémas/tables et accordent les droits au rôle applicatif
// (SOC-05). Le rôle admin n'est jamais utilisé par l'app qui tourne.
// Prérequis : le rôle symbola_app doit déjà exister, voir bootstrap-roles.ts.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { parseAdminEnv } from "./admin-env";

async function main() {
  const env = parseAdminEnv(process.env);

  const sql = postgres({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    username: env.POSTGRES_ADMIN_USER,
    password: env.POSTGRES_ADMIN_PASSWORD,
    max: 1,
  });

  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
    console.log("Migrations appliquées.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
