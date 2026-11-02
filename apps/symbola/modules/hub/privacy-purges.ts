// RGPD-05 — purges mensuelles (lot 6, ADR 0024) : comptes de mariés inactifs
// (table d'identité du hub) et trace des purges validées par la titulaire :
// lignes purgées ou exclues avec motif, sort des fiches, accusés des modules.
import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyPurges, users, type PrivacyErasureAck, type PrivacyErasureItem, type PrivacyPurgeLine } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { inactiveAccountDueOn, isExpired, parisDate, type RetentionMonths } from "@symbola/privacy";

export type { PrivacyPurgeLine };

export class PrivacyPurgeNotFoundError extends Error {}
export class PrivacyPurgeInvalidError extends Error {
  constructor(readonly code: "empty" | "reason_missing") {
    super(code);
  }
}

const REASON_MAX = 2000;

// Comptes d'accès des mariés sans connexion depuis la durée réglée.
export async function listInactiveClientAccounts(
  db: AppDatabase,
  input: { organizationId: string; months: RetentionMonths; today: string },
): Promise<{ id: string; email: string; dueOn: string }[]> {
  // Table d'identité sans RLS : filtrée par organisation et rôle ici (ADR 0013).
  const accounts = await db
    .select({ id: users.id, email: users.email, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.organizationId, input.organizationId), eq(users.role, "client")));
  return accounts
    .map((account) => ({
      id: account.id,
      email: account.email,
      dueOn: inactiveAccountDueOn({ lastLoginOn: account.lastLoginAt ? parisDate(account.lastLoginAt) : null, createdOn: parisDate(account.createdAt) }, input.months),
    }))
    .filter((account) => isExpired(input.today, account.dueOn));
}

export type PrivacyPurgeView = {
  id: string;
  period: string;
  status: "pending" | "partial" | "completed";
  lines: PrivacyPurgeLine[];
  items: PrivacyErasureItem[];
  acks: PrivacyErasureAck[];
  createdAt: Date;
  completedAt: Date | null;
};

function toView(row: typeof privacyPurges.$inferSelect): PrivacyPurgeView {
  return {
    id: row.id,
    period: row.period,
    status: row.status,
    lines: row.lines,
    items: row.items,
    acks: row.acks,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

// Validation de la liste : chaque ligne purgée ou exclue avec un motif
// obligatoire. Rien n'est purgé sans cette trace.
export async function startPrivacyPurge(
  db: AppDatabase,
  input: { organizationId: string; userId: string; period: string; lines: PrivacyPurgeLine[]; items: PrivacyErasureItem[]; now?: Date },
): Promise<string> {
  if (input.lines.length === 0) throw new PrivacyPurgeInvalidError("empty");
  const lines = input.lines.map((line) => ({ ...line, exclusionReason: line.exclusionReason?.trim().slice(0, REASON_MAX) || null }));
  if (lines.some((line) => line.outcome === "excluded" && !line.exclusionReason)) throw new PrivacyPurgeInvalidError("reason_missing");
  const [row] = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .insert(privacyPurges)
      .values({
        organizationId: input.organizationId,
        period: input.period,
        lines,
        items: input.items,
        // Sans fiche à purger (tout exclu), la purge est terminée d'emblée.
        status: input.items.length === 0 ? "completed" : "pending",
        completedAt: input.items.length === 0 ? (input.now ?? new Date()) : null,
        createdByUserId: input.userId,
        ...(input.now ? { createdAt: input.now } : {}),
      })
      .returning({ id: privacyPurges.id }),
  );
  if (!row) throw new Error("création de la purge échouée");
  return row.id;
}

export async function recordPrivacyPurgeAcks(
  db: AppDatabase,
  input: { organizationId: string; purgeId: string; acks: PrivacyErasureAck[]; now?: Date },
): Promise<PrivacyPurgeView["status"]> {
  const now = input.now ?? new Date();
  return withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx.select().from(privacyPurges).where(eq(privacyPurges.id, input.purgeId));
    if (!row) throw new PrivacyPurgeNotFoundError();
    if (row.status === "completed") return "completed";
    const byModule = new Map(row.acks.map((ack) => [ack.module, ack]));
    for (const ack of input.acks) byModule.set(ack.module, ack);
    const done = [...new Set(row.items.map((item) => item.module))].every((module) => byModule.get(module)?.status === "ok");
    const status = done ? "completed" : "partial";
    await tx
      .update(privacyPurges)
      .set({ acks: [...byModule.values()], status, completedAt: done ? now : null })
      .where(eq(privacyPurges.id, row.id));
    return status;
  });
}

export async function getPrivacyPurge(db: AppDatabase, organizationId: string, purgeId: string): Promise<PrivacyPurgeView> {
  const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(privacyPurges).where(eq(privacyPurges.id, purgeId)));
  if (!row) throw new PrivacyPurgeNotFoundError();
  return toView(row);
}

export async function listPrivacyPurges(db: AppDatabase, organizationId: string): Promise<PrivacyPurgeView[]> {
  const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(privacyPurges).orderBy(desc(privacyPurges.createdAt)));
  return rows.map(toView);
}
