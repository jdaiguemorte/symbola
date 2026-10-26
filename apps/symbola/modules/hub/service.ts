// Porte d'entrée publique du module hub (ADR 0011) — administration de la
// suite (PRD HUB-03). Seul fichier que les autres modules peuvent
// importer ; jamais repository.ts directement.
import { createHash, randomBytes } from "node:crypto";
import type { AppDatabase } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { sendMail } from "@symbola/mail";
import { parseEnv } from "@symbola/env";
import {
  findInvitationByTokenHash,
  insertAuditLog,
  insertInvitation,
  insertOrganization,
  markInvitationAccepted,
} from "./repository";
import type { Language } from "./types";

const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours (PRD HUB-03, proposé)

function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CreateOrganizationInput = {
  adminUserId: string;
  name: string;
  language: Language;
  siret: string | null;
  titulaireEmail: string;
};

export async function createOrganizationWithInvitation(db: AppDatabase, input: CreateOrganizationInput) {
  const organization = await insertOrganization(db, {
    name: input.name,
    language: input.language,
    siret: input.siret,
  });

  const invitationToken = generateInvitationToken();
  const invitation = await insertInvitation(db, {
    organizationId: organization.id,
    email: input.titulaireEmail,
    tokenHash: hashInvitationToken(invitationToken),
    expiresAt: new Date(Date.now() + INVITATION_DURATION_MS),
  });

  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: "hub.organization.created",
    targetOrganizationId: organization.id,
  });

  const env = parseEnv(process.env);
  const invitationUrl = `${env.APP_PUBLIC_URL}/invitations/${invitationToken}`;
  await sendMail({
    to: input.titulaireEmail,
    subject: "Votre invitation Symbola",
    text: `Bonjour,\n\nVous avez été invité·e à rejoindre « ${organization.name} » sur Symbola. Ce lien est valable 7 jours :\n${invitationUrl}\n\nÀ bientôt,\nL'équipe Symbola`,
  });

  return { organizationId: organization.id, invitationId: invitation.id, invitationToken };
}

export type AcceptInvitationResult =
  | { outcome: "invalid_or_expired" }
  | { outcome: "already_accepted" }
  | { outcome: "success"; organizationId: string };

export async function acceptInvitation(
  db: AppDatabase,
  input: { token: string; password: string },
): Promise<AcceptInvitationResult> {
  const invitation = await findInvitationByTokenHash(db, hashInvitationToken(input.token));
  if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
    return { outcome: "invalid_or_expired" };
  }
  if (invitation.acceptedAt) {
    return { outcome: "already_accepted" };
  }

  await createUser(db, {
    organizationId: invitation.organizationId,
    email: invitation.email,
    password: input.password,
    role: "owner",
  });
  await markInvitationAccepted(db, invitation.id);

  return { outcome: "success", organizationId: invitation.organizationId };
}
