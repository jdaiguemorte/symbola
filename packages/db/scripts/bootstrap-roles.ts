// Crée (ou met à jour le mot de passe de) le rôle applicatif symbola_app
// (SOC-05). Jamais dans une migration versionnée : le mot de passe ne doit
// jamais être committé. Idempotent — peut être rejoué sans risque.
// Exécuté avec le rôle admin, avant `pnpm --filter @symbola/db migrate`.
import postgres from "postgres";
import { parseAdminEnv } from "./admin-env";
import { quoteIdentifier, quoteLiteral } from "./sql-quoting";

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

  const role = quoteIdentifier(env.POSTGRES_APP_USER);
  const password = quoteLiteral(env.POSTGRES_APP_PASSWORD);

  try {
    const [{ exists }] = await sql<[{ exists: boolean }]>`
      select exists(select 1 from pg_roles where rolname = ${env.POSTGRES_APP_USER}) as exists
    `;

    if (exists) {
      await sql.unsafe(
        `ALTER ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      console.log(`Rôle ${env.POSTGRES_APP_USER} déjà existant : mot de passe mis à jour.`);
    } else {
      await sql.unsafe(
        `CREATE ROLE ${role} LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      console.log(`Rôle ${env.POSTGRES_APP_USER} créé.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
