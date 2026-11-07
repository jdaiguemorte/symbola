// Lot 15 (DB-01, ADR 0036) — annulation de la dernière migration appliquée,
// par son script `drizzle-rollback/<tag>.sql`, avec le rôle admin. Réservé à
// l'opérateur (Julien), jamais lancé par l'app. Garde-fous :
// - seule la DERNIÈRE migration appliquée s'annule (les suivantes d'abord) ;
// - le script et le retrait de la migration du journal de Drizzle se font dans
//   la même transaction : tout ou rien ;
// - un script refuse de lui-même quand des données dépendent de ce qu'il retire.
import { readFileSync, existsSync } from "node:fs";
import type postgres from "postgres";

type Journal = { entries: { idx: number; tag: string; when: number }[] };

export class RollbackRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollbackRefusedError";
  }
}

export function readJournal(migrationsFolder: string): Journal {
  return JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8")) as Journal;
}

export async function rollbackMigration(sql: postgres.Sql, tag: string, folders: { migrations: string; rollbacks: string }): Promise<void> {
  const entry = readJournal(folders.migrations).entries.find((candidate) => candidate.tag === tag);
  if (!entry) throw new RollbackRefusedError(`Migration inconnue : ${tag}.`);
  const script = `${folders.rollbacks}/${tag}.sql`;
  if (!existsSync(script)) throw new RollbackRefusedError(`Aucun script d'annulation pour ${tag}.`);
  const [last] = await sql<{ created_at: string }[]>`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`;
  if (!last || Number(last.created_at) !== entry.when) {
    throw new RollbackRefusedError(`${tag} n'est pas la dernière migration appliquée : annulez d'abord les plus récentes.`);
  }
  const body = readFileSync(script, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`delete from drizzle.__drizzle_migrations where created_at = ${entry.when}`;
  });
}
