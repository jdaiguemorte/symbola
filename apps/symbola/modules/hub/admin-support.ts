// Lot 9 (ADR 0029) — assistance de l'Admin : état des comptes d'équipe et
// des invitations, réinitialisation de la double authentification, nouvel
// envoi d'une invitation, et statistiques d'usage agrégées par organisation.
// Aucune donnée métier : des comptes, des dates de connexion et des nombres.
// Les e-mails sont composés par l'app (textes traduits) à partir de ce que
// renvoient ces fonctions.
import { createHash, randomBytes } from "node:crypto";
import type { MonthlyCount } from "@symbola/contracts";
import type { AppDatabase } from "@symbola/db/client";
import {
  countAccountsByOrganization,
  findTeamAccountOrganization,
  listTeamAccounts,
  resetUserMfa,
  type TeamAccountStatus,
} from "@symbola/auth";
import { countEventsCreatedByMonth } from "@/modules/events/service";
import { countQuotesAndInvoicesByMonth } from "@/modules/quotes/service";
import {
  findInvitationById,
  findPendingInvitations,
  insertAuditLog,
  listAllOrganizations,
  replaceInvitationToken,
} from "./repository";

export const INVITATION_RESEND_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const ACTIVITY_MONTHS = 6;
const ACTIVE_ACCOUNT_DAYS = 30;

export type PendingInvitation = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
};

export type OrganizationSupportView = {
  id: string;
  name: string;
  accounts: TeamAccountStatus[];
  pendingInvitations: PendingInvitation[];
};

export async function listOrganizationsSupport(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<OrganizationSupportView[]> {
  const [organizationRows, accounts, invitationRows] = await Promise.all([
    listAllOrganizations(db),
    listTeamAccounts(db),
    findPendingInvitations(db),
  ]);
  return organizationRows
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      accounts: accounts.filter(
        (account) => account.organizationId === organization.id,
      ),
      pendingInvitations: invitationRows
        .filter((invitation) => invitation.organizationId === organization.id)
        // Une invitation devenue inutile (le compte existe déjà) n'est plus à relancer.
        .filter(
          (invitation) =>
            !accounts.some((account) => account.email === invitation.email),
        )
        .map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          expired: invitation.expiresAt.getTime() <= now.getTime(),
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export class InvitationNotPendingError extends Error {
  constructor() {
    super("invitation introuvable ou déjà acceptée");
    this.name = "InvitationNotPendingError";
  }
}

/** Nouveau lien d'invitation (7 jours) ; l'ancien cesse de fonctionner. */
export async function resendInvitation(
  db: AppDatabase,
  input: { adminUserId: string; invitationId: string; now?: Date },
): Promise<{
  email: string;
  organizationId: string;
  organizationName: string;
  language: "fr" | "en";
  token: string;
}> {
  const now = input.now ?? new Date();
  const invitation = await findInvitationById(db, input.invitationId);
  if (!invitation || invitation.acceptedAt)
    throw new InvitationNotPendingError();
  const organization = (await listAllOrganizations(db)).find(
    (candidate) => candidate.id === invitation.organizationId,
  );
  if (!organization) throw new InvitationNotPendingError();

  const token = randomBytes(32).toString("base64url");
  await replaceInvitationToken(db, invitation.id, {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now.getTime() + INVITATION_RESEND_DURATION_MS),
  });
  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: "hub.invitation.resent",
    targetOrganizationId: invitation.organizationId,
  });
  return {
    email: invitation.email,
    organizationId: organization.id,
    organizationName: organization.name,
    language: organization.language === "en" ? "en" : "fr",
    token,
  };
}

/**
 * Efface la double authentification d'un compte d'équipe (téléphone perdu ou
 * changé) : à sa prochaine connexion, mot de passe puis nouveau QR code.
 */
export async function resetTeamAccountMfa(
  db: AppDatabase,
  input: { adminUserId: string; userId: string },
): Promise<{ email: string; language: "fr" | "en" | null }> {
  const organizationId = await findTeamAccountOrganization(db, input.userId);
  const account = await resetUserMfa(db, input.userId);
  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: "hub.user.mfa_reset",
    targetOrganizationId: organizationId,
    targetUserId: input.userId,
  });
  return account;
}

export type OrganizationActivity = {
  id: string;
  name: string;
  teamAccounts: number;
  clientAccounts: number;
  activeAccounts: number;
  lastLoginAt: Date | null;
  months: string[];
  events: MonthlyCount[];
  quotes: MonthlyCount[];
  invoices: MonthlyCount[];
};

// Les N derniers mois civils (Europe/Paris), du plus ancien au plus récent.
export function lastMonths(now: Date, count: number): string[] {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function fill(months: string[], rows: MonthlyCount[]): MonthlyCount[] {
  return months.map((month) => ({
    month,
    count: rows.find((row) => row.month === month)?.count ?? 0,
  }));
}

/**
 * Statistiques d'usage par organisation (ADR 0029) : comptes, comptes
 * connectés sur 30 jours, dernière connexion, et nombres mensuels
 * d'événements, de devis et de factures — essais exclus, aucun contenu.
 */
export async function getOrganizationsActivity(
  db: AppDatabase,
  options: { now?: Date; organizationIds?: string[] } = {},
): Promise<OrganizationActivity[]> {
  const now = options.now ?? new Date();
  const months = lastMonths(now, ACTIVITY_MONTHS);
  // Un peu avant le 1er du plus ancien mois (Paris a au plus 2 h d'avance sur
  // UTC) : ce qui déborde sur le mois précédent est écarté par fill().
  const [firstYear, firstMonth] = months[0]!.split("-").map(Number) as [
    number,
    number,
  ];
  const since = new Date(
    Date.UTC(firstYear, firstMonth - 1, 1) - 2 * 3_600_000,
  );
  const [organizationRows, counts] = await Promise.all([
    listAllOrganizations(db),
    countAccountsByOrganization(
      db,
      new Date(now.getTime() - ACTIVE_ACCOUNT_DAYS * 86_400_000),
    ),
  ]);
  const selected = options.organizationIds
    ? organizationRows.filter((organization) =>
        options.organizationIds!.includes(organization.id),
      )
    : organizationRows;
  const ids = selected.map((organization) => organization.id);
  const [eventsByOrganization, documentsByOrganization] = await Promise.all([
    countEventsCreatedByMonth(ids, since),
    countQuotesAndInvoicesByMonth(ids, since),
  ]);
  const activity = selected.map((organization) => {
    const accountCounts = counts.find(
      (row) => row.organizationId === organization.id,
    );
    const events = eventsByOrganization[organization.id] ?? [];
    const documents = documentsByOrganization[organization.id] ?? {
      quotes: [],
      invoices: [],
    };
    return {
      id: organization.id,
      name: organization.name,
      teamAccounts: accountCounts?.teamAccounts ?? 0,
      clientAccounts: accountCounts?.clientAccounts ?? 0,
      activeAccounts: accountCounts?.activeAccounts ?? 0,
      lastLoginAt: accountCounts?.lastLoginAt ?? null,
      months,
      events: fill(months, events),
      quotes: fill(months, documents.quotes),
      invoices: fill(months, documents.invoices),
    };
  });
  return activity.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
