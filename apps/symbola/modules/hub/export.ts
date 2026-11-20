// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du hub dans l'export complet de l'organisation
// (contrat export/v1) : l'organisation, son profil et son logo, ses modules, ses changements de
// régime de TVA, son registre RGPD (réglages, demandes, exports, effacements, purges), son équipe
// (adresse et rôle, sans identifiant de connexion : l'identité est chez le fournisseur
// d'identité, ADR 0067) et son journal d'activité (décision D3, en lecture). Exposé par
// service.ts.
import { z } from "zod";
import { listTeam } from "@symbola/auth";
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import { eraseOrganizationIdentity, eraseOrganizationSchema } from "@symbola/db/erase";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { auditEntries } from "@symbola/db/schema/core";
import {
  contactMembers,
  contactNotes,
  contacts,
  contactDuplicates,
  contactMerges,
  emailTemplates,
  automations,
  riskRules,
  membershipRoleEnum,
  messageTemplates,
  messageTemplateVersions,
  organizationModules,
  organizationProfiles,
  organizations,
  users,
  privacyErasures,
  privacyExports,
  privacyPurges,
  privacyRequests,
  privacySettings,
  vatRegimeChanges,
} from "@symbola/db/schema/hub";

export const HUB_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  // L'organisation elle-même : son identifiant reste (il relie l'archive à l'espace d'origine).
  { table: organizations, organizationField: "id", importSkip: "organization" },
  { table: organizationProfiles, idField: "organizationId", files: ["logoKey"] },
  { table: organizationModules, idField: "moduleKey", importSkip: "subscription" },
  { table: vatRegimeChanges },
  // Lot 36a (CRM-03, ADR 0069) : le contact unique et ses notes ; les contacts d'essai sont exclus.
  { table: contacts, demoField: "isDemo" },
  // Lot 48a (DAT-08) : le texte chiffré d'une note confidentielle ne sort pas.
  { table: contactNotes, parents: { contactId: "contacts" }, omit: ["bodySealed"] },
  // Lot 45 (CRM-07) : doublons possibles et trace des fusions (identifiants et noms de champs).
  { table: contactDuplicates, parents: { firstContactId: "contacts", secondContactId: "contacts" } },
  { table: contactMerges },
  // Lot 36b (CRM-03, D2) : les membres des foyers et des entreprises.
  { table: contactMembers, parents: { groupContactId: "contacts", memberContactId: "contacts" } },
  // Lot 38a (MSG-01, D3) : les modèles d'e-mails que l'organisation a réécrits (les autres valent le
  // texte de départ de Symbola).
  { table: emailTemplates },
  // Lot 38b (HUB-21, D10) : les modèles de messages de la planner et toutes leurs versions.
  { table: messageTemplates },
  { table: messageTemplateVersions, parents: { templateId: "message_templates" } },
  // Lot 53 (HUB-28, GC-02) : les automatismes réglés (actif, délai) et les règles du radar ; leur journal
  // et les notifications ne sont que des traces de 90 jours.
  { table: automations },
  { table: riskRules },
  { table: privacySettings, idField: "organizationId" },
  { table: privacyRequests },
  // Trace des exports RGPD : leurs fichiers, effacés à l'expiration, ne sont pas repris.
  { table: privacyExports, omit: ["pdfKey", "archiveKey"], importSkip: "trace" },
  { table: privacyErasures },
  { table: privacyPurges },
  // Journal d'activité (HUB-16) : les lignes de l'organisation, sans celles des essais ni celles
  // de l'exploitation de Symbola (sans organisation).
  { table: auditEntries, name: "activity_journal", demoField: "isDemo", importSkip: "journal" },
];

// Équipe : une ligne par adhésion, sans dernière connexion (donnée d'exploitation).
const TEAM_ENTITY = "team_members";
const teamMemberSchema = z.strictObject({
  userId: z.guid(),
  email: z.string(),
  role: z.enum(membershipRoleEnum.enumValues),
  disabledAt: z.iso.datetime().nullable(),
});

// Tables du hub (et du socle commun) qui ne sont pas exportées, et pourquoi
// (docs/export/format-v1.md).
export const HUB_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  sessions: "secret : sessions ouvertes (jetons hachés)",
  // Lot 52 (HUB-05, SEC-08, HUB-04 ; ADR 0094).
  known_devices: "sécurité : appareils déjà vus d'un compte, sans donnée métier ; oubliés après 30 jours",
  ownership_transfers: "secret : demandes de transfert de propriété (jetons hachés) ; le transfert est au journal d'activité",
  identity_change_alerts: "sécurité : alertes de changement d'identité d'un compte, gardées 30 jours",
  invitations: "secret : invitations en attente (jetons hachés) ; une invitation se renvoie",
  users: "identité : les comptes sont listés dans team_members ; leurs identifiants de connexion restent chez le fournisseur d'identité",
  memberships: "identité : listées dans team_members",
  help_progress: "préférence : avancement de l'aide à l'écran, propre à chaque compte",
  user_tour_seen: "préférence : visites guidées vues, propres à chaque compte",
  imports: "technique : imports en cours ou confirmés, purgés ; les données importées sont dans leurs entités",
  import_items: "technique : détail des imports, gardé pour leur annulation puis purgé",
  import_jobs: "technique : traitements de fond des imports",
  platform_settings: "exploitation : réglages de la plateforme Symbola",
  backup_runs: "exploitation : sauvegardes de la plateforme",
  connection_traces: "exploitation : adresses IP des connexions, pour l'enquête de sécurité",
  organization_exports: "technique : trace des exports complets eux-mêmes",
  // Lot 35b (HUB-13, ADR 0098).
  organization_imports: "technique : trace des reprises d'un export (état et bilan), sans donnée reprise",
  // Lot 35c (RGP-11, ADR 0100).
  organization_closures: "exploitation : trace des fermetures de l'espace (identifiant et dates), gardée après la suppression",
  // Lot 37b (DOC-12, D12) : des nombres pris chaque mois pour l'exploitation (quotas), sans donnée métier.
  storage_snapshots: "exploitation : relevé mensuel du stockage (nombres de fichiers et volumes)",
  // Lot 38b (HUB-29, D11) : des adresses secrètes, propres à chaque personne ; une archive ne les porte pas.
  calendar_feeds: "secret : adresses des flux de calendrier (jetons hachés), propres à chaque personne",
  // Lot 39b (UX-09, ADR 0074).
  form_drafts: "temporaire : brouillons de saisie, effacés à l'enregistrement et purgés après 30 jours",
  // Lot 40b (ARC-10, ADR 0076).
  jobs: "temporaire : e-mails en attente d'envoi ; contenu effacé à la fin, ligne purgée après 30 jours",
  domain_events: "technique : événements internes entre modules",
  domain_event_consumers: "technique : suivi des événements internes",
  rate_limit_events: "exploitation : tentatives limitées",
  usage_counters: "exploitation : compteurs d'usage de la plateforme",
  // Lot 53 (HUB-15, ARC-09, HUB-28 ; DPO-10).
  notifications: "temporaire : notifications de l'équipe, effacées 90 jours après leur création",
  notification_settings: "préférence : récapitulatif et plages de silence, propres à chaque compte",
  notification_preferences: "préférence : sortes de notification gardées ou coupées, propres à chaque compte",
  push_subscriptions: "technique : abonnements push des appareils (adresse du service de push, clés publiques), propres à chaque appareil",
  automation_runs: "temporaire : journal des automatismes, effacé après 90 jours",
  // Lot 55 (MSG-05 ; ADR 0102).
  email_deliveries: "temporaire : journal des envois (objet, destinataire, statut), effacé 13 mois après l'envoi",
  // Lot 54 (HUB-27, ARC-06, NFR-26, DOC-06 ; ADR 0101) : le contrat avec Symbola et ses réglages, pas des
  // données de l'organisation ; un espace repris a son propre abonnement.
  plans: "exploitation : catalogue des offres de Symbola (prix, quotas), le même pour tous",
  plan_modules: "exploitation : modules des offres du catalogue de Symbola",
  organization_subscriptions: "exploitation : abonnement de l'espace à Symbola (offre, dates) ; un espace repris a le sien",
  feature_flags: "exploitation : interrupteurs des fonctions de la plateforme",
  feature_flag_organizations: "exploitation : fonctions nouvelles ouvertes à l'espace par l'Exploitation",
  storage_quota_states: "exploitation : dernière mesure du stockage face au quota (des nombres)",
};

export async function exportHubData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  const db = appDatabase();
  const exported = await exportModuleEntities(db, { organizationId, module: "hub", context, specs: HUB_EXPORT_ENTITIES });
  const team = await listTeam(db, organizationId);
  exported.entities.push({
    name: TEAM_ENTITY,
    rows: team.map((member) => ({ userId: member.id, email: member.email, role: member.role, disabledAt: member.disabledAt?.toISOString() ?? null })),
  });
  return exported;
}

export function describeHubExport(): ExportEntitySchema[] {
  return [...describeModuleEntities("hub", HUB_EXPORT_ENTITIES), { module: "hub", name: TEAM_ENTITY, schema: teamMemberSchema }];
}

// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide. L'organisation garde
// son nom et ses abonnements ; elle reçoit le SIRET de l'archive s'il lui manque (même SIREN contrôlé
// avant). L'équipe n'est pas reprise : ses membres sont à inviter. Le journal d'activité repart de zéro.
export function registerHubImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(HUB_EXPORT_ENTITIES, rows, context);
}

export async function importHubData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: HUB_EXPORT_ENTITIES });
  const entities = await importModuleEntities(tx, { specs: HUB_EXPORT_ENTITIES, rows, context });
  const source = rows.get("organizations")?.[0];
  if (typeof source?.siret === "string" && source.siret !== "") {
    await tx
      .update(organizations)
      .set({ siret: source.siret })
      .where(and(eq(organizations.id, context.organizationId), isNull(organizations.siret)));
  }
  entities.push({ entity: TEAM_ENTITY, rows: rows.get(TEAM_ENTITY)?.length ?? 0, imported: 0, reason: "team" });
  return { module: "hub", entities };
}

// Comptes cités par l'archive (équipe d'origine) : ceux de l'équipe qui reprend, retrouvés par leur
// adresse, prennent leur place ; un compte que Symbola ne connaît pas est remplacé par la
// Propriétaire qui reprend ; un compte connu (même instance) reste.
export async function resolveImportUsers(
  db: AppDatabase,
  input: { organizationId: string; importerUserId: string; team: readonly { userId: string; email: string }[] },
): Promise<Map<string, string>> {
  const here = new Map((await listTeam(db, input.organizationId)).map((member) => [member.email.toLowerCase(), member.id] as const));
  const known = input.team.length
    ? new Set((await db.select({ id: users.id }).from(users).where(inArray(users.id, input.team.map((member) => member.userId)))).map((row) => row.id))
    : new Set<string>();
  const mapped = new Map<string, string>();
  for (const member of input.team) {
    mapped.set(member.userId, here.get(member.email.toLowerCase()) ?? (known.has(member.userId) ? member.userId : input.importerUserId));
  }
  return mapped;
}

// Lot 35c (RGP-11, D8, ADR 0100) : en dernier, les lignes du hub et du socle commun (journal
// d'activité, événements internes, tâches de fond) de l'organisation fermée, puis l'organisation
// elle-même et les comptes de son équipe qui n'ont plus d'adhésion. Renvoie les lignes effacées et
// les sujets des comptes chez le fournisseur d'identité.
export async function eraseHubData(tx: OrganizationTransaction, organizationId: string): Promise<{ rows: number; identitySubjects: string[] }> {
  const team = (await listTeam(tx as unknown as AppDatabase, organizationId)).map((member) => member.id);
  const rows = (await eraseOrganizationSchema(tx, organizationId, "hub")) + (await eraseOrganizationSchema(tx, organizationId, "core"));
  return { rows: rows + 1, identitySubjects: await eraseOrganizationIdentity(tx, organizationId, team) };
}
