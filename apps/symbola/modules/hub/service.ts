// Porte d'entrée publique du module hub (ADR 0011) — administration de la
// suite (PRD HUB-03). Seul fichier que les autres modules peuvent
// importer ; jamais repository.ts directement.
import { createHash, randomBytes } from "node:crypto";
import type { AppDatabase } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { sendMail } from "@symbola/mail";
import { parseEnv } from "@symbola/env";
import { starterFollowUpDelays } from "@symbola/starter-templates";
import {
  findInvitationByTokenHash,
  findOrganizationById,
  findOrganizationModule,
  findOrganizationProfile,
  findPlatformSettings,
  findHelpProgress,
  insertDefaultPlatformSettings,
  findUserContact,
  insertAuditLog,
  insertInvitation,
  insertOrganization,
  upsertHelpProgress,
  resetHelpProgressItem,
  insertVatRegimeChange,
  listAllOrganizations,
  markInvitationAccepted,
  updateFirstStepsHidden,
  upsertOrganizationModule,
  upsertOrganizationProfileFields,
  upsertPlatformSettings,
} from "./repository";
import type { Language } from "./types";

// Lot 6 (RGPD-04) — demandes d'exercice de droits et réglages RGPD.
export {
  closePrivacyRequest,
  createPrivacyRequest,
  extendPrivacyRequest,
  getPrivacySettings,
  listDueSoonPrivacyRequests,
  listPrivacyRequests,
  PRIVACY_REQUEST_TYPES,
  PrivacyRequestInvalidError,
  PrivacyRequestNotFoundError,
  updatePrivacySettings,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
  type PrivacyRequestView,
  type PrivacySettings,
} from "./privacy-requests";
// Lot 6 (RGPD-02) — exports des données d'une personne.
export {
  getPrivacyExportFile,
  listExportablePrivacyRequests,
  listPrivacyExports,
  PrivacyExportInvalidError,
  PrivacyExportNotFoundError,
  purgeExpiredPrivacyExports,
  storePrivacyExport,
  type PrivacyExportFile,
  type PrivacyExportView,
} from "./privacy-exports";
// Lot 6 (RGPD-03) — exécutions des demandes d'oubli.
export {
  getPrivacyErasure,
  listErasablePrivacyRequests,
  listPrivacyErasures,
  PrivacyErasureInvalidError,
  PrivacyErasureNotFoundError,
  recordPrivacyErasureAcks,
  startPrivacyErasure,
  type PrivacyErasureAck,
  type PrivacyErasureItem,
  type PrivacyErasureView,
} from "./privacy-erasures";
// Lot 6 (RGPD-05) — purges mensuelles.
export {
  getPrivacyPurge,
  listInactiveClientAccounts,
  listPrivacyPurges,
  PrivacyPurgeInvalidError,
  PrivacyPurgeNotFoundError,
  recordPrivacyPurgeAcks,
  startPrivacyPurge,
  type PrivacyPurgeLine,
  type PrivacyPurgeView,
} from "./privacy-purges";

// Lot 6 — contrat privacy/v1 du module (ADR 0023).
export { hubPrivacy } from "./privacy";

// Lot 10 (AIDE-08) — recherche globale.
export { globalSearch, type GlobalSearchResults } from "./search";

// Lot 9 (ADR 0029) — assistance de l'Admin et statistiques d'usage.
export {
  ACTIVITY_MONTHS,
  InvitationNotPendingError,
  getOrganizationsActivity,
  lastMonths,
  listOrganizationsSupport,
  resendInvitation,
  resetTeamAccountMfa,
  listTeamHelpProgress,
  type TeamHelpProgress,
  type OrganizationActivity,
  type OrganizationSupportView,
  type PendingInvitation,
} from "./admin-support";

// Lot 13 (HUB-17, HUB-18) — vue d'ensemble de la console et dernière sauvegarde.
export {
  BACKUP_STALE_HOURS,
  backupState,
  getAdminOverview,
  getBackupStatus,
  listOrganizationModuleStates,
  type AdminOverview,
  type BackupRunView,
  type BackupState,
  type BackupStatus,
} from "./admin-overview";

export {
  IMPORT_ENTITY_MODULE,
  IMPORT_ENTITY_TYPES,
  cancelImport,
  decideFreeColumns,
  getAppliedImport,
  purgeExpiredImportUndoValues,
  recordAppliedImport,
  recordImportUndo,
  decideImportMatches,
  decideImportVendorTypes,
  markImportStepReviewed,
  setImportRowStatuses,
  getImportColumns,
  getImportDraft,
  getImportWorkingSet,
  isGapColumn,
  getImportLimits,
  listImports,
  purgeExpiredImportDrafts,
  saveImportMapping,
  saveImportMatching,
  setManualImportMatch,
  startEventSheetsImport,
  startImport,
  type AppliedImportItem,
  type AppliedImportView,
  type ColumnChoiceInput,
  type ImportResult,
  type RecordedItem,
  type FreeColumnDecision,
  type ImportColumnChoice,
  type ImportColumnView,
  type ImportColumnsView,
  type ImportDraft,
  type ImportMatch,
  type ImportMatching,
  type ImportRowEvent,
  type ImportVendorTypeChoice,
  type ImportVendorTypeTarget,
  type ImportWorkingSet,
  type VendorTypeDecision,
  type MatchDecision,
  type ImportEntityType,
  type ImportLimits,
  type ImportRejectionReason,
  type ImportSummary,
  type MappingError,
  type SaveImportMappingResult,
  type StartImportInput,
  type StartImportResult,
  type StartEventSheetsImportResult,
} from "./imports";
export {
  cancelImportJobs,
  advanceImportJob,
  createImportJob,
  listActiveImportJobs,
  listImportJobs,
  readNextSheet,
  retryImportJob,
  updateImportJob,
  type ImportJobPayload,
  type ImportJobResult,
  type ImportJobView,
} from "./import-jobs";

export type VatRegime = "franchise" | "assujetti";
export type LegalForm = "ei" | "eirl" | "eurl" | "sarl" | "sas" | "sasu" | "sa" | "auto_entrepreneur" | "autre";
export type Metier = "wedding_planner" | "event_agency" | "autre";

// Clés des modules qu'un Admin peut activer ou désactiver par organisation
// (lot 11 : vendors, le carnet de prestataires, ADR 0031).
export const MODULE_KEYS = ["hello", "events", "budget", "quotes", "vendors"] as const;
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

// Lot 12 (ONB-03) — assistant de démarrage : étape en cours et fin. Tant
// qu'il n'est pas terminé, les menus métier sont verrouillés (app-shell).
export const SETUP_STEPS = 6;
export type SetupState = { step: number; completed: boolean; metier: Metier | null };

export async function getSetupState(db: AppDatabase, organizationId: string): Promise<SetupState> {
  const row = await findOrganizationProfile(db, organizationId);
  return { step: row?.setupStep ?? 1, completed: Boolean(row?.setupCompletedAt), metier: row?.metier ?? null };
}

export async function saveSetupStep(db: AppDatabase, organizationId: string, step: number): Promise<void> {
  const clamped = Math.min(Math.max(Math.trunc(step), 1), SETUP_STEPS);
  await upsertOrganizationProfileFields(db, organizationId, { setupStep: clamped });
}

export async function completeSetup(db: AppDatabase, organizationId: string): Promise<void> {
  await upsertOrganizationProfileFields(db, organizationId, { setupStep: SETUP_STEPS, setupCompletedAt: new Date() });
}

// Lot 13 (HUB-15) — délais de relance du bloc « À traiter » de l'accueil :
// réglage de l'organisation, sinon valeur de départ (décision G).
export type FollowUpDelays = { quoteFollowUpDays: number; prospectFollowUpDays: number };

export async function getFollowUpDelays(db: AppDatabase, organizationId: string): Promise<FollowUpDelays> {
  const row = await findOrganizationProfile(db, organizationId);
  const defaults = starterFollowUpDelays();
  return {
    quoteFollowUpDays: row?.quoteFollowUpDays ?? defaults.quoteFollowUpDays,
    prospectFollowUpDays: row?.prospectFollowUpDays ?? defaults.prospectFollowUpDays,
  };
}

export async function saveFollowUpDelays(db: AppDatabase, organizationId: string, delays: FollowUpDelays): Promise<void> {
  for (const value of [delays.quoteFollowUpDays, delays.prospectFollowUpDays]) {
    if (!Number.isInteger(value) || value < 1 || value > 365) throw new RangeError("délai de relance entre 1 et 365 jours");
  }
  await upsertOrganizationProfileFields(db, organizationId, delays);
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
  importUndoRetentionDays: number;
  // Lot 14c : fiches événement PDF déposées à la fois.
  importMaxSheets: number;
  // Lot 6 (RGPD-02) : durée de téléchargement d'un export RGPD.
  privacyExportRetentionDays: number;
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
    importUndoRetentionDays: row.importUndoRetentionDays,
    importMaxSheets: row.importMaxSheets,
    privacyExportRetentionDays: row.privacyExportRetentionDays,
  };
}

// Les limites de l'import sont facultatives : non fournies, elles gardent
// leur valeur actuelle.
export async function setPlatformSettings(
  db: AppDatabase,
  input: { adminUserId: string } & Pick<PlatformSettings, "franchiseThresholdServicesCents" | "franchiseThresholdGoodsCents"> &
    Partial<Pick<PlatformSettings, "importMaxBytes" | "importMaxRows" | "importDraftRetentionDays" | "importUndoRetentionDays" | "importMaxSheets" | "privacyExportRetentionDays">>,
): Promise<void> {
  await upsertPlatformSettings(db, {
    franchiseThresholdServicesCents: input.franchiseThresholdServicesCents,
    franchiseThresholdGoodsCents: input.franchiseThresholdGoodsCents,
    ...(input.importMaxBytes !== undefined ? { importMaxBytes: input.importMaxBytes } : {}),
    ...(input.importMaxRows !== undefined ? { importMaxRows: input.importMaxRows } : {}),
    ...(input.importDraftRetentionDays !== undefined ? { importDraftRetentionDays: input.importDraftRetentionDays } : {}),
    ...(input.importUndoRetentionDays !== undefined ? { importUndoRetentionDays: input.importUndoRetentionDays } : {}),
    ...(input.importMaxSheets !== undefined ? { importMaxSheets: input.importMaxSheets } : {}),
    ...(input.privacyExportRetentionDays !== undefined ? { privacyExportRetentionDays: input.privacyExportRetentionDays } : {}),
  });
  await insertAuditLog(db, {
    adminUserId: input.adminUserId,
    action: "hub.platform_settings.updated",
    targetOrganizationId: null,
  });
}

// Lot 10 (AIDE-05 à AIDE-07) — progression d'un compte dans l'aide : visites
// focus (« tour:<écran> ») et tutoriels (« tutorial:<clé> »). Un élément jamais
// ouvert n'a pas de ligne ; « postponed » = mis de côté avec son étape.
export type HelpProgressStatus = "started" | "postponed" | "completed";
export type HelpProgressEntry = {
  itemKey: string;
  status: HelpProgressStatus;
  step: number;
  context: Record<string, string> | null;
  updatedAt: Date;
  completedAt: Date | null;
};

export async function getHelpProgress(db: AppDatabase, userId: string): Promise<HelpProgressEntry[]> {
  return (await findHelpProgress(db, userId)).map((row) => ({
    itemKey: row.itemKey,
    status: row.status,
    step: row.step,
    context: row.context ?? null,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  }));
}

const HELP_ITEM_KEY = /^(tour|tutorial):[a-z0-9-]{1,60}$/;

export class InvalidHelpItemError extends Error {
  constructor() {
    super("clé d'aide invalide");
    this.name = "InvalidHelpItemError";
  }
}

export async function recordHelpProgress(
  db: AppDatabase,
  input: { userId: string; itemKey: string; status: HelpProgressStatus; step?: number; context?: Record<string, string> | null; now?: Date },
): Promise<void> {
  if (!HELP_ITEM_KEY.test(input.itemKey)) throw new InvalidHelpItemError();
  await upsertHelpProgress(db, {
    userId: input.userId,
    itemKey: input.itemKey,
    status: input.status,
    step: Math.max(0, Math.min(input.step ?? 0, 50)),
    now: input.now ?? new Date(),
    ...(input.context === undefined ? {} : { context: input.context }),
  });
}

// AIDE-06 — recommencer un tutoriel (revoir) : étape 0, sans contexte.
export async function restartHelpItem(db: AppDatabase, userId: string, itemKey: string): Promise<void> {
  if (!HELP_ITEM_KEY.test(itemKey)) throw new InvalidHelpItemError();
  await resetHelpProgressItem(db, userId, itemKey, new Date());
}

// AIDE-01, AIDE-05 — une visite s'ouvre d'elle-même tant que le compte ne l'a
// jamais ouverte ; mise de côté ou terminée, elle ne s'impose plus (la barre
// d'aide propose de la reprendre).
export async function hasSeenTour(db: AppDatabase, userId: string, moduleKey: string): Promise<boolean> {
  return (await findHelpProgress(db, userId)).some((row) => row.itemKey === `tour:${moduleKey}`);
}

export async function markTourSeen(db: AppDatabase, userId: string, moduleKey: string): Promise<void> {
  await recordHelpProgress(db, { userId, itemKey: `tour:${moduleKey}`, status: "completed" });
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
