// Base et rôle dédiés à un service tiers hébergé sur le serveur PostgreSQL de l'environnement
// (Documenso, DEV-02, ADR 0026 ; Logto, lot 33, ADR 0067) : jamais un schéma Symbola, aucun
// droit du rôle applicatif symbola_app. Idempotent, exécuté par le bootstrap avec le rôle admin
// (CREATE DATABASE ne peut pas s'exécuter en transaction).
//
// createRole : Logto crée à son initialisation ses propres rôles (logto_tenant_*), sans
// privilège. Depuis PostgreSQL 16, CREATEROLE ne permet de créer ni superutilisateur ni rôle
// BYPASSRLS, et ne donne la main que sur les rôles créés.
import type postgres from "postgres";
import { quoteIdentifier, quoteLiteral } from "./sql-quoting";

export type DedicatedDatabase = { role: string; password: string; database: string; appRole: string; createRole?: boolean };

export async function ensureDedicatedDatabase(sql: postgres.Sql, input: DedicatedDatabase): Promise<void> {
  const role = quoteIdentifier(input.role);
  const database = quoteIdentifier(input.database);
  const password = quoteLiteral(input.password);
  const createRole = input.createRole ? "CREATEROLE" : "NOCREATEROLE";

  const [{ exists: roleExists }] = await sql<[{ exists: boolean }]>`
    select exists(select 1 from pg_roles where rolname = ${input.role}) as exists
  `;
  await sql.unsafe(
    `${roleExists ? "ALTER" : "CREATE"} ROLE ${role} ${roleExists ? "WITH " : ""}LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB ${createRole} NOBYPASSRLS`,
  );

  const [{ exists: databaseExists }] = await sql<[{ exists: boolean }]>`
    select exists(select 1 from pg_database where datname = ${input.database}) as exists
  `;
  if (!databaseExists) await sql.unsafe(`CREATE DATABASE ${database} OWNER ${role}`);

  // Personne d'autre que le service (et l'admin) ne s'y connecte.
  await sql.unsafe(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
  await sql.unsafe(`REVOKE ALL ON DATABASE ${database} FROM ${quoteIdentifier(input.appRole)}`);
}
