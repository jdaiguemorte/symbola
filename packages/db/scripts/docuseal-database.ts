// DEV-02, ADR 0021 — base et rôle dédiés à DocuSeal sur le serveur
// PostgreSQL de l'environnement : jamais un schéma Symbola, aucun droit du
// rôle applicatif symbola_app. Idempotent, exécuté par le bootstrap avec
// le rôle admin (CREATE DATABASE ne peut pas s'exécuter en transaction).
import type postgres from "postgres";
import { quoteIdentifier, quoteLiteral } from "./sql-quoting";

export async function ensureDocusealDatabase(
  sql: postgres.Sql,
  input: { role: string; password: string; database: string; appRole: string },
): Promise<void> {
  const role = quoteIdentifier(input.role);
  const database = quoteIdentifier(input.database);
  const password = quoteLiteral(input.password);

  const [{ exists: roleExists }] = await sql<[{ exists: boolean }]>`
    select exists(select 1 from pg_roles where rolname = ${input.role}) as exists
  `;
  await sql.unsafe(
    `${roleExists ? "ALTER" : "CREATE"} ROLE ${role} ${roleExists ? "WITH " : ""}LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
  );

  const [{ exists: databaseExists }] = await sql<[{ exists: boolean }]>`
    select exists(select 1 from pg_database where datname = ${input.database}) as exists
  `;
  if (!databaseExists) await sql.unsafe(`CREATE DATABASE ${database} OWNER ${role}`);

  // Personne d'autre que DocuSeal (et l'admin) ne s'y connecte.
  await sql.unsafe(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
  await sql.unsafe(`REVOKE ALL ON DATABASE ${database} FROM ${quoteIdentifier(input.appRole)}`);
}
