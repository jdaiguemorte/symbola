// DEV-02, ADR 0026 — base et rôle dédiés à Documenso sur le serveur
// PostgreSQL de l'environnement : jamais un schéma Symbola, aucun droit du
// rôle applicatif symbola_app. Le corps est commun aux services hébergés
// (dedicated-database.ts, lot 33) ; Documenso n'a pas besoin de CREATEROLE.
import type postgres from "postgres";
import { ensureDedicatedDatabase } from "./dedicated-database";

export async function ensureDocumensoDatabase(
  sql: postgres.Sql,
  input: { role: string; password: string; database: string; appRole: string },
): Promise<void> {
  await ensureDedicatedDatabase(sql, { ...input, createRole: false });
}
