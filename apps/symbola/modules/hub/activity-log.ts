// Lot 23 (HUB-16, SEC-19, ADR 0060) — journal d'activité de l'organisation,
// lu par la titulaire : qui, quoi, quand, sur quel objet. Lecture du journal
// commun (core.audit_entries) dans le contexte de l'organisation (RLS) : ses
// lignes, plus les accès d'exploitation de la plateforme. Les lignes d'un
// essai guidé n'y figurent pas. L'auteur est nommé d'après les comptes de
// l'organisation ; le journal, lui, ne stocke aucun nom.
import { and, count, desc, eq, gte, isNull, or, type SQL } from "drizzle-orm";
import { AUDIT_CATEGORIES, type AuditActorKind, type AuditCategory, type AuditDetails } from "@symbola/contracts";
import type { AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { users } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";

export const ACTIVITY_PAGE_SIZE = 50;
// Périodes proposées (jours) ; « tout » = aucune limite.
export const ACTIVITY_PERIODS = [7, 30, 90, 365] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityFilters = {
  periodDays: number | null;
  category: AuditCategory | null;
  actorId: string | null;
  page: number;
  now?: Date;
};

export type ActivityEntry = {
  id: string;
  occurredAt: Date;
  actorKind: AuditActorKind;
  actorId: string | null;
  // E-mail du compte, s'il appartient à l'organisation ; nul sinon (compte supprimé).
  actorLabel: string | null;
  action: string;
  category: AuditCategory;
  objectType: string | null;
  objectId: string | null;
  details: AuditDetails;
  reason: string | null;
};

export type ActivityLog = {
  entries: ActivityEntry[];
  page: number;
  pageCount: number;
  total: number;
  people: { id: string; label: string }[];
};

export function parseActivityFilters(params: { periode?: string; famille?: string; personne?: string; page?: string }): ActivityFilters {
  const period = params.periode === "tout" ? null : Number.parseInt(params.periode ?? "30", 10);
  const page = Number.parseInt(params.page ?? "1", 10);
  return {
    periodDays: period === null ? null : (ACTIVITY_PERIODS as readonly number[]).includes(period) ? period : 30,
    category: (AUDIT_CATEGORIES as readonly string[]).includes(params.famille ?? "") ? (params.famille as AuditCategory) : null,
    actorId: /^[0-9a-f-]{36}$/i.test(params.personne ?? "") ? params.personne! : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listActivityLog(db: AppDatabase, organizationId: string, filters: ActivityFilters): Promise<ActivityLog> {
  const now = filters.now ?? new Date();
  const conditions: SQL[] = [
    or(eq(auditEntries.organizationId, organizationId), and(isNull(auditEntries.organizationId), eq(auditEntries.category, "exploitation")))!,
    eq(auditEntries.isDemo, false),
  ];
  if (filters.periodDays !== null) conditions.push(gte(auditEntries.occurredAt, new Date(now.getTime() - filters.periodDays * DAY_MS)));
  if (filters.category) conditions.push(eq(auditEntries.category, filters.category));
  if (filters.actorId) conditions.push(eq(auditEntries.actorId, filters.actorId));
  const where = and(...conditions);

  const { rows, total, page } = await withOrganization(db, organizationId, async (tx) => {
    const [counted] = await tx.select({ total: count() }).from(auditEntries).where(where);
    const total = counted?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
    const page = Math.min(filters.page, pageCount);
    const rows = await tx
      .select()
      .from(auditEntries)
      .where(where)
      .orderBy(desc(auditEntries.occurredAt))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE);
    return { rows, total, page };
  });

  const members = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.organizationId, organizationId));
  const labels = new Map(members.map((member) => [member.id, member.email]));
  return {
    entries: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      actorKind: row.actorKind,
      actorId: row.actorId,
      actorLabel: row.actorId ? (labels.get(row.actorId) ?? null) : null,
      action: row.action,
      category: row.category,
      objectType: row.objectType,
      objectId: row.objectId,
      details: row.details,
      reason: row.reason,
    })),
    page,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
    total,
    people: members.map((member) => ({ id: member.id, label: member.email })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
