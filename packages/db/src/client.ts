// Connexion applicative (SOC-05) : toujours le rôle symbola_app, jamais le
// rôle admin. Ce rôle n'est propriétaire d'aucune table et n'a pas
// BYPASSRLS (vérifié par packages/db/src/roles.integration.test.ts).
import { parseEnv } from "@symbola/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function createAppConnection() {
  // Validation différée à l'appel (pas à l'import) : importer ce module ne
  // doit pas exiger les variables d'environnement, seulement s'en servir
  // au moment d'ouvrir une vraie connexion. Sinon, tout code qui importe
  // ne serait-ce que le type AppDatabase (tests unitaires compris) se
  // retrouve à exiger un .env complet sans jamais se connecter.
  const env = parseEnv(process.env);
  const sql = postgres({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    username: env.POSTGRES_APP_USER,
    password: env.POSTGRES_APP_PASSWORD,
  });

  return { sql, db: drizzle(sql) };
}

export type AppDatabase = ReturnType<typeof createAppConnection>["db"];
