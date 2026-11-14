// Crée (ou met à jour le mot de passe de) le rôle applicatif symbola_app
// (SOC-05), et la base dédiée de Documenso si DOCUMENSO_DB_PASSWORD est
// fourni (DEV-02, ADR 0026), et celle du fournisseur d'identité si LOGTO_DB_PASSWORD l'est (lot 33,
// ADR 0067). Jamais dans une migration versionnée : le mot de passe ne doit
// jamais être committé. Idempotent — peut être rejoué sans risque.
// Exécuté avec le rôle admin, avant `pnpm --filter @symbola/db migrate`.
import postgres from "postgres";
import { parseAdminEnv } from "./admin-env";
import { ensureDedicatedDatabase } from "./dedicated-database";
import { ensureDocumensoDatabase } from "./documenso-database";
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

    if (env.DOCUMENSO_DB_PASSWORD) {
      await ensureDocumensoDatabase(sql, {
        role: env.DOCUMENSO_DB_USER,
        password: env.DOCUMENSO_DB_PASSWORD,
        database: env.DOCUMENSO_DB_NAME,
        appRole: env.POSTGRES_APP_USER,
      });
      console.log(`Base ${env.DOCUMENSO_DB_NAME} et rôle ${env.DOCUMENSO_DB_USER} de Documenso prêts.`);
    }

    // Lot 33, ADR 0067 : base du fournisseur d'identité ; Logto y crée ses propres rôles.
    if (env.LOGTO_DB_PASSWORD) {
      await ensureDedicatedDatabase(sql, {
        role: env.LOGTO_DB_USER,
        password: env.LOGTO_DB_PASSWORD,
        database: env.LOGTO_DB_NAME,
        appRole: env.POSTGRES_APP_USER,
        createRole: true,
      });
      console.log(`Base ${env.LOGTO_DB_NAME} et rôle ${env.LOGTO_DB_USER} du fournisseur d'identité prêts.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
