// Accès aux données du module hub — jamais importé hors de modules/hub/
// (ADR 0011). Pas de RLS sur ces tables (packages/db/src/schema/hub.ts) :
// l'isolation est assurée par le code applicatif, pas par PostgreSQL.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import {
  auditLog,
  backupRuns,
  invitations,
  organizationModules,
  organizationProfiles,
  organizations,
  platformSettings,
  helpProgress,
  users,
  vatRegimeChanges,
} from "@symbola/db/schema/hub";
import type { Language } from "./types";

export async function insertOrganization(
  db: AppDatabase,
  input: { name: string; language: Language; siret: string | null },
) {
  const [organization] = await db.insert(organizations).values(input).returning();
  if (!organization) throw new Error("création de l'organisation échouée");
  return organization;
}

export async function insertInvitation(
  db: AppDatabase,
  input: { organizationId: string; email: string; tokenHash: string; expiresAt: Date },
) {
  const [invitation] = await db.insert(invitations).values(input).returning();
  if (!invitation) throw new Error("création de l'invitation échouée");
  return invitation;
}

export async function findInvitationByTokenHash(db: AppDatabase, tokenHash: string) {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash));
  return invitation ?? null;
}

export async function markInvitationAccepted(db: AppDatabase, invitationId: string) {
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitationId));
}

export async function insertAuditLog(
  db: AppDatabase,
  input: { adminUserId: string; action: string; targetOrganizationId: string | null; targetUserId?: string | null },
) {
  await db.insert(auditLog).values(input);
}

export async function findOrganizationById(db: AppDatabase, organizationId: string) {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  return organization ?? null;
}

export async function listAllOrganizations(db: AppDatabase) {
  return db.select().from(organizations);
}

export async function findOrganizationModule(db: AppDatabase, organizationId: string, moduleKey: string) {
  const [row] = await db
    .select()
    .from(organizationModules)
    .where(and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.moduleKey, moduleKey)));
  return row ?? null;
}

export async function upsertOrganizationModule(
  db: AppDatabase,
  input: { organizationId: string; moduleKey: string; enabled: boolean },
) {
  await db
    .insert(organizationModules)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [organizationModules.organizationId, organizationModules.moduleKey],
      set: { enabled: input.enabled, updatedAt: new Date() },
    });
}

export async function findOrganizationProfile(db: AppDatabase, organizationId: string) {
  const [row] = await db.select().from(organizationProfiles).where(eq(organizationProfiles.organizationId, organizationId));
  return row ?? null;
}

export async function upsertOrganizationProfileFields(
  db: AppDatabase,
  organizationId: string,
  fields: Partial<typeof organizationProfiles.$inferInsert>,
) {
  await db
    .insert(organizationProfiles)
    .values({ organizationId, ...fields, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: organizationProfiles.organizationId,
      set: { ...fields, updatedAt: new Date() },
    });
}

export async function insertVatRegimeChange(
  db: AppDatabase,
  input: {
    organizationId: string;
    previousRegime: "franchise" | "assujetti" | null;
    newRegime: "franchise" | "assujetti";
    effectiveDate: string;
    changedByUserId: string;
  },
) {
  await db.insert(vatRegimeChanges).values(input);
}

export async function findPlatformSettings(db: AppDatabase) {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
  return row ?? null;
}

export async function insertDefaultPlatformSettings(db: AppDatabase) {
  await db.insert(platformSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function upsertPlatformSettings(
  db: AppDatabase,
  fields: {
    franchiseThresholdServicesCents: number | null;
    franchiseThresholdGoodsCents: number | null;
    importMaxBytes?: number;
    importMaxRows?: number;
    importDraftRetentionDays?: number;
    importUndoRetentionDays?: number;
    privacyExportRetentionDays?: number;
  },
) {
  await db
    .insert(platformSettings)
    .values({ id: 1, ...fields, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.id, set: { ...fields, updatedAt: new Date() } });
}

// Lot 10 — progression d'un compte dans l'aide (visites focus, tutoriels).
export async function findHelpProgress(db: AppDatabase, userId: string) {
  return db.select().from(helpProgress).where(eq(helpProgress.userId, userId));
}

export async function upsertHelpProgress(
  db: AppDatabase,
  input: {
    userId: string;
    itemKey: string;
    status: "started" | "postponed" | "completed";
    step: number;
    now: Date;
    // Contexte d'un tutoriel : fusionné avec l'existant ; null = effacé.
    context?: Record<string, string> | null;
  },
) {
  const completedAt = input.status === "completed" ? input.now : null;
  await db
    .insert(helpProgress)
    .values({
      userId: input.userId,
      itemKey: input.itemKey,
      status: input.status,
      step: input.step,
      context: input.context ?? null,
      startedAt: input.now,
      updatedAt: input.now,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [helpProgress.userId, helpProgress.itemKey],
      // Un élément terminé le reste : le revoir ne le fait pas repasser « en cours ».
      set: {
        status: sql`case when ${helpProgress.status} = 'completed' then 'completed'::hub.help_progress_status else excluded.status end`,
        // Une visite terminée garde son étape ; un tutoriel revu avance de nouveau.
        step: sql`case when ${helpProgress.status} = 'completed' and ${helpProgress.itemKey} like 'tour:%' then ${helpProgress.step} else excluded.step end`,
        updatedAt: input.now,
        completedAt: sql`coalesce(${helpProgress.completedAt}, excluded.completed_at)`,
        ...(input.context === undefined
          ? {}
          : input.context === null
            ? { context: null }
            : { context: sql`coalesce(${helpProgress.context}, '{}'::jsonb) || excluded.context` }),
      },
    });
}

// AIDE-06 — un tutoriel revu repart de zéro (étape et contexte), même terminé.
export async function resetHelpProgressItem(db: AppDatabase, userId: string, itemKey: string, now: Date) {
  await db
    .update(helpProgress)
    .set({ step: 0, context: null, updatedAt: now })
    .where(and(eq(helpProgress.userId, userId), eq(helpProgress.itemKey, itemKey)));
}

// HUB-11 — progression de tous les comptes d'équipe (vue Admin) : clés
// d'aide, états et dates seulement.
export async function findAllHelpProgress(db: AppDatabase) {
  return db.select().from(helpProgress);
}

export async function updateFirstStepsHidden(db: AppDatabase, userId: string, hidden: boolean) {
  await db.update(users).set({ firstStepsHidden: hidden }).where(eq(users.id, userId));
}

export async function findUserContact(db: AppDatabase, organizationId: string, userId: string) {
  const [row] = await db
    .select({ email: users.email, language: users.language })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)));
  return row ?? null;
}

// Lot 9 (ADR 0029) — invitations de titulaire pas encore acceptées (vue
// d'assistance de l'Admin), la plus récente d'abord.
export async function findPendingInvitations(db: AppDatabase) {
  return db.select().from(invitations).where(isNull(invitations.acceptedAt)).orderBy(desc(invitations.createdAt));
}

export async function findInvitationById(db: AppDatabase, invitationId: string) {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, invitationId));
  return invitation ?? null;
}

// Un nouveau jeton remplace l'ancien : le lien précédent cesse de marcher.
export async function replaceInvitationToken(db: AppDatabase, invitationId: string, input: { tokenHash: string; expiresAt: Date }) {
  await db
    .update(invitations)
    .set(input)
    .where(and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)));
}

// HUB-11 (lot 10) — activation des modules de toutes les organisations, en une
// requête (une ligne seulement pour un module déjà basculé par l'Admin).
export async function findAllOrganizationModules(db: AppDatabase) {
  return db.select().from(organizationModules);
}

// Lot 13 (HUB-18) — dernières exécutions du script de sauvegarde (lecture seule).
export async function findLatestBackupRun(db: AppDatabase) {
  const [row] = await db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(1);
  return row ?? null;
}

export async function findLatestSucceededBackupRun(db: AppDatabase) {
  const [row] = await db
    .select()
    .from(backupRuns)
    .where(eq(backupRuns.status, "succeeded"))
    .orderBy(desc(backupRuns.finishedAt))
    .limit(1);
  return row ?? null;
}
