// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { bigint, boolean, date, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const hubSchema = pgSchema("hub");

export const roleEnum = hubSchema.enum("role", ["owner", "member", "client", "admin"]);
export const languageEnum = hubSchema.enum("language", ["fr", "en"]);
// Valeurs réglementaires fixes (CLAUDE.md §2.5 : pas une liste
// personnalisable par organisation, au même titre que roleEnum).
export const legalFormEnum = hubSchema.enum("legal_form", [
  "ei",
  "eirl",
  "eurl",
  "sarl",
  "sas",
  "sasu",
  "sa",
  "auto_entrepreneur",
  "autre",
]);
export const metierEnum = hubSchema.enum("metier", ["wedding_planner", "event_agency", "autre"]);
export const vatRegimeEnum = hubSchema.enum("vat_regime", ["franchise", "assujetti"]);

export const organizations = hubSchema.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  language: languageEnum("language").notNull().default("fr"),
  // Facultatif (PRD HUB-03) : une organisation peut être créée avant
  // d'avoir un SIRET (prospect, structure en cours de création).
  siret: text("siret"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Invitation du titulaire par l'Admin (PRD HUB-03) : valable 7 jours
// (proposé), un seul usage (acceptedAt posé à la première utilisation).
export const invitations = hubSchema.table("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = hubSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nul pour le rôle admin (opérateur de la suite, sans organisation).
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  // Choix explicite dans le profil (HUB-04) ; nul = pas encore choisi,
  // suit le cookie de langue du navigateur (apps/symbola/middleware.ts).
  language: languageEnum("language"),
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  // Verrouillage de compte (PRD HUB-01) : 5 mots de passe faux d'affilée
  // bloquent la connexion 15 min, un e-mail part au titulaire. Remis à
  // zéro à chaque connexion réussie.
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  // AIDE-04 : masque la liste « premiers pas » du tableau de bord,
  // choix explicite de l'utilisateur.
  firstStepsHidden: boolean("first_steps_hidden").notNull().default(false),
  // RGPD-05 : dernière connexion réussie (mot de passe validé) ; nulle pour
  // un compte créé avant le lot 6 : sa date de création fait foi (décision
  // de Julien du 02/11/2026).
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// AIDE-01 : une visite guidée se relance à volonté, mais ne s'affiche
// automatiquement qu'à la première ouverture d'un module — une ligne ici
// = déjà vue au moins une fois.
export const userTourSeen = hubSchema.table(
  "user_tour_seen",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    moduleKey: text("module_key").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleKey] })],
);

// Lot 9 — mot de passe oublié : lien à usage unique et de courte durée.
// Seul le hachage du jeton est stocké (comme les sessions et invitations) ;
// usedAt posé à la première utilisation. Table d'identité : pas de RLS,
// isolation assurée par packages/auth (ADR 0013).
export const passwordResets = hubSchema.table("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 10 (AIDE-05 à AIDE-07, HUB-11) — progression de chaque compte dans
// l'aide : visites focus et tutoriels. itemKey = « tour:<écran> » ou
// « tutorial:<clé> ». step = étape où reprendre (visite mise de côté,
// tutoriel en cours). Aucune donnée d'événement ici : la clé d'un élément
// d'aide, un état et des dates. Remplace hub.user_tour_seen (lot 1), dont les
// lignes sont reprises comme visites terminées.
export const helpProgressStatusEnum = hubSchema.enum("help_progress_status", ["started", "postponed", "completed"]);

export const helpProgress = hubSchema.table(
  "help_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    status: helpProgressStatusEnum("status").notNull(),
    step: integer("step").notNull().default(0),
    // Tutoriel (AIDE-06) : identifiants des données d'exemple qu'il a créées
    // (événement fictif, modèle…), pour reprendre et nettoyer. Jamais de
    // contenu.
    context: jsonb("context").$type<Record<string, string>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itemKey] })],
);

export const sessions = hubSchema.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  // Un utilisateur au rôle professionnel doit repasser son code TOTP à
  // chaque nouvelle session (pas seulement à la création du compte) —
  // mfaVerified distingue une session « mot de passe validé » d'une
  // session pleinement authentifiée pour les rôles professionnels.
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Activation d'un module par organisation (PRD HUB-03). Pas de ligne =
// activé par défaut (absence = « jamais désactivé »), pour qu'un nouveau
// module n'ait besoin d'aucune migration de données pour être actif
// partout. Désactiver un module ne supprime jamais ses données.
export const organizationModules = hubSchema.table(
  "organization_modules",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    moduleKey: text("module_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.moduleKey] })],
);

// Fiche entreprise (PRD ONB-01) : une ligne par organisation, remplie
// progressivement (questionnaire interruptible/reprenable) — toute
// colonne peut rester nulle tant qu'elle n'a pas été répondue.
// completedAt nul = questionnaire pas encore terminé.
export const organizationProfiles = hubSchema.table("organization_profiles", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  siren: text("siren"),
  address: text("address"),
  // Clé de l'objet dans le stockage privé (@symbola/files), jamais l'URL
  // directement — même patron que les pièces jointes du module hello.
  logoKey: text("logo_key"),
  legalForm: legalFormEnum("legal_form"),
  metier: metierEnum("metier"),
  metierPrecision: text("metier_precision"),
  vatRegime: vatRegimeEnum("vat_regime"),
  // Taux par défaut en centièmes de point (2000 = 20,00 %), utilisé
  // seulement si vatRegime = "assujetti".
  vatRateDefaultBasisPoints: integer("vat_rate_default_basis_points"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Lot 12 (ONB-03) : assistant de démarrage — étape en cours (1 à 6) et
  // fin ; tant qu'il n'est pas terminé, les menus métier sont verrouillés.
  setupStep: integer("setup_step").notNull().default(1),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  // Lot 13 (HUB-15) : délais de relance du bloc « À traiter » ; null =
  // valeur de départ (packages/starter-templates/src/follow-up.json).
  quoteFollowUpDays: integer("quote_follow_up_days"),
  prospectFollowUpDays: integer("prospect_follow_up_days"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Historique des changements de régime de TVA (PRD ONB-02) : chaque
// changement est daté d'effet, jamais appliqué rétroactivement aux
// documents déjà émis (devis/factures, lots suivants).
export const vatRegimeChanges = hubSchema.table("vat_regime_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  previousRegime: vatRegimeEnum("previous_regime"),
  newRegime: vatRegimeEnum("new_regime").notNull(),
  effectiveDate: date("effective_date").notNull(),
  changedByUserId: uuid("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Seuils de franchise en base de TVA (PRD ONB-02, « jamais une valeur
// dans le code ») : une seule ligne pour toute la plateforme, modifiable
// par l'Admin. Deux seuils (prestations de services / vente de
// marchandises), chacun peut rester nul tant que l'Admin ne l'a pas
// renseigné — aucune valeur par défaut codée en dur.
export const platformSettings = hubSchema.table("platform_settings", {
  id: integer("id").primaryKey().default(1),
  franchiseThresholdServicesCents: integer("franchise_threshold_services_cents"),
  franchiseThresholdGoodsCents: integer("franchise_threshold_goods_cents"),
  // Lot 5 (IMP-01) : limites de l'import, réglées par l'Admin. Valeurs de
  // départ (10 Mo et 5 000 lignes proposés par le PRD, import en cours gardé
  // 7 jours) portées par la base ; le code applicatif les lit, il n'en
  // suppose aucune.
  importMaxBytes: integer("import_max_bytes").notNull().default(10 * 1024 * 1024),
  importMaxRows: integer("import_max_rows").notNull().default(5000),
  importDraftRetentionDays: integer("import_draft_retention_days").notNull().default(7),
  // IMP-05 : délai pendant lequel un import confirmé reste annulable (90 jours
  // validés par Julien) ; ensuite les valeurs gardées pour l'annulation sont
  // effacées, le journal reste.
  importUndoRetentionDays: integer("import_undo_retention_days").notNull().default(90),
  // Lot 14c (IMP-08) : nombre de fiches événement PDF déposées à la fois.
  importMaxSheets: integer("import_max_sheets").notNull().default(50),
  // Lot 6 (RGPD-02) : durée pendant laquelle les fichiers d'un export RGPD
  // restent téléchargeables (7 jours, comme un import en cours), puis effacés.
  privacyExportRetentionDays: integer("privacy_export_retention_days").notNull().default(7),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Journal d'audit des actions Admin (PRD HUB-03, « qui, quoi, quand »).
// targetOrganizationId nul pour une action qui ne vise aucune organisation
// précise.
export const auditLog = hubSchema.table("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetOrganizationId: uuid("target_organization_id").references(() => organizations.id),
  // Lot 9 : compte visé par une action d'assistance (réinitialisation de la
  // double authentification). Nul pour les actions sur une organisation.
  // SET NULL : supprimer un compte (RGPD) ne bute jamais sur le journal.
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 5 — import de données (PRD §7, ADR 0022). Un import en cours garde les
// lignes lues et neutralisées du fichier (le fichier lui-même n'est jamais
// stocké) jusqu'à sa confirmation, son abandon ou sa date d'expiration ;
// confirmé, il devient l'entrée du journal (fichier, auteur, date, résultat).
// Données métier d'une organisation : RLS forcée, comme les tables des modules.
export const importEntityTypeEnum = hubSchema.enum("import_entity_type", [
  "events",
  "tasks",
  "budget_lines",
  "catalog_items",
  "vendor_slots",
  "prospect_sources",
  "loss_reasons",
  "payment_methods",
  "vendors",
  "event_sheets",
]);

export type ImportColumnChoice = {
  columnIndex: number;
  // Clé d'un champ (packages/contracts, IMPORT_FIELDS), ou null.
  fieldKey: string | null;
  // `none` : sans équivalent, à traiter au rapport des écarts (IMP-04), qui
  // le change en `free` (gardée en champ libre sur la fiche) ou `ignore`.
  target: "field" | "none" | "free" | "ignore";
  confidence: number;
  confirmed: boolean;
  // IMP-04 : `free` ou `ignore` décidé au rapport des écarts (la colonne
  // reste modifiable à cette étape).
  decidedAtGaps?: boolean;
};

// Élément existant rapproché d'une ligne (identifiant opaque d'un module) :
// la ligne le mettra à jour au lieu d'en créer un doublon (IMP-05).
export type ImportMatch = {
  rowIndex: number;
  candidateId: string;
  score: number;
  status: "proposed" | "accepted" | "refused";
  // Ajouté à la main par la planner (pas une proposition de l'app).
  manual: boolean;
};

// Tâche ou ligne de budget : événement existant auquel la ligne se rattache
// (null : introuvable ou ambigu, la ligne sera rejetée).
export type ImportRowEvent = { rowIndex: number; eventId: string | null; score: number };

// Lot 14 (décision N) — type de prestataire lu dans le fichier : rapproché
// d'un type du carnet (`typeId`, proposé ou choisi) ou créé à la
// confirmation (`typeId` null).
export type ImportVendorTypeChoice = {
  label: string;
  rowCount: number;
  typeId: string | null;
  score: number;
  manual: boolean;
};

export type ImportMatching = {
  matches: ImportMatch[];
  rowEvents: ImportRowEvent[];
  vendorTypes?: ImportVendorTypeChoice[];
  // Lot 14c (IMP-08) : fiche du même lot qui décrit le même événement, et
  // statut choisi par la planner dans l'aperçu (décision J).
  duplicates?: { rowIndex: number; sameAsRowIndex: number }[];
  rowStatuses?: { rowIndex: number; status: string }[];
};

export const importStatusEnum = hubSchema.enum("import_status", ["draft", "applied", "undone", "cancelled"]);

export const imports = hubSchema.table("imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Identifiants opaques, comme dans les tables des modules : pas de clé
  // étrangère vers les tables d'identité.
  organizationId: uuid("organization_id").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  entityType: importEntityTypeEnum("entity_type").notNull(),
  status: importStatusEnum("status").notNull().default("draft"),
  fileName: text("file_name").notNull(),
  fileFormat: text("file_format").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  encoding: text("encoding"),
  delimiter: text("delimiter"),
  headerRowIndex: integer("header_row_index").notNull(),
  headers: jsonb("headers").$type<string[]>().notNull(),
  // Lignes en attente ; effacées (null) dès que l'import est confirmé, abandonné ou expiré.
  rows: jsonb("rows").$type<string[][] | null>(),
  sourceLineNumbers: jsonb("source_line_numbers").$type<number[] | null>(),
  rowCount: integer("row_count").notNull(),
  neutralizedCells: integer("neutralized_cells").notNull().default(0),
  // IMP-02 : choix validés pour chaque colonne (champ, « sans équivalent » ou
  // ignorée) ; null tant que l'étape « colonnes » n'est pas faite.
  mapping: jsonb("mapping").$type<ImportColumnChoice[] | null>(),
  // IMP-03 : rapprochements proposés puis décidés ; null tant qu'ils n'ont
  // pas été calculés, remis à null quand les colonnes changent.
  matching: jsonb("matching").$type<ImportMatching | null>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  // IMP-05 : confirmation (journal : résultat chiffré) et annulation.
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  result: jsonb("result").$type<ImportResult | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ImportResult = { created: number; updated: number; unchanged: number; rejected: number };

// IMP-05 — un élément écrit par un import confirmé : de quoi l'annuler
// (valeurs précédentes) et détecter une modification à la main depuis
// (valeurs écrites). Identifiant d'élément opaque, propre au module qui l'a
// écrit. Valeurs effacées passé le délai d'annulation ; la ligne reste au
// journal.
export const importItems = hubSchema.table("import_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  importId: uuid("import_id")
    .notNull()
    .references(() => imports.id),
  // Ordre d'écriture : l'annulation le parcourt à l'envers.
  position: integer("position").notNull(),
  module: text("module").notNull(),
  kind: text("kind").notNull(),
  elementId: uuid("element_id").notNull(),
  action: text("action").$type<"created" | "updated">().notNull(),
  previous: jsonb("previous").$type<Record<string, unknown> | null>(),
  written: jsonb("written").$type<Record<string, unknown> | null>(),
  undoOutcome: text("undo_outcome").$type<"undone" | "kept_modified" | "kept_in_use" | "missing" | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 15 (IMP-10, GEO-01) — traitement de fond suivi d'un import : lecture
// des fiches PDF déposées (gardées chiffrées dans le stockage privé le temps de
// la lecture, puis supprimées) ou placement sur la carte des prestataires
// importés. Avancé pas à pas par le worker du serveur, reprend après un
// redémarrage. Données d'une organisation : RLS forcée.
export type ImportJobKind = "read_sheets" | "place_vendors";
export type ImportJobStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type ImportJobPayload =
  // objectKey / secret : fiche chiffrée dans le stockage privé et sa clé, effacées
  // une fois la fiche lue ; rejection : motif d'une fiche refusée dès le dépôt.
  | { kind: "read_sheets"; files: { fileName: string; objectKey: string | null; secret: string | null; rejection?: string }[]; today: string }
  | { kind: "place_vendors"; vendorIds: string[] };
export type ImportJobResult = { placed?: number; unplaced?: number };

export const importJobs = hubSchema.table("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  importId: uuid("import_id")
    .notNull()
    .references(() => imports.id),
  kind: text("kind").$type<ImportJobKind>().notNull(),
  status: text("status").$type<ImportJobStatus>().notNull().default("pending"),
  total: integer("total").notNull(),
  done: integer("done").notNull().default(0),
  payload: jsonb("payload").$type<ImportJobPayload>().notNull(),
  result: jsonb("result").$type<ImportJobResult>().notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// Lot 6 (RGPD-04) — demandes d'exercice de droits reçues par la titulaire :
// type, personne concernée (libellé saisi), réception, échéance légale
// (un mois, trois une fois prolongée avec un motif), statut. Données métier
// d'une organisation : RLS forcée.
export const privacyRequestTypeEnum = hubSchema.enum("privacy_request_type", [
  "access",
  "rectification",
  "erasure",
  "portability",
  "objection",
]);

export const privacyRequestStatusEnum = hubSchema.enum("privacy_request_status", ["open", "extended", "closed"]);

export const privacyRequests = hubSchema.table("privacy_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  type: privacyRequestTypeEnum("type").notNull(),
  personLabel: text("person_label").notNull(),
  receivedOn: date("received_on").notNull(),
  dueOn: date("due_on").notNull(),
  status: privacyRequestStatusEnum("status").notNull().default("open"),
  extensionReason: text("extension_reason"),
  extendedAt: timestamp("extended_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 6 (RGPD-04/05) — réglages RGPD d'une organisation, chargés depuis le
// modèle de départ (packages/starter-templates) à la première lecture, puis
// modifiables par la titulaire (CLAUDE.md §2.5).
export const privacySettings = hubSchema.table("privacy_settings", {
  organizationId: uuid("organization_id").primaryKey(),
  requestAlertDays: integer("request_alert_days").notNull(),
  prospectRetentionMonths: integer("prospect_retention_months").notNull(),
  clientRetentionMonths: integer("client_retention_months").notNull(),
  accountingRetentionMonths: integer("accounting_retention_months").notNull(),
  inactiveAccountMonths: integer("inactive_account_months").notNull(),
  // RGPD-03 : durée de conservation d'un devis signé (preuve du contrat).
  signedQuoteRetentionMonths: integer("signed_quote_retention_months").notNull().default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 6 (RGPD-02, ADR 0023) — exports des données d'une personne (droits
// d'accès et de portabilité). Les fichiers (PDF et archive ZIP) sont dans le
// stockage privé, téléchargés par un lien signé de courte durée ; effacés à
// l'expiration par la purge horaire, la ligne reste comme trace (sans donnée
// personnelle : identifiants et compte de fiches seulement).
export const privacyExports = hubSchema.table("privacy_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requestId: uuid("request_id").references(() => privacyRequests.id),
  recordCount: integer("record_count").notNull(),
  pdfKey: text("pdf_key").notNull(),
  archiveKey: text("archive_key").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
});

// Lot 6 (RGPD-03, ADR 0023) — exécution d'une demande d'oubli : le sort de
// chaque fiche (sans libellé : identifiants opaques, nature, sort, motif
// légal et date de fin) et l'accusé de chaque module. La demande n'est close
// que quand tous les modules ont répondu ; la preuve PDF est rendue depuis
// cette ligne. Aucune donnée personnelle.
export const privacyErasureStatusEnum = hubSchema.enum("privacy_erasure_status", ["pending", "partial", "completed"]);

export type PrivacyErasureItem = {
  module: string;
  kind: string;
  recordId: string;
  fate: "deleted" | "anonymized" | "kept";
  legalBasis: "accounting" | "contract_proof" | null;
  keptUntil: string | null;
};

export type PrivacyErasureAck = { module: string; status: "ok" | "failed"; at: string; count: number };

export const privacyErasures = hubSchema.table("privacy_erasures", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => privacyRequests.id),
  status: privacyErasureStatusEnum("status").notNull().default("pending"),
  items: jsonb("items").$type<PrivacyErasureItem[]>().notNull(),
  acks: jsonb("acks").$type<PrivacyErasureAck[]>().notNull().default([]),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Lot 6 (RGPD-05, ADR 0024) — purges mensuelles validées par la titulaire :
// chaque ligne (règle de conservation, référence opaque, échéance) est
// purgée ou exclue avec un motif ; accusés des modules comme pour l'oubli.
// Les libellés (noms) ne sont jamais copiés ici : recalculés à l'affichage.
export type PrivacyPurgeLine = {
  key: string;
  rule: "prospect" | "client" | "inactive_account" | "accounting_document" | "signed_quote";
  dueOn: string;
  outcome: "purged" | "excluded";
  exclusionReason: string | null;
};

export const privacyPurges = hubSchema.table("privacy_purges", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  // Mois de la purge (AAAA-MM, heure de Paris).
  period: text("period").notNull(),
  status: privacyErasureStatusEnum("status").notNull().default("pending"),
  lines: jsonb("lines").$type<PrivacyPurgeLine[]>().notNull(),
  items: jsonb("items").$type<PrivacyErasureItem[]>().notNull(),
  acks: jsonb("acks").$type<PrivacyErasureAck[]>().notNull().default([]),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Lot 13 (HUB-18, ADR 0033) — exécutions du script de sauvegarde
// (infra/backup/backup.sh), signalées par une requête SQL dans le conteneur
// PostgreSQL de l'environnement, avec le rôle d'administration du script.
// Aucune donnée d'organisation : seul l'Admin la lit (console, Santé) ; le
// rôle applicatif n'a que la lecture.
export const backupRunStatusEnum = hubSchema.enum("backup_run_status", ["running", "succeeded", "failed"]);

export const backupRuns = hubSchema.table("backup_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: backupRunStatusEnum("status").notNull().default("running"),
  // Taille ajoutée au dépôt restic par cette sauvegarde, en octets.
  sizeBytes: bigint("size_bytes", { mode: "number" }),
});
