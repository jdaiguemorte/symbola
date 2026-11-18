// Lot 52 (SEC-08 ; D6 ; ADR 0094) — changements d'identité annoncés par le webhook signé du fournisseur :
// adresse e-mail, facteur d'authentification, mot de passe. Pour un changement d'adresse, Symbola garde
// l'ancienne jusqu'à l'envoi de l'alerte, qui part vers elle (critère) ; l'adresse du compte devient la
// nouvelle. Un facteur est reconnu à l'empreinte de la liste des facteurs (la première lecture la
// retient sans alerte). Réception idempotente : le même appel rejoué ne crée pas une seconde alerte.
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { identityChangeAlerts, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";

export type IdentityChangeKind = "email" | "mfa" | "password";
export type IdentityAlert = { alertId: string; userId: string; kind: IdentityChangeKind; to: string };

export type IdentityChangeInput =
  | { deliveryKey: string; subject: string; kind: "data_updated"; primaryEmail: string | null; factorsFingerprint: string | null }
  | { deliveryKey: string; subject: string; kind: "password_reset" };

export async function recordIdentityChange(db: AppDatabase, input: IdentityChangeInput, now: Date = new Date()): Promise<IdentityAlert[]> {
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, email: users.email, operator: users.operator, fingerprint: users.mfaFactorsFingerprint })
      .from(users)
      .where(eq(users.idpSubject, input.subject))
      .for("update");
    if (!user) return [];
    const wanted: { kind: IdentityChangeKind; previousEmail: string }[] = [];
    if (input.kind === "password_reset") {
      wanted.push({ kind: "password", previousEmail: user.email });
    } else {
      const next = input.primaryEmail?.toLowerCase() ?? null;
      if (next && next !== user.email) {
        wanted.push({ kind: "email", previousEmail: user.email });
        // L'adresse change chez Symbola, sauf si un autre compte la porte déjà (le compte garde alors la
        // sienne ; l'alerte part quand même).
        const [taken] = await tx.select({ id: users.id }).from(users).where(and(eq(users.email, next), ne(users.id, user.id)));
        if (!taken) await tx.update(users).set({ email: next }).where(eq(users.id, user.id));
      }
      if (input.factorsFingerprint && input.factorsFingerprint !== user.fingerprint) {
        if (user.fingerprint) wanted.push({ kind: "mfa", previousEmail: user.email });
        await tx.update(users).set({ mfaFactorsFingerprint: input.factorsFingerprint }).where(eq(users.id, user.id));
      }
    }
    const alerts: IdentityAlert[] = [];
    for (const change of wanted) {
      const [row] = await tx
        .insert(identityChangeAlerts)
        .values({ userId: user.id, kind: change.kind, deliveryKey: `${input.deliveryKey}:${change.kind}`, previousEmail: change.previousEmail, receivedAt: now })
        .onConflictDoNothing({ target: identityChangeAlerts.deliveryKey })
        .returning({ id: identityChangeAlerts.id });
      if (row) alerts.push({ alertId: row.id, userId: user.id, kind: change.kind, to: change.previousEmail });
    }
    return alerts.map((alert) => ({ ...alert, operator: user.operator }));
  });
  for (const alert of created) {
    await journalConnection(db, { id: alert.userId, organizationId: null, role: alert.operator ? "admin" : "member" }, "hub.identity.changed", { details: { kind: alert.kind } });
  }
  return created.map(({ operator: _operator, ...alert }) => alert);
}

// Après l'envoi : l'ancienne adresse n'est plus gardée.
export async function markIdentityAlertSent(db: AppDatabase, alertId: string, now: Date = new Date()): Promise<void> {
  await db.update(identityChangeAlerts).set({ sentAt: now, previousEmail: null }).where(eq(identityChangeAlerts.id, alertId));
}

// Alertes reçues mais pas encore envoyées (un envoi interrompu se reprend).
export async function listUnsentIdentityAlerts(db: AppDatabase): Promise<IdentityAlert[]> {
  const rows = await db.select().from(identityChangeAlerts).where(isNull(identityChangeAlerts.sentAt));
  return rows.filter((row) => row.previousEmail).map((row) => ({ alertId: row.id, userId: row.userId, kind: row.kind, to: row.previousEmail! }));
}

// DPO (lot 52) : une alerte se garde 30 jours ; une ancienne adresse jamais envoyée aussi.
export const IDENTITY_ALERT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeIdentityAlerts(db: AppDatabase, now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(identityChangeAlerts)
    .where(lt(identityChangeAlerts.receivedAt, new Date(now.getTime() - IDENTITY_ALERT_RETENTION_MS)))
    .returning({ id: identityChangeAlerts.id });
  return deleted.length;
}
