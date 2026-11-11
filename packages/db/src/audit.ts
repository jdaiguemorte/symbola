// Lot 23 (SEC-19, ARC-16, ADR 0060) — écriture au journal d'audit commun.
//
// - appendAudit(tx, …) : dans la transaction du geste (motif outbox). Si le
//   geste échoue, la ligne disparaît avec lui ; si la ligne échoue, le geste
//   est annulé.
// - recordAudit(db, …) : geste hors transaction métier (console Admin,
//   connexion) ; ouvre sa propre transaction, avec le contexte de
//   l'organisation visée pour passer la RLS.
//
// L'auteur vient du contexte (actor.ts), sauf s'il est passé explicitement.
// La famille et le type d'objet viennent du catalogue (@symbola/contracts).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AUDIT_ACTIONS, type AuditAction, type AuditDetails } from "@symbola/contracts";
import { currentActor, type Actor } from "./actor";
import type { AppDatabase } from "./client";
import { auditEntries } from "./schema/core";
import { setActorInTransaction, withOrganization } from "./with-organization";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type AuditEntryInput = {
  organizationId: string | null;
  action: AuditAction;
  objectId?: string | null;
  // Par défaut, celui du catalogue.
  objectType?: string | null;
  details?: AuditDetails;
  reason?: string | null;
  isDemo?: boolean;
  // Par défaut, l'auteur du contexte (app.actor_kind, app.actor_id).
  actor?: Actor;
};

function toRow(id: string, entry: AuditEntryInput) {
  const spec = AUDIT_ACTIONS[entry.action];
  return {
    id,
    organizationId: entry.organizationId,
    action: entry.action,
    category: spec.category,
    objectType: entry.objectType === undefined ? spec.objectType : entry.objectType,
    objectId: entry.objectId ?? null,
    details: entry.details ?? {},
    reason: entry.reason ?? null,
    isDemo: entry.isDemo ?? false,
    ...(entry.actor ? { actorKind: entry.actor.kind, actorId: entry.actor.id } : {}),
  };
}

// Renvoie l'identifiant de la ligne, choisi ici : un RETURNING passerait par la
// politique de lecture, qui cache les lignes de plateforme (connexion de
// l'Admin) même à qui vient de les écrire.
export async function appendAudit(tx: Transaction, entry: AuditEntryInput): Promise<string> {
  const id = randomUUID();
  await tx.insert(auditEntries).values(toRow(id, entry));
  return id;
}

// Fin ou purge d'un essai guidé : ses lignes de journal (is_demo) partent avec
// lui, comme ses factures fictives. Les seules que le déclencheur laisse effacer.
export async function deleteDemoAuditEntries(db: AppDatabase, organizationId: string): Promise<void> {
  await withOrganization(db, organizationId, (tx) => tx.delete(auditEntries).where(eq(auditEntries.isDemo, true)));
}

export async function recordAudit(db: AppDatabase, entry: AuditEntryInput): Promise<string> {
  if (entry.organizationId) {
    const organizationId = entry.organizationId;
    return withOrganization(db, organizationId, (tx) => appendAudit(tx, entry));
  }
  const actor = entry.actor ?? (await currentActor());
  return db.transaction(async (tx) => {
    await setActorInTransaction(tx, actor);
    return appendAudit(tx, entry);
  });
}
