// Lot 23 (SEC-19, décision D5, ADR 0060) — connexions au journal d'audit.
//
// Une ligne par geste (connexion ouverte, échec, verrouillage, déconnexion,
// mot de passe réinitialisé, double authentification configurée, appareils de
// confiance oubliés), dans le journal de l'organisation du compte (ou de la
// plateforme pour l'Admin). L'adresse IP, donnée personnelle, va à part dans
// hub.connection_traces : la titulaire ne la voit pas, l'app ne peut pas la
// relire, elle est purgée après la durée réglée par l'Admin.
import { eq, lt } from "drizzle-orm";
import { recordAudit, type AuditEntryInput } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { connectionTraces, users } from "@symbola/db/schema/hub";
import type { Role } from "./roles";

export type ConnectionAccount = { id: string; organizationId: string | null; role: Role };

type ConnectionAction = Extract<
  AuditEntryInput["action"],
  | "hub.session.opened"
  | "hub.session.failed"
  | "hub.session.closed"
  | "hub.account.locked"
  | "hub.password.reset"
  | "hub.mfa.configured"
  | "hub.trusted_devices.forgotten"
  | "hub.sessions.revoked"
>;

// Un échec ou un verrouillage n'est pas le fait du titulaire du compte (ce
// peut être quelqu'un d'autre) : son auteur est « system ».
const NOT_BY_ACCOUNT: ReadonlySet<ConnectionAction> = new Set(["hub.session.failed", "hub.account.locked"]);

export async function journalConnection(
  db: AppDatabase,
  account: ConnectionAccount,
  action: ConnectionAction,
  extra: { details?: AuditEntryInput["details"]; clientIp?: string | null | undefined } = {},
): Promise<void> {
  const actor = NOT_BY_ACCOUNT.has(action)
    ? ({ kind: "system", id: null } as const)
    : ({ kind: account.role === "admin" ? "admin" : "member", id: account.id } as const);
  const auditEntryId = await recordAudit(db, {
    organizationId: account.organizationId,
    action,
    objectId: account.id,
    ...(extra.details ? { details: extra.details } : {}),
    actor,
  });
  if (extra.clientIp) await db.insert(connectionTraces).values({ auditEntryId, ip: extra.clientIp });
}

export async function connectionAccount(db: AppDatabase, userId: string): Promise<ConnectionAccount | null> {
  const [account] = await db
    .select({ id: users.id, organizationId: users.organizationId, role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  return account ?? null;
}

// Purge des adresses IP plus anciennes que la durée réglée (décision D5).
export async function purgeConnectionTraces(db: AppDatabase, before: Date): Promise<number> {
  const result = await db.delete(connectionTraces).where(lt(connectionTraces.createdAt, before));
  return (result as unknown as { count?: number }).count ?? 0;
}
