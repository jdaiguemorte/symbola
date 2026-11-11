// Helper de transaction (SOC-05, ADR 0012) : fixe app.organization_id pour
// toute la transaction, via set_config plutôt que SET LOCAL + paramètre
// (SET ne supporte pas les paramètres liés en protocole étendu). Les
// policies RLS lisent ce paramètre (une par table métier, migrations de
// packages/db/drizzle).
//
// Lot 23 (partie B, ADR 0060) : fixe aussi l'auteur (app.actor_kind,
// app.actor_id), lu par le journal d'audit et par core.stamp_row(). Il est
// résolu AVANT d'ouvrir la transaction : le résolveur peut lui-même lire la
// base, et ne doit pas attendre une connexion tenue par cette transaction.
import { sql } from "drizzle-orm";
import { currentActor, isAuditBulk, type Actor } from "./actor";
import type { AppDatabase } from "./client";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export async function setActorInTransaction(tx: Transaction, actor: Actor, bulk = false): Promise<void> {
  await tx.execute(
    sql`select set_config('app.actor_kind', ${actor.kind}, true), set_config('app.actor_id', ${actor.id ?? ""}, true), set_config('app.audit_bulk', ${bulk ? "on" : ""}, true)`,
  );
}

export async function withOrganization<T>(
  db: AppDatabase,
  organizationId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const actor = await currentActor();
  const bulk = isAuditBulk();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
    await setActorInTransaction(tx, actor, bulk);
    return fn(tx);
  });
}

// Écritures hors organisation (comptes, sessions, réglages du hub sans RLS) :
// même auteur, sans contexte d'organisation.
export async function withActorContext<T>(db: AppDatabase, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const actor = await currentActor();
  const bulk = isAuditBulk();
  return db.transaction(async (tx) => {
    await setActorInTransaction(tx, actor, bulk);
    return fn(tx);
  });
}
