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
  findOrganizationById,
  findOrganizationModule,
  findOrganizationProfile,
  findPlatformSettings,
  findTourSeen,
  insertDefaultPlatformSettings,
  findUserContact,
  insertAuditLog,
  insertInvitation,
  insertOrganization,
  insertTourSeen,
  insertVatRegimeChange,
  listAllOrganizations,
  markInvitationAccepted,
  updateFirstStepsHidden,
  upsertOrganizationModule,
  upsertOrganizationProfileFields,
  upsertPlatformSettings,
} from "./repository";
import type { Language } from "./types";

export {
  IMPORT_ENTITY_MODULE,
  IMPORT_ENTITY_TYPES,
  cancelImport,
  decideImportMatches,
  getImportColumns,
  getImportDraft,
  getImportWorkingSet,
  getImportLimits,
  listImports,
  purgeExpiredImportDrafts,
  saveImportMapping,
  saveImportMatching,
  setManualImportMatch,
  startImport,
  type ColumnChoiceInput,
  type ImportColumnChoice,
  type ImportColumnView,
  type ImportColumnsView,
  type ImportDraft,
  type ImportMatch,
  type ImportMatching,
  type ImportRowEvent,
  type ImportWorkingSet,
  type MatchDecision,
  type ImportEntityType,
  type ImportLimits,
  type ImportRejectionReason,
  type ImportSummary,
  type MappingError,
  type SaveImportMappingResult,
  type StartImportInput,
  type StartImportResult,
} from "./imports";

export type VatRegime = "franchise" | "assujetti";
export type LegalForm = "ei" | "eirl" | "eurl" | "sarl" | "sas" | "sasu" | "sa" | "auto_entrepreneur" | "autre";
export type Metier = "wedding_planner" | "autre";

// Un seul module « métier » existe pour l'instant (hello, SOC-01) — les
// futurs modules (events, budget, quotes) ajouteront leur clé ici.
export const MODULE_KEYS = ["hello", "events", "budget", "quotes"] as const;
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

export type OrganizationProfile = {
  siren: string | null;
  address: string | null;
  logoKey: string | null;
  legalForm: LegalForm | null;
  metier: Metier | null;
  metierPrecision: string | null;
  vatRegime: VatRegime | null;
  vatRateDefaultBasisPoints: number | null;
  completedAt: Date | null;
};

const EMPTY_PROFILE: OrganizationProfile = {
  siren: null,
  address: null,
  logoKey: null,
  legalForm: null,
  metier: null,
  metierPrecision: null,
  vatRegime: null,
  vatRateDefaultBasisPoints: null,
  completedAt: null,
};

// ONB-01 — Pas encore de ligne = questionnaire jamais commencé : toutes
// les réponses sont nulles plutôt que de bloquer l'accès à l'app.
export async function getOrganizationProfile(db: AppDatabase, organizationId: string): Promise<OrganizationProfile> {
  const row = await findOrganizationProfile(db, organizationId);
  return row ?? EMPTY_PROFILE;
}

export type OnboardingStepInput = Partial<Omit<OrganizationProfile, "completedAt">>;

// ONB-01 — « Il peut interrompre le questionnaire et le reprendre plus
// tard. » Chaque étape sauvegarde seulement les champs qu'elle porte,
// jamais la fiche entière (une étape ultérieure ne doit pas écraser les
// réponses déjà données).
export async function saveOnboardingStep(
  db: AppDatabase,
  organizationId: string,
  step: OnboardingStepInput,
): Promise<void> {
  await upsertOrganizationProfileFields(db, organizationId, step);
}

const REQUIRED_PROFILE_FIELDS: (keyof OrganizationProfile)[] = ["legalForm", "metier", "vatRegime"];

export async function completeOnboarding(
  db: AppDatabase,
  organizationId: string,
): Promise<{ outcome: "success" } | { outcome: "missing_fields"; fields: (keyof OrganizationProfile)[] }> {
  const profile = await getOrganizationProfile(db, organizationId);
  const missing = REQUIRED_PROFILE_FIELDS.filter((field) => profile[field] === null);
  if (missing.length > 0) return { outcome: "missing_fields", fields: missing };

  await upsertOrganizationProfileFields(db, organizationId, { completedAt: new Date() });
  return { outcome: "success" };
}

// EVT-05 — en-tête des documents exportés (programme du jour J, plus tard
// devis et factures) : nom de l'organisation et clé de son logo.
export async function getDocumentHeader(
  db: AppDatabase,
  organizationId: string,
): Promise<{ organizationName: string; logoKey: string | null } | null> {
  const organization = await findOrganizationById(db, organizationId);
  if (!organization) return null;
  const profile = await getOrganizationProfile(db, organizationId);
  return { organizationName: organization.name, logoKey: profile.logoKey };
}

// ONB-01 — mentions légales déduites du régime de TVA (exemple du PRD :
// « TVA non applicable, art. 293 B du CGI » en franchise). Fonction pure,
// prête à être appelée par les futurs modules devis/factures (lot 4) ;
// rien ne l'affiche encore, aucun document n'existe pour l'instant.
export function computeLegalMention(profile: {
  vatRegime: VatRegime | null;
  vatRateDefaultBasisPoints: number | null;
}): string {
  if (profile.vatRegime === "franchise") {
    return "TVA non applicable, art. 293 B du CGI";
  }
  if (profile.vatRegime === "assujetti" && profile.vatRateDefaultBasisPoints !== null) {
    return `TVA ${(profile.vatRateDefaultBasisPoints / 100).toFixed(2)} %`;
  }
  return "";
}

// ONB-02 — « Il saisit une date d'effet. Les devis et factures déjà émis
// ne changent pas. » L'historique garde la date d'effet pour les futurs
// modules devis/factures (lot 4, pas encore construits) ; la fiche
// reflète le régime courant dès l'enregistrement du changement.
export async function changeVatRegime(
  db: AppDatabase,
  input: { organizationId: string; userId: string; newRegime: VatRegime; effectiveDate: string },
): Promise<void> {
  const profile = await getOrganizationProfile(db, input.organizationId);

  await insertVatRegimeChange(db, {
    organizationId: input.organizationId,
    previousRegime: profile.vatRegime,
    newRegime: input.newRegime,
    effectiveDate: input.effectiveDate,
    changedByUserId: input.userId,
  });

  await upsertOrganizationProfileFields(db, input.organizationId, { vatRegime: input.newRegime });
}

export type PlatformSettings = {
  franchiseThresholdServicesCents: number | null;
  franchiseThresholdGoodsCents: number | null;
  // Lot 5 : limites de l'import (valeurs de départ portées par la base).
  importMaxBytes: number;
  importMaxRows: number;
  importDraftRetentionDays: number;
};

// ONB-02 — « Le seuil de chiffre d'affaires de la franchise est un
// paramètre, mis à jour par l'Admin, jamais une valeur dans le code. »
// Deux seuils (prestations de services / vente de marchandises) : la
// réalité fiscale française distingue les deux, le MVP ne les confond
// pas même si les wedding planners sont presque tous en services.
export async function getPlatformSettings(db: AppDatabase): Promise<PlatformSettings> {
  let row = await findPlatformSettings(db);
  if (!row) {
    await insertDefaultPlatformSettings(db);
    row = await findPlatformSettings(db);
  }
  if (!row) throw new Error("réglages de la plateforme introuvables");
  return {
    franchiseThresholdServicesCents: row.franchiseThresholdServicesCents,
    franchiseThresholdGoodsCents: row.franchiseThresholdGoodsCents,
    importMaxBytes: row.importMaxBytes,
    importMaxRows: row.importMaxRows,
    importDraftRetentionDays: row.importDraftRetentionDays,
  };
}

// Les limites de l'import sont facultatives : non fournies, elles gardent
// leur valeur actuelle.
export async function setPlatformSettings(
  db: AppDatabase,
  input: { adminUserId: string } & Pick<PlatformSettings, "franchiseThresholdServicesCents" | "franchiseThresholdGoodsCents"> &
    Partial<Pick<PlatformSettings, "importMaxBytes" | "importMaxRows" | "importDraftRetentionDays">>,
): Promise<void> {
  await upsertPlatformSettings(db, {
    franchiseThresholdServicesCents: input.franchiseThresholdServicesCents,
    franchiseThresholdGoodsCents: input.franchiseThresholdGoodsCents,
    ...(input.importMaxBytes !== undefined ? { importMaxBytes: input.importMaxBytes } : {}),
    ...(input.importMaxRows !== undefined ? { importMaxRows: input.importMaxRows } : {}),
    ...(input.importDraftRetentionDays !== undefined ? { importDraftRetentionDays: input.importDraftRetentionDays } : {}),
  });
  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: "hub.platform_settings.updated",
    targetOrganizationId: null,
  });
}

// AIDE-01 — « Une visite guidée s'affiche à la première ouverture d'un
// module. Elle se relance à tout moment. » moduleKey distingue le hub
// des futurs modules métier (events, budget, quotes…).
export async function hasSeenTour(db: AppDatabase, userId: string, moduleKey: string): Promise<boolean> {
  return (await findTourSeen(db, userId, moduleKey)) !== null;
}

export async function markTourSeen(db: AppDatabase, userId: string, moduleKey: string): Promise<void> {
  await insertTourSeen(db, userId, moduleKey);
}

// AIDE-04 — « L'utilisateur peut masquer la liste [premiers pas]. »
export async function hideFirstSteps(db: AppDatabase, userId: string): Promise<void> {
  await updateFirstStepsHidden(db, userId, true);
}

// DEV-02 — adresse et langue d'un compte de l'organisation, pour un e-mail
// de notification (devis signé). Jamais un compte d'une autre organisation.
export async function getUserContact(
  db: AppDatabase,
  organizationId: string,
  userId: string,
): Promise<{ email: string; language: "fr" | "en" } | null> {
  const row = await findUserContact(db, organizationId, userId);
  return row ? { email: row.email, language: row.language === "en" ? "en" : "fr" } : null;
}
