// RGPD-05 — purges mensuelles (lot 6, ADR 0024) : preuves des demandes closes
// arrivées à leur terme
// (RGPD-09, ADR 0048) et trace des purges validées par la titulaire : lignes
// purgées ou exclues avec motif, sort des fiches, accusés des modules.
import { and, desc, eq, ne } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyPurges, privacyRequests, type PrivacyErasureAck, type PrivacyErasureItem, type PrivacyPurgeLine } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, isExpired, parisDate, requestProofDueOn } from "@symbola/privacy";

export type { PrivacyPurgeLine };

export class PrivacyPurgeNotFoundError extends Error {}
export class PrivacyPurgeInvalidError extends Error {
  constructor(readonly code: "empty" | "reason_missing") {
    super(code);
  }
}

const REASON_MAX = 2000;

// RGPD-09 — demandes closes dont la preuve (nom de la personne) a dépassé la
// durée réglée après la clôture (jour de Paris). Celles déjà anonymisées ne
// reviennent jamais.
export async function listExpiredPrivacyRequests(
  db: AppDatabase,
  input: { organizationId: string; months: { requestProofRetentionMonths: number }; today: string },
): Promise<{ id: string; personLabel: string; dueOn: string }[]> {
  const rows = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .select({ id: privacyRequests.id, personLabel: privacyRequests.personLabel, closedAt: privacyRequests.closedAt, updatedAt: privacyRequests.updatedAt })
      .from(privacyRequests)
      .where(and(eq(privacyRequests.status, "closed"), ne(privacyRequests.personLabel, ANONYMIZED))),
  );
  const expired: { id: string; personLabel: string; dueOn: string }[] = [];
  for (const row of rows) {
    // Toute clôture date la demande ; à défaut, sa dernière modification.
    const dueOn = requestProofDueOn({ closedOn: parisDate(row.closedAt ?? row.updatedAt) }, input.months);
    if (dueOn && isExpired(input.today, dueOn)) expired.push({ id: row.id, personLabel: row.personLabel, dueOn });
  }
  return expired;
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
