// Accès aux données du module hub — jamais importé hors de modules/hub/
// (ADR 0011). Pas de RLS sur ces tables (packages/db/src/schema/hub.ts) :
// l'isolation est assurée par le code applicatif, pas par PostgreSQL.
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { auditLog, invitations, organizations } from "@symbola/db/schema/hub";
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
  input: { adminUserId: string; action: string; targetOrganizationId: string | null },
) {
  await db.insert(auditLog).values(input);
}
