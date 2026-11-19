// Lot 52 (HUB-04 ; D1 ; ADR 0094) — transfert de propriété. La Propriétaire désigne une Planner active de
// l'organisation qui a déjà la double authentification ; la Planner confirme par le lien de l'e-mail
// (usage unique, sept jours), connectée avec sa double authentification ; les rôles s'échangent
// (l'ancienne Propriétaire devient Planner) ; le journal d'audit garde la demande et la confirmation.
// Une seule demande en cours par organisation : une nouvelle demande remplace la précédente.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, ownershipTransfers, users } from "@symbola/db/schema/hub";

export const OWNERSHIP_TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function activeRole(db: AppDatabase | Tx, organizationId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId), isNull(memberships.disabledAt)));
  return row?.role ?? null;
}

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type RequestOwnershipTransferOutcome =
  | { outcome: "requested"; token: string; expiresAt: Date; toEmail: string }
  | { outcome: "not_owner" | "not_planner" | "mfa_missing" };

// toHasMfa : la Planner a au moins un second facteur chez le fournisseur d'identité (lu par l'app).
export async function requestOwnershipTransfer(
  db: AppDatabase,
  input: { organizationId: string; fromUserId: string; toUserId: string; toHasMfa: boolean; now?: Date },
): Promise<RequestOwnershipTransferOutcome> {
  const now = input.now ?? new Date();
  if ((await activeRole(db, input.organizationId, input.fromUserId)) !== "owner") return { outcome: "not_owner" };
  if (input.toUserId === input.fromUserId || (await activeRole(db, input.organizationId, input.toUserId)) !== "member") return { outcome: "not_planner" };
  if (!input.toHasMfa) return { outcome: "mfa_missing" };
  const [recipient] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.toUserId));
  if (!recipient) return { outcome: "not_planner" };
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + OWNERSHIP_TRANSFER_TTL_MS);
  await db.transaction(async (tx) => {
    await tx
      .update(ownershipTransfers)
      .set({ cancelledAt: now })
      .where(and(eq(ownershipTransfers.organizationId, input.organizationId), isNull(ownershipTransfers.confirmedAt), isNull(ownershipTransfers.cancelledAt)));
    await tx.insert(ownershipTransfers).values({
      organizationId: input.organizationId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      tokenHash: hashToken(token),
      requestedAt: now,
      expiresAt,
    });
  });
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.ownership.transfer_requested", objectId: input.toUserId, actor: { kind: "member", id: input.fromUserId } });
  return { outcome: "requested", token, expiresAt, toEmail: recipient.email };
}

export type PendingOwnershipTransfer = { toUserId: string; expiresAt: Date };

export async function findPendingOwnershipTransfer(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<PendingOwnershipTransfer | null> {
  const [row] = await db
    .select({ toUserId: ownershipTransfers.toUserId, expiresAt: ownershipTransfers.expiresAt })
    .from(ownershipTransfers)
    .where(and(eq(ownershipTransfers.organizationId, organizationId), isNull(ownershipTransfers.confirmedAt), isNull(ownershipTransfers.cancelledAt), gt(ownershipTransfers.expiresAt, now)));
  return row ?? null;
}

export async function cancelOwnershipTransfer(db: AppDatabase, input: { organizationId: string; byUserId: string; now?: Date }): Promise<boolean> {
  if ((await activeRole(db, input.organizationId, input.byUserId)) !== "owner") return false;
  const cancelled = await db
    .update(ownershipTransfers)
    .set({ cancelledAt: input.now ?? new Date() })
    .where(and(eq(ownershipTransfers.organizationId, input.organizationId), isNull(ownershipTransfers.confirmedAt), isNull(ownershipTransfers.cancelledAt)))
    .returning({ toUserId: ownershipTransfers.toUserId });
  if (cancelled[0]) await recordAudit(db, { organizationId: input.organizationId, action: "hub.ownership.transfer_cancelled", objectId: cancelled[0].toUserId, actor: { kind: "member", id: input.byUserId } });
  return cancelled.length > 0;
}

export type OwnershipTransferInfo = { organizationId: string; fromUserId: string; toUserId: string; expiresAt: Date };

// La demande d'un lien encore valable (page de confirmation) ; sinon null, sans dire pourquoi.
export async function describeOwnershipTransfer(db: AppDatabase, token: string, now: Date = new Date()): Promise<OwnershipTransferInfo | null> {
  if (!token || token.length > 128) return null;
  const [row] = await db
    .select({ organizationId: ownershipTransfers.organizationId, fromUserId: ownershipTransfers.fromUserId, toUserId: ownershipTransfers.toUserId, expiresAt: ownershipTransfers.expiresAt })
    .from(ownershipTransfers)
    .where(and(eq(ownershipTransfers.tokenHash, hashToken(token)), isNull(ownershipTransfers.confirmedAt), isNull(ownershipTransfers.cancelledAt), gt(ownershipTransfers.expiresAt, now)));
  return row ?? null;
}

export type ConfirmOwnershipTransferOutcome =
  | { outcome: "transferred"; organizationId: string; fromUserId: string; toUserId: string }
  | { outcome: "invalid" | "not_recipient" | "mfa_required" };

// La confirmation, par la Planner désignée seulement, dans une session ouverte avec sa double
// authentification. Si l'une ou l'autre n'a plus son rôle (accès retiré entre-temps), le lien ne vaut plus.
export async function confirmOwnershipTransfer(
  db: AppDatabase,
  input: { token: string; userId: string; mfaVerified: boolean; now?: Date },
): Promise<ConfirmOwnershipTransferOutcome> {
  const now = input.now ?? new Date();
  const result = await db.transaction(async (tx): Promise<ConfirmOwnershipTransferOutcome> => {
    const [transfer] = await tx
      .select()
      .from(ownershipTransfers)
      .where(and(eq(ownershipTransfers.tokenHash, hashToken(input.token)), isNull(ownershipTransfers.confirmedAt), isNull(ownershipTransfers.cancelledAt), gt(ownershipTransfers.expiresAt, now)))
      .for("update");
    if (!transfer) return { outcome: "invalid" };
    if (transfer.toUserId !== input.userId) return { outcome: "not_recipient" };
    if (!input.mfaVerified) return { outcome: "mfa_required" };
    if ((await activeRole(tx, transfer.organizationId, transfer.fromUserId)) !== "owner" || (await activeRole(tx, transfer.organizationId, transfer.toUserId)) !== "member") {
      await tx.update(ownershipTransfers).set({ cancelledAt: now }).where(eq(ownershipTransfers.id, transfer.id));
      return { outcome: "invalid" };
    }
    await tx.update(memberships).set({ role: "member" }).where(and(eq(memberships.organizationId, transfer.organizationId), eq(memberships.userId, transfer.fromUserId)));
    await tx.update(memberships).set({ role: "owner" }).where(and(eq(memberships.organizationId, transfer.organizationId), eq(memberships.userId, transfer.toUserId)));
    await tx.update(ownershipTransfers).set({ confirmedAt: now }).where(eq(ownershipTransfers.id, transfer.id));
    return { outcome: "transferred", organizationId: transfer.organizationId, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId };
  });
  if (result.outcome === "transferred") {
    await recordAudit(db, {
      organizationId: result.organizationId,
      action: "hub.ownership.transferred",
      objectId: result.toUserId,
      details: { previousOwner: result.fromUserId },
      actor: { kind: "member", id: result.toUserId },
    });
  }
  return result;
}
