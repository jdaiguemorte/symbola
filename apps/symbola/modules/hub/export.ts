// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du hub dans l'export complet de l'organisation
// (contrat export/v1) : l'organisation, son profil et son logo, ses modules, ses changements de
// régime de TVA, son registre RGPD (réglages, demandes, exports, effacements, purges), son équipe
// (adresse et rôle, sans identifiant de connexion : l'identité est chez le fournisseur
// d'identité, ADR 0067) et son journal d'activité (décision D3, en lecture). Exposé par
// service.ts.
import { z } from "zod";
import { listTeam } from "@symbola/auth";
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { auditEntries } from "@symbola/db/schema/core";
import {
  contactMembers,
  contactNotes,
  contacts,
  contactDuplicates,
  contactMerges,
  emailTemplates,
  membershipRoleEnum,
  messageTemplates,
  messageTemplateVersions,
  organizationModules,
  organizationProfiles,
  organizations,
  privacyErasures,
  privacyExports,
  privacyPurges,
  privacyRequests,
  privacySettings,
  vatRegimeChanges,
} from "@symbola/db/schema/hub";

export const HUB_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  // L'organisation elle-même : son identifiant reste (il relie l'archive à l'espace d'origine).
  { table: organizations, organizationField: "id" },
  { table: organizationProfiles, idField: "organizationId", files: ["logoKey"] },
  { table: organizationModules, idField: "moduleKey" },
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
  { table: privacySettings, idField: "organizationId" },
  { table: privacyRequests },
  // Trace des exports RGPD : leurs fichiers, effacés à l'expiration, ne sont pas repris.
  { table: privacyExports, omit: ["pdfKey", "archiveKey"] },
  { table: privacyErasures },
  { table: privacyPurges },
  // Journal d'activité (HUB-16) : les lignes de l'organisation, sans celles des essais ni celles
  // de l'exploitation de Symbola (sans organisation).
  { table: auditEntries, name: "activity_journal", demoField: "isDemo" },
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
