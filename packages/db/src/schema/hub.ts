// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgSchema, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const hubSchema = pgSchema("hub");

export const languageEnum = hubSchema.enum("language", ["fr", "en"]);
// Valeurs réglementaires fixes (CLAUDE.md §2.5 : pas une liste
// personnalisable par organisation).
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
  // Facultatif (PRD PRD-HUB-03) : une organisation peut être créée avant
  // d'avoir un SIRET (prospect, structure en cours de création).
  siret: text("siret"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

// Lot 33 (HUB-02, HUB-03) : rôle d'une adhésion, et de l'invitation qui la crée (lot 33b, D12).
export const membershipRoleEnum = hubSchema.enum("membership_role", ["owner", "member"]);

// Invitation du titulaire par l'Admin (PRD PRD-HUB-03) : valable 7 jours
// (proposé), un seul usage (acceptedAt posé à la première utilisation).
// Lot 33b (HUB-03, D12) : la Propriétaire invite aussi une Planner (rôle member).
export const invitations = hubSchema.table("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: membershipRoleEnum("role").notNull().default("owner"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("invitations_organization_idx").on(table.organizationId)]);

export const users = hubSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  // Lot 33 (SEC-01, ADR 0067) : identifiant du compte chez le fournisseur d'identité (« sub »).
  idpSubject: text("idp_subject").unique(),
  // Lot 33 (Q30, SEC-09) : compte d'exploitation, sans adhésion ni accès aux données métier.
  operator: boolean("operator").notNull().default(false),
  // Choix explicite dans le profil (PRD-HUB-04) ; nul = pas encore choisi,
  // suit le cookie de langue du navigateur (apps/symbola/middleware.ts).
  language: languageEnum("language"),
  // AIDE-04 : masque la liste « premiers pas » du tableau de bord,
  // choix explicite de l'utilisateur.
  firstStepsHidden: boolean("first_steps_hidden").notNull().default(false),
  // RGPD-05 : dernière connexion réussie (mot de passe validé) ; nulle pour
  // un compte créé avant le lot 6 : sa date de création fait foi (décision
  // de Julien du 02/11/2026).
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Lot 24b (SEC-06, décision D3) : accès retiré par la titulaire. Le compte ne
  // se connecte plus ; ses sessions et appareils de confiance sont supprimés.
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
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

// Lot 10 (AIDE-05 à AIDE-07, L10-HUB-11) — progression de chaque compte dans
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

// Lot 33 (HUB-02, HUB-03, décision D6) — adhésion d'un compte à une organisation, avec son rôle.
// Un compte peut en avoir plusieurs et passer de l'une à l'autre ; l'organisation active est
// portée par la session et contrôlée à chaque requête. Table d'identité : pas de RLS,
// isolation assurée par packages/auth (ADR 0013), comme hub.users. disabledAt : accès retiré
// par la Propriétaire (lot 24b), pour cette organisation seulement.

export const memberships = hubSchema.table(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: membershipRoleEnum("role").notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    unique("memberships_user_organization_unique").on(table.userId, table.organizationId),
    index("memberships_organization_idx").on(table.organizationId),
  ],
);

export const sessions = hubSchema.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  // Lot 33 (HUB-02) : organisation active de la session ; nulle pour l'Exploitation.
  organizationId: uuid("organization_id").references(() => organizations.id),
  tokenHash: text("token_hash").notNull().unique(),
  // Lot 33 (D4) : la session a été ouverte avec une double authentification (déclaration acr
  // du fournisseur d'identité).
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("sessions_organization_idx").on(table.organizationId)]);

// Activation d'un module par organisation (PRD PRD-HUB-03). Pas de ligne =
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
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
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
  // directement (patron du lot 0, SOC-08).
  logoKey: text("logo_key"),
  // Lot 37b (DOC-12, D13) : taille du logo, pour le relevé de stockage ; lue une fois au stockage
  // pour un logo déposé avant le lot.
  logoSizeBytes: integer("logo_size_bytes"),
  legalForm: legalFormEnum("legal_form"),
  metier: metierEnum("metier"),
  metierPrecision: text("metier_precision"),
  vatRegime: vatRegimeEnum("vat_regime"),
  // Taux par défaut en centièmes de point (2000 = 20,00 %), utilisé
  // seulement si vatRegime = "assujetti".
  vatRateDefaultBasisPoints: integer("vat_rate_default_basis_points"),
  // Lot 33b (HUB-09, D11) : réponses du questionnaire d'accueil, en clés des listes de départ
  // (packages/starter-templates, onboarding.json) ; elles règlent l'ordre de la prise en main.
  annualEventVolume: text("annual_event_volume"),
  replacedTools: text("replaced_tools").array().notNull().default(sql`'{}'::text[]`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Lot 12 (ONB-03) : assistant de démarrage — étape en cours et fin. Lot 33b (HUB-09, D9) :
  // questionnaire d'accueil en cinq questions ; les menus ne sont plus verrouillés.
  setupStep: integer("setup_step").notNull().default(1),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  // Lot 13 (L13-HUB-15) : délais de relance du bloc « À traiter » ; null =
  // valeur de départ (packages/starter-templates/src/follow-up.json).
  quoteFollowUpDays: integer("quote_follow_up_days"),
  prospectFollowUpDays: integer("prospect_follow_up_days"),
  // Lot 17 (DEV-07) : coordonnées et mentions imprimées sur les devis et les
  // factures. Le SIRET reste dans organizations.siret (saisi à la création).
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  vatNumber: text("vat_number"),
  // RCS ou RM, en texte libre (« RCS Lyon 123 456 789 »).
  registration: text("registration"),
  shareCapitalCents: bigint("share_capital_cents", { mode: "number" }),
  // Lot 31a (JUR-09, décision D4) : informations du professionnel reprises sur les documents.
  insurer: text("insurer"),
  insurancePolicy: text("insurance_policy"),
  insuranceCoverage: text("insurance_coverage"),
  mediatorName: text("mediator_name"),
  mediatorUrl: text("mediator_url"),
  generalTerms: text("general_terms"),
  // Lot 41 (FAC-10, JUR-02 ; D7) : adresse structurée du vendeur, exigée par le fichier Factur-X ;
  // « address » en devient la ligne. Code pays ISO 3166-1 (FR par défaut).
  postalCode: text("postal_code"),
  city: text("city"),
  countryCode: text("country_code").notNull().default("FR"),
  // Lot 41 (JUR-02, D10) : option pour le paiement de la TVA d'après les débits, datée comme le
  // régime de TVA (null : non renseignée ; vrai à partir de vat_on_debits_from). Réservée au régime
  // assujetti, figée sur chaque facture à la date de son émission.
  vatOnDebits: boolean("vat_on_debits"),
  vatOnDebitsFrom: date("vat_on_debits_from"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  check("organization_profiles_postal_code_check", sql`${table.postalCode} is null or char_length(${table.postalCode}) between 1 and 16`),
  check("organization_profiles_city_check", sql`${table.city} is null or char_length(${table.city}) between 1 and 120`),
  check("organization_profiles_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
  check("organization_profiles_insurer_check", sql`${table.insurer} is null or char_length(${table.insurer}) between 1 and 120`),
  check("organization_profiles_insurance_policy_check", sql`${table.insurancePolicy} is null or char_length(${table.insurancePolicy}) between 1 and 80`),
  check("organization_profiles_insurance_coverage_check", sql`${table.insuranceCoverage} is null or char_length(${table.insuranceCoverage}) between 1 and 200`),
  check("organization_profiles_mediator_name_check", sql`${table.mediatorName} is null or char_length(${table.mediatorName}) between 1 and 160`),
  check("organization_profiles_mediator_url_check", sql`${table.mediatorUrl} is null or char_length(${table.mediatorUrl}) between 1 and 300`),
  check("organization_profiles_general_terms_check", sql`${table.generalTerms} is null or char_length(${table.generalTerms}) between 1 and 20000`),
  check("organization_profiles_annual_event_volume_check", sql`${table.annualEventVolume} is null or char_length(${table.annualEventVolume}) between 1 and 40`),
  check("organization_profiles_replaced_tools_check", sql`cardinality(${table.replacedTools}) <= 10`),
]);

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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("vat_regime_changes_organization_idx").on(table.organizationId)]);

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
  // Lot 31a (FAC-07, JUR-01, décision D4) : mentions requises sur les devis, factures et
  // avoirs, réglées par l'Admin (valeurs réglementaires) ; null : la liste de départ de
  // packages/starter-templates, à valider par l'expert-comptable.
  requiredMentions: jsonb("required_mentions"),
  // Lot 6 (RGPD-02) : durée pendant laquelle les fichiers d'un export RGPD
  // restent téléchargeables (7 jours, comme un import en cours), puis effacés.
  privacyExportRetentionDays: integer("privacy_export_retention_days").notNull().default(7),
  // Lot 23 (SEC-19, décision D5) : durée de conservation des adresses IP des
  // connexions (hub.connection_traces). 12 mois proposés, dans la fourchette
  // de 6 mois à 1 an recommandée par la CNIL pour les journaux ; à confirmer
  // par le DPO (fiche, question 11).
  connectionTraceRetentionMonths: integer("connection_trace_retention_months").notNull().default(12),
  // Lot 24b (SEC-22, décision D5) : plafond d'e-mails envoyés par organisation
  // et par heure (signataires, mariés invités), réglé par l'Admin.
  mailHourlyCap: integer("mail_hourly_cap").notNull().default(100),
  // Lot 35a (HUB-13, décision D4) : durée pendant laquelle l'archive d'un export complet de
  // l'organisation reste téléchargeable (7 jours), puis effacée du stockage.
  organizationExportRetentionDays: integer("organization_export_retention_days").notNull().default(7),
  // Lot 41 (GC-03, D12) : vérifications de l'assistant de conformité désactivées par l'Admin
  // ({ "disabled": ["clé", …] }) ; null : toutes celles de la liste de départ.
  complianceChecks: jsonb("compliance_checks"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

// Lot 23 (ARC-16, ADR 0060) : l'ancien journal des actions Admin
// (hub.audit_log) est remplacé par le journal commun core.audit_entries.

// Lot 23 (SEC-19, décision D5, ADR 0060) : adresse IP d'une connexion, à part
// du journal commun (une ligne par ligne de connexion du journal, par son
// identifiant, sans clé étrangère entre schémas). Donnée personnelle : la
// titulaire ne la voit pas ; elle sert à l'enquête de sécurité. Le rôle
// applicatif y écrit mais ne lit que created_at (purge) ; la lecture passe
// par un accès d'exploitation tracé (SEC-09). Purgée après
// platform_settings.connection_trace_retention_months.
export const connectionTraces = hubSchema.table(
  "connection_traces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auditEntryId: uuid("audit_entry_id").notNull(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("connection_traces_created_at_idx").on(table.createdAt)],
);

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
  // Lot 36b (HUB-14, D11) : contacts du hub.
  "contacts",
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
  // Lot 36b (DAT-12) : contact rapproché par son adresse e-mail (refuser, c'est ignorer la ligne :
  // jamais deux contacts pour une adresse) ou par son nom (refuser, c'est créer un contact).
  reason?: "email" | "name";
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
  // Lot 16 (IMP-12) : ce que devient le libellé. Absent (imports d'avant le
  // lot 16) : `typeId`, ou un type créé sous le libellé du fichier.
  target?: ImportVendorTypeTarget;
};

// Lot 16 (IMP-12, ADR 0040) — un type du carnet ; un type de départ de la
// famille, créé une seule fois pour tous ses synonymes ; un type créé sous le
// libellé du fichier, dans une famille ou « à classer » ; ou aucun type (la
// fiche est « à classer », le libellé gardé en champ importé).
export type ImportVendorTypeTarget =
  | { kind: "existing"; typeId: string }
  | { kind: "starter"; starterKey: string }
  | { kind: "new"; familyId: string | null }
  | { kind: "none" };

export type ImportMatching = {
  matches: ImportMatch[];
  rowEvents: ImportRowEvent[];
  vendorTypes?: ImportVendorTypeChoice[];
  // Lot 14c (IMP-08) : fiche du même lot qui décrit le même événement, et
  // statut choisi par la planner dans l'aperçu (décision J).
  duplicates?: { rowIndex: number; sameAsRowIndex: number }[];
  rowStatuses?: { rowIndex: number; status: string }[];
  // Lot 16 (IMP-11) : étapes vérifiées par la planner (« Continuer »). Lot 36b : « rows », les
  // lignes à écarter d'un import de contacts.
  reviewed?: { types?: boolean; matches?: boolean; rows?: boolean };
  // Lot 36b (D11, SC-10) : lignes écartées selon la valeur d'une colonne (« Catégorie » vaut
  // « prestataire ») ; valeurs comparées sans casse, accents ni espaces autour.
  rowFilter?: { columnIndex: number; excluded: string[] };
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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("imports_organization_idx").on(table.organizationId)]);

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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("import_items_organization_idx").on(table.organizationId)]);

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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("import_jobs_organization_idx").on(table.organizationId)]);

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
  // Lot 18 (RGPD-07, ADR 0047) : dossier de la demande. Rectification ou
  // opposition menée à la main (l'oubli et l'export ont leurs propres traces),
  // puis réponse envoyée à la personne : la clôture exige les deux.
  actionDoneAt: timestamp("action_done_at", { withTimezone: true }),
  responseSentAt: timestamp("response_sent_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("privacy_requests_organization_idx").on(table.organizationId)]);

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
  // RGPD-03 : durée de conservation d'un devis signé (preuve du contrat). Lot 31b (réponse 3 de
  // l'avocat, D16) : dix ans pour un contrat électronique de 120 € et plus et son dossier de preuve.
  signedQuoteRetentionMonths: integer("signed_quote_retention_months").notNull().default(120),
  // RGPD-09 (lot 19, ADR 0048) : durée de la preuve d'une demande close, après
  // laquelle la purge mensuelle propose d'anonymiser le nom de la personne.
  requestProofRetentionMonths: integer("request_proof_retention_months").notNull().default(60),
  // Lot 26a (RGP-03) : mention d'information des pages à lien personnel, au nom
  // de l'organisation ; vide, le texte de départ (packages/starter-templates).
  linkPrivacyNotice: text("link_privacy_notice"),
  // Lot 49 (RGP-08, D9 ; réponses 2 et 3 de la DPO) : purge des données d'invités, comptée depuis
  // le dernier jour de l'évènement (ou son annulation) : régimes et allergies, puis le reste ; un
  // seul report, motivé, borné. Valeurs de départ dans privacy-settings.json.
  guestRetentionDays: integer("guest_retention_days").notNull().default(30),
  guestDietRetentionDays: integer("guest_diet_retention_days").notNull().default(7),
  guestPurgeMaxPostponeDays: integer("guest_purge_max_postpone_days").notNull().default(90),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("privacy_exports_organization_idx").on(table.organizationId)]);

// Lot 36a (CRM-03, DAT-12, ARC-03 ; décisions D2 à D4 ; ADR 0069) — le contact unique, dans le
// noyau du hub : une personne, un foyer ou une entreprise, qui n'existe qu'une fois dans
// l'organisation, quel que soit le nombre d'apps. Les modules ne gardent que son identifiant
// (clients d'un évènement, liens personnels, signataires), sans clé étrangère entre schémas.
// Une adresse e-mail n'appartient qu'à un contact (DAT-12) ; elle est rangée en minuscules.
// Données métier d'une organisation : RLS forcée.
export const CONTACT_KINDS = ["person", "household", "company"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const contacts = hubSchema.table(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    kind: text("kind", { enum: CONTACT_KINDS }).notNull().default("person"),
    // Personne : prénom et nom ; foyer ou entreprise : un nom.
    firstName: text("first_name"),
    lastName: text("last_name"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    addressLine: text("address_line"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country"),
    // D8 : l'adresse de facturation, reprise à l'envoi en signature.
    billingAddress: text("billing_address"),
    // Lot 36b (CRM-03, SC-11) : identifiants d'une entreprise, reportés sur le devis et la
    // facture : SIREN (9 chiffres) ou SIRET (14 chiffres), numéro de TVA intracommunautaire.
    companyIdNumber: text("company_id_number"),
    vatNumber: text("vat_number"),
    // AIDE-02, ADR 0008 : contact d'un essai guidé, purgé avec lui.
    isDemo: boolean("is_demo").notNull().default(false),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("contacts_organization_idx").on(table.organizationId),
    // Lot 39a (ADR 0073) : un contact à la corbeille ne retient pas son adresse.
    uniqueIndex("contacts_email_idx").on(table.organizationId, table.email).where(sql`email is not null and deleted_at is null`),
    check("contacts_kind_check", sql`${table.kind} in ('person', 'household', 'company')`),
    check("contacts_name_check", sql`case when ${table.kind} = 'person' then ${table.firstName} is not null else ${table.name} is not null end`),
    check("contacts_email_check", sql`${table.email} is null or (${table.email} = lower(btrim(${table.email})) and ${table.email} <> '')`),
    check(
      "contacts_company_ids_check",
      sql`(${table.kind} = 'company' or (${table.companyIdNumber} is null and ${table.vatNumber} is null)) and (${table.companyIdNumber} is null or ${table.companyIdNumber} ~ '^[0-9]{9}([0-9]{5})?$') and (${table.vatNumber} is null or (${table.vatNumber} = upper(replace(${table.vatNumber}, ' ', '')) and ${table.vatNumber} <> ''))`,
    ),
  ],
);

// Lot 36b (CRM-03, D2) — les membres d'un foyer (un couple, une famille) ou d'une entreprise (ses
// interlocuteurs) : des personnes, avec un rôle libre (« conjoint », « assistante de direction »).
// Une personne peut appartenir à plusieurs foyers ou entreprises. Supprimer un contact retire ses
// liens. Données métier d'une organisation : RLS forcée.
export const contactMembers = hubSchema.table(
  "contact_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    // Le foyer ou l'entreprise.
    groupContactId: uuid("group_contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    // La personne.
    memberContactId: uuid("member_contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contact_members_organization_idx").on(table.organizationId),
    index("contact_members_member_idx").on(table.memberContactId),
    uniqueIndex("contact_members_pair_idx").on(table.groupContactId, table.memberContactId),
    check("contact_members_distinct_check", sql`${table.groupContactId} <> ${table.memberContactId}`),
    check("contact_members_role_check", sql`${table.role} is null or char_length(${table.role}) between 1 and 100`),
  ],
);

// Lot 36a (CRM-03, « notes ») : notes datées de la fiche d'un contact, avec leur auteur ; seul
// l'auteur retire la sienne.
export const contactNotes = hubSchema.table(
  "contact_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("contact_notes_organization_idx").on(table.organizationId),
    index("contact_notes_contact_idx").on(table.contactId),
    check("contact_notes_body_check", sql`char_length(${table.body}) between 1 and 2000`),
  ],
);

// Lot 35a (HUB-13, DAT-13, ADR 0068) — exports complets de l'organisation (contrat export/v1) :
// demandés par la Propriétaire (décision D5), préparés en arrière-plan (lib/export, décision D4),
// gardés le temps réglé par l'Admin, puis effacés du stockage ; la ligne reste comme trace, sans
// donnée personnelle (nombres de lignes par entité, taille). Un seul export en préparation à la
// fois par organisation. Une préparation interrompue (redémarrage) est reprise quand son
// battement (heartbeat_at) s'arrête. Données d'une organisation : RLS forcée.
export const ORGANIZATION_EXPORT_STATUSES = ["pending", "running", "ready", "failed"] as const;
export type OrganizationExportStatus = (typeof ORGANIZATION_EXPORT_STATUSES)[number];
export const ORGANIZATION_EXPORT_ERRORS = ["too_large", "failed"] as const;
export type OrganizationExportError = (typeof ORGANIZATION_EXPORT_ERRORS)[number];

export const organizationExports = hubSchema.table(
  "organization_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    status: text("status", { enum: ORGANIZATION_EXPORT_STATUSES }).notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    filesTotal: integer("files_total").notNull().default(0),
    filesDone: integer("files_done").notNull().default(0),
    missingFiles: integer("missing_files").notNull().default(0),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    entityCounts: jsonb("entity_counts").$type<Record<string, number>>().notNull().default({}),
    archiveKey: text("archive_key"),
    error: text("error", { enum: ORGANIZATION_EXPORT_ERRORS }),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("organization_exports_organization_idx").on(table.organizationId),
    uniqueIndex("organization_exports_active_idx").on(table.organizationId).where(sql`status in ('pending', 'running')`),
    check("organization_exports_status_check", sql`${table.status} in ('pending', 'running', 'ready', 'failed')`),
    check("organization_exports_error_check", sql`${table.error} is null or ${table.error} in ('too_large', 'failed')`),
    check("organization_exports_files_check", sql`${table.filesDone} >= 0 and ${table.filesTotal} >= 0 and ${table.missingFiles} >= 0`),
  ],
);

// Lot 38a (MSG-01 ; D3, D5, D6, ADR 0072) — modèles des e-mails que l'organisation adresse aux tiers
// (liens, rappels, signatures, programme), par nature et par langue : objet et texte à variables
// (« {{prénom}} »). Un modèle absent vaut le texte de départ (packages/starter-templates) ;
// « Revenir au texte de départ » supprime la ligne.
export const EMAIL_TEMPLATE_KINDS = [
  "client_link",
  "client_link_renewed",
  "vendor_link",
  "vendor_link_renewed",
  "task_reminder",
  // Lot 46 (RDV-03, ADR 0082) : rendez-vous, côté personne qui l'a pris.
  "appointment_confirmed",
  "appointment_reminder",
  "appointment_rescheduled",
  "appointment_cancelled",
  "quote_signature",
  "contract_signature",
  "order_first",
  "signed_copy",
  "program_published",
  // Lot 49 (INV-03, INV-04 ; D4, D10) : invitation à répondre et relance des invités.
  "guest_invitation",
  "guest_reminder",
  // Lot 44 (CRM-01 ; D7) : « Nouvelle demande de contact », à la titulaire, sans le message ni les
  // coordonnées du prospect.
  "prospect_form_received",
  // Lot 43 (FAC-02, FAC-08, FAC-09, FAC-15 ; D10) : proposition, relance avant expiration, RIB du
  // règlement, relance d'impayé.
  "proposal_sent",
  "proposal_expiry_reminder",
  "payment_details",
  "invoice_reminder",
] as const;

export const emailTemplates = hubSchema.table(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    kind: text("kind", { enum: EMAIL_TEMPLATE_KINDS }).notNull(),
    locale: text("locale").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("email_templates_organization_idx").on(table.organizationId),
    unique("email_templates_kind_locale_unique").on(table.organizationId, table.kind, table.locale),
    // Lot 46 (migration 0158, accord de Julien du 18/11) : natures des e-mails de rendez-vous, après celles du lot 49.
    // Lot 44 (migration 0161, accord de Julien du 18/11) : « Nouvelle demande de contact ».
    // Lot 43 (migration 0167, accord de Julien du 18/11, D10) : proposition, relance avant expiration,
    // RIB du règlement, relance d'impayé.
    check("email_templates_kind_check", sql`${table.kind} in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder')`),
    check("email_templates_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("email_templates_subject_check", sql`char_length(${table.subject}) between 1 and 200`),
    check("email_templates_body_check", sql`char_length(${table.body}) between 1 and 5000`),
  ],
);

// Lot 38b (HUB-21 ; D10 ; ADR 0072) — modèles de messages de la planner (« Réponse à une première
// demande », « Proposer un rendez-vous »…), pour tous les évènements ou pour un type d'évènement
// (identifiant du module events, sans clé étrangère : ADR 0011, avenant de l'ADR 0012), dans une
// langue. Chaque enregistrement fait une version, gardée telle quelle ; les précédentes se relisent
// et se restaurent (une restauration fait une version de plus).
export const messageTemplates = hubSchema.table(
  "message_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventTypeId: uuid("event_type_id"),
    name: text("name").notNull(),
    locale: text("locale").notNull(),
    // Numéro de la version en cours (la plus récente).
    version: integer("version").notNull().default(1),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("message_templates_organization_idx").on(table.organizationId),
    check("message_templates_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("message_templates_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("message_templates_version_check", sql`${table.version} >= 1`),
  ],
);

export const messageTemplateVersions = hubSchema.table(
  "message_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => messageTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("message_template_versions_organization_idx").on(table.organizationId),
    unique("message_template_versions_template_version_unique").on(table.templateId, table.version),
    check("message_template_versions_version_check", sql`${table.version} >= 1`),
    check("message_template_versions_subject_check", sql`char_length(${table.subject}) between 1 and 200`),
    check("message_template_versions_body_check", sql`char_length(${table.body}) between 1 and 5000`),
  ],
);

// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — adresses secrètes des flux de calendrier : une par
// personne de l'équipe pour les évènements datés de l'organisation (event_id nul), une par personne et
// par évènement pour son programme. Le jeton n'est gardé que haché ; régénérer révoque l'ancienne
// adresse (la ligne reste, datée), retirer la révoque aussi.
export const calendarFeeds = hubSchema.table(
  "calendar_feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Évènement du module events (identifiant opaque, sans clé étrangère, ADR 0011).
    eventId: uuid("event_id"),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("calendar_feeds_organization_idx").on(table.organizationId),
    unique("calendar_feeds_token_hash_unique").on(table.tokenHash),
    // Une seule adresse active par personne, et par personne et évènement.
    uniqueIndex("calendar_feeds_person_active_idx").on(table.organizationId, table.userId).where(sql`event_id is null and revoked_at is null`),
    uniqueIndex("calendar_feeds_event_active_idx").on(table.organizationId, table.userId, table.eventId).where(sql`event_id is not null and revoked_at is null`),
    check("calendar_feeds_token_hash_check", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

// Lot 39b (UX-09 ; D7 ; ADR 0074) : brouillon d'un formulaire, par personne et par formulaire (« event-new »,
// « contact-note:<id> »…), repris sur tout appareil ; effacé à l'enregistrement, purgé au bout de
// 30 jours. Table technique : ni auteur ni journal (row-stamps.ts), chaque frappe le réécrit.
export const formDrafts = hubSchema.table(
  "form_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    formKey: text("form_key").notNull(),
    content: jsonb("content").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("form_drafts_person_form_idx").on(table.organizationId, table.userId, table.formKey),
    index("form_drafts_organization_idx").on(table.organizationId),
    check("form_drafts_form_key_check", sql`${table.formKey} ~ '^[a-z][a-z0-9-]{0,40}(:[0-9a-f-]{36})?$'`),
    check("form_drafts_content_check", sql`jsonb_typeof(${table.content}) = 'object' and pg_column_size(${table.content}) <= 65536`),
  ],
);

// Lot 40b (ARC-10, décision D9, ADR 0076) — file des tâches de fond d'une organisation : un e-mail
// à envoyer, tenté aussitôt puis repris (délais croissants, cinq tentatives). La clé d'unicité
// empêche le double envoi : une tâche inscrite deux fois, ou rejouée, n'envoie qu'un e-mail. Le
// contenu (destinataire, message) s'efface dès la fin, réussie ou non ; la ligne garde le genre,
// l'état et les dates 30 jours. Une tâche interrompue en plein envoi (processus arrêté) n'est pas
// renvoyée : « interrupted » (au plus une fois). Table technique : ni auteur ni journal.
export const JOB_KINDS = ["email"] as const;
export const JOB_STATES = ["pending", "running", "done", "failed", "interrupted"] as const;

export const jobs = hubSchema.table(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    kind: text("kind", { enum: JOB_KINDS }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    state: text("state", { enum: JOB_STATES }).notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("jobs_organization_key_idx").on(table.organizationId, table.idempotencyKey),
    index("jobs_organization_idx").on(table.organizationId),
    index("jobs_due_idx").on(table.state, table.runAfter),
    check("jobs_kind_check", sql`${table.kind} in ('email')`),
    check("jobs_state_check", sql`${table.state} in ('pending', 'running', 'done', 'failed', 'interrupted')`),
    check("jobs_key_check", sql`length(${table.idempotencyKey}) between 1 and 200`),
    check("jobs_attempts_check", sql`${table.attempts} between 0 and 20`),
    check("jobs_last_error_check", sql`${table.lastError} is null or length(${table.lastError}) <= 200`),
    // Le contenu ne reste que tant que la tâche est à faire ou en cours.
    check("jobs_payload_check", sql`(${table.state} in ('pending', 'running')) = (${table.payload} is not null)`),
    check("jobs_payload_size_check", sql`${table.payload} is null or pg_column_size(${table.payload}) <= 33554432`),
  ],
);

// Lot 37b (DOC-12 ; D12, D13, ADR 0071) — relevé mensuel du stockage d'une organisation, par
// nature : nombre de fichiers et volume, pris le premier du mois et gardé d'un mois sur l'autre ; il
// alimentera le calcul des quotas (DOC-06). Des nombres seulement, jamais un nom de fichier
// (SEC-09) : la titulaire le lit dans Paramètres, l'Admin en lit les totaux. En ajout seul.
export const STORAGE_NATURES = ["legal_originals", "signed_documents", "uploads", "images"] as const;
export type StorageNature = (typeof STORAGE_NATURES)[number];

export const storageSnapshots = hubSchema.table(
  "storage_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    month: date("month").notNull(),
    nature: text("nature", { enum: STORAGE_NATURES }).notNull(),
    fileCount: integer("file_count").notNull(),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("storage_snapshots_organization_idx").on(table.organizationId),
    unique("storage_snapshots_month_nature_unique").on(table.organizationId, table.month, table.nature),
    check("storage_snapshots_nature_check", sql`${table.nature} in ('legal_originals', 'signed_documents', 'uploads', 'images')`),
    check("storage_snapshots_month_check", sql`extract(day from ${table.month}) = 1`),
    check("storage_snapshots_counts_check", sql`${table.fileCount} >= 0 and ${table.totalBytes} >= 0`),
  ],
);

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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("privacy_erasures_organization_idx").on(table.organizationId)]);

// Lot 6 (RGPD-05, ADR 0024) — purges mensuelles validées par la titulaire :
// chaque ligne (règle de conservation, référence opaque, échéance) est
// purgée ou exclue avec un motif ; accusés des modules comme pour l'oubli.
// Les libellés (noms) ne sont jamais copiés ici : recalculés à l'affichage.
export type PrivacyPurgeLine = {
  key: string;
  // RGPD-09 : « privacy_request », preuve d'une demande close arrivée à son terme.
  rule: "prospect" | "client" | "inactive_account" | "accounting_document" | "signed_quote" | "privacy_request";
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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("privacy_purges_organization_idx").on(table.organizationId)]);

// Lot 13 (L13-HUB-18, ADR 0033) — exécutions du script de sauvegarde
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
