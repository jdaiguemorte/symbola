// Lot 13 (L13-HUB-17, L13-HUB-18, ADR 0033) — vue d'ensemble de la console
// d'Administration : chiffres agrégés de toutes les organisations, ce qui
// demande une action, tendance sur 6 mois, et la dernière sauvegarde signalée
// par le script de sauvegarde. Jamais un nom d'organisation, un montant ni un
// contenu dans les chiffres (ADR 0029).
import type { AppDatabase } from "@symbola/db/client";
import { getOrganizationsActivity, listOrganizationsSupport } from "./admin-support";
import { findAllOrganizationModules, findLatestBackupRun, findLatestSucceededBackupRun, listAllOrganizations } from "./repository";

// Au-delà, la sauvegarde nocturne a manqué au moins une nuit.
export const BACKUP_STALE_HOURS = 26;

export type BackupRunView = {
  startedAt: Date;
  finishedAt: Date | null;
  status: "running" | "succeeded" | "failed";
  sizeBytes: number | null;
};

// ok : réussie depuis moins de 26 h ; failed : la dernière a échoué ;
// stale : aucune réussite depuis plus de 26 h ; none : aucune signalée.
export type BackupState = "ok" | "failed" | "stale" | "none";

export type BackupStatus = { state: BackupState; latest: BackupRunView | null; lastSucceeded: BackupRunView | null };

export function backupState(latest: BackupRunView | null, lastSucceeded: BackupRunView | null, now: Date): BackupState {
  if (!latest) return "none";
  if (latest.status === "failed") return "failed";
  const finished = lastSucceeded?.finishedAt;
  if (finished && now.getTime() - finished.getTime() <= BACKUP_STALE_HOURS * 3_600_000) return "ok";
  return "stale";
}

export async function getBackupStatus(db: AppDatabase, now: Date = new Date()): Promise<BackupStatus> {
  const [latest, lastSucceeded] = await Promise.all([findLatestBackupRun(db), findLatestSucceededBackupRun(db)]);
  const view = (row: typeof latest): BackupRunView | null =>
    row ? { startedAt: row.startedAt, finishedAt: row.finishedAt, status: row.status, sizeBytes: row.sizeBytes } : null;
  return { state: backupState(view(latest), view(lastSucceeded), now), latest: view(latest), lastSucceeded: view(lastSucceeded) };
}

export type AdminOverview = {
  organizations: number;
  // Organisations dont au moins un compte s'est connecté sur 30 jours.
  activeOrganizations: number;
  teamAccounts: number;
  activeAccounts: number;
  eventsThisMonth: number;
  // Événements créés par mois, toutes organisations, du plus ancien au plus récent.
  trend: { month: string; count: number }[];
  expiredInvitations: number;
  backup: BackupStatus;
};

export async function getAdminOverview(db: AppDatabase, now: Date = new Date()): Promise<AdminOverview> {
  const [activity, support, backup] = await Promise.all([
    getOrganizationsActivity(db, { now }),
    listOrganizationsSupport(db, now),
    getBackupStatus(db, now),
  ]);
  const months = activity[0]?.months ?? [];
  const trend = months.map((month) => ({
    month,
    count: activity.reduce((sum, organization) => sum + (organization.events.find((row) => row.month === month)?.count ?? 0), 0),
  }));
  return {
    organizations: activity.length,
    activeOrganizations: activity.filter((organization) => organization.activeAccounts > 0).length,
    teamAccounts: activity.reduce((sum, organization) => sum + organization.teamAccounts, 0),
    activeAccounts: activity.reduce((sum, organization) => sum + organization.activeAccounts, 0),
    eventsThisMonth: trend.at(-1)?.count ?? 0,
    trend,
    expiredInvitations: support.reduce((sum, organization) => sum + organization.pendingInvitations.filter((invitation) => invitation.expired).length, 0),
    backup,
  };
}

// Lot 13 (L13-HUB-17) — modules souscrits de chaque organisation, pour le tableau
// des organisations (absence de ligne = activé, comme isModuleEnabled).
export async function listOrganizationModuleStates(
  db: AppDatabase,
  moduleKeys: readonly string[],
): Promise<Record<string, Record<string, boolean>>> {
  const [organizationRows, moduleRows] = await Promise.all([listAllOrganizations(db), findAllOrganizationModules(db)]);
  return Object.fromEntries(
    organizationRows.map((organization) => [
      organization.id,
      Object.fromEntries(
        moduleKeys.map((moduleKey) => [
          moduleKey,
          moduleRows.find((row) => row.organizationId === organization.id && row.moduleKey === moduleKey)?.enabled ?? true,
        ]),
      ),
    ]),
  );
}
