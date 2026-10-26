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
  findOrganizationModule,
  insertAuditLog,
  insertInvitation,
  insertOrganization,
  listAllOrganizations,
  markInvitationAccepted,
  upsertOrganizationModule,
} from "./repository";
import type { Language } from "./types";

// Un seul module « métier » existe pour l'instant (hello, SOC-01) — les
// futurs modules (events, budget, quotes) ajouteront leur clé ici.
export const MODULE_KEYS = ["hello"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

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
  // HUB-04 : l'e-mail suit la langue de l'organisation (pas encore de
  // fiche « marié » à qui appliquer sa propre langue — ADR 0011, lot
  // suivant). Ce service n'est pas un composant React : pas d'accès à
  // next-intl ici, deux variantes inline suffisent pour deux clés.
  const subject = input.language === "en" ? "Your Symbola invitation" : "Votre invitation Symbola";
  const text =
    input.language === "en"
      ? `Hello,\n\nYou have been invited to join "${organization.name}" on Symbola. This link is valid for 7 days:\n${invitationUrl}\n\nSee you soon,\nThe Symbola team`
      : `Bonjour,\n\nVous avez été invité·e à rejoindre « ${organization.name} » sur Symbola. Ce lien est valable 7 jours :\n${invitationUrl}\n\nÀ bientôt,\nL'équipe Symbola`;
  await sendMail({
    to: input.titulaireEmail,
    subject,
    text,
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

export async function listOrganizations(db: AppDatabase) {
  return listAllOrganizations(db);
}

// Absence de ligne = activé (CLAUDE.md §2.3, dégradation propre : un
// nouveau module est actif partout tant qu'un Admin ne l'a pas désactivé).
export async function isModuleEnabled(db: AppDatabase, organizationId: string, moduleKey: ModuleKey): Promise<boolean> {
  const row = await findOrganizationModule(db, organizationId, moduleKey);
  return row?.enabled ?? true;
}

export async function setModuleEnabled(
  db: AppDatabase,
  input: { adminUserId: string; organizationId: string; moduleKey: ModuleKey; enabled: boolean },
): Promise<void> {
  await upsertOrganizationModule(db, input);
  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: input.enabled ? "hub.module.enabled" : "hub.module.disabled",
    targetOrganizationId: input.organizationId,
  });
}
