// Connexion applicative (SOC-05) : toujours le rôle symbola_app, jamais le
// rôle admin. Ce rôle n'est propriétaire d'aucune table et n'a pas
// BYPASSRLS (vérifié par packages/db/src/roles.integration.test.ts).
//
// Lot 16 (L16-ARC-01, ADR 0043) : l'app partage une seule réserve de connexions
// par processus (`appDatabase()`). Le partage est sûr : le contexte RLS
// (`app.organization_id`) est fixé par `set_config(…, true)`, donc limité à
// la transaction de `withOrganization`, jamais laissé sur la connexion.
// `createAppConnection()` reste pour les scripts et les tests, qui ouvrent
// leur propre connexion et la ferment eux-mêmes.
import { parseEnv } from "@symbola/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Taille de la réserve partagée : la valeur par défaut de postgres.js. Avec
// la production et le staging sur le même serveur, deux processus, on reste
// loin de `max_connections` (100).
const SHARED_POOL_MAX = 10;
// Une connexion inutilisée est rendue au serveur après 30 secondes.
const SHARED_IDLE_TIMEOUT_SECONDS = 30;

function openConnection(options: { max?: number; idleTimeoutSeconds?: number } = {}) {
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
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.idleTimeoutSeconds !== undefined ? { idle_timeout: options.idleTimeoutSeconds } : {}),
  });

  return { sql, db: drizzle(sql) };
}

// Pour les scripts et les tests : une connexion à soi, à fermer avec
// `sql.end()`.
export function createAppConnection() {
  return openConnection();
}

export type AppDatabase = ReturnType<typeof createAppConnection>["db"];

// Rangée sur globalThis plutôt que dans une variable du module : Next.js peut
// charger ce module plusieurs fois dans un même processus (rechargement à
// chaud en développement, paquets serveur distincts en production). Une
// seule réserve doit en résulter.
const SHARED_KEY = Symbol.for("symbola.db.sharedAppConnection");
type SharedConnection = ReturnType<typeof openConnection>;
type GlobalWithConnection = typeof globalThis & { [SHARED_KEY]?: SharedConnection };

// Pour le code de l'app (pages, actions, routes, modules, traitements de
// fond) : la réserve partagée du processus. Ne jamais la fermer en cours de
// route ; chaque requête emprunte une connexion le temps d'une transaction.
export function appDatabase(): AppDatabase {
  const store = globalThis as GlobalWithConnection;
  store[SHARED_KEY] ??= openConnection({ max: SHARED_POOL_MAX, idleTimeoutSeconds: SHARED_IDLE_TIMEOUT_SECONDS });
  return store[SHARED_KEY].db;
}

// Ferme la réserve partagée : fin d'un fichier de tests, ou arrêt du
// processus. Un appel suivant à `appDatabase()` en rouvre une.
export async function closeAppDatabase(): Promise<void> {
  const store = globalThis as GlobalWithConnection;
  const shared = store[SHARED_KEY];
  if (!shared) return;
  delete store[SHARED_KEY];
  await shared.sql.end();
}
