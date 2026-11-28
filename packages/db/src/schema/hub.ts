// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgSchema, primaryKey, text, time, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

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

export const organizations = hubSchema.table(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    language: languageEnum("language").notNull().default("fr"),
    // Facultatif (PRD PRD-HUB-03) : une organisation peut être créée avant
    // d'avoir un SIRET (prospect, structure en cours de création).
    siret: text("siret"),
    // Lot 52 (EVT-06, D2) : toutes les Planners voient tous les évènements (comportement de la pilote) ;
    // coupé, une Planner ne voit que ceux de son équipe. La Propriétaire voit tout.
    allPlannersSeeAllEvents: boolean("all_planners_see_all_events").notNull().default(true),
    // Lot 35c (RGP-11 ; décision D8 de Julien du 18/11/2026 ; ADR 0100) : fermeture par la Propriétaire.
    // Pendant les 30 jours, l'espace ne sert plus qu'à exporter et à rouvrir ; à la date de suppression,
    // tout est effacé. Préavis envoyé sept jours avant. La base refuse une fermeture antidatée et un
    // délai plus court (déclencheur et contrainte de la migration 0186).
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id"),
    deletionDueAt: timestamp("deletion_due_at", { withTimezone: true }),
    closureNoticeSentAt: timestamp("closure_notice_sent_at", { withTimezone: true }),
    // Lot 55 (MSG-04 révisée, D1 ; ADR 0102) : partie locale de l'adresse d'expédition de
    // l'organisation, « <partie locale>@<domaine d'envoi de Symbola> » ; unique, en minuscules. Nulle
    // tant qu'elle n'est pas choisie : elle est alors proposée depuis le nom.
    senderLocalPart: text("sender_local_part"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("organizations_sender_local_part_idx").on(table.senderLocalPart),
    check("organizations_sender_local_part_check", sql`${table.senderLocalPart} is null or ${table.senderLocalPart} ~ '^[a-z0-9]([a-z0-9]|[.-][a-z0-9]){1,39}$'`),
    check(
      "organizations_closure_check",
      sql`(${table.closedAt} is null) = (${table.deletionDueAt} is null) and (${table.deletionDueAt} is null or ${table.deletionDueAt} >= ${table.closedAt} + interval '29 days')`,
    ),
  ],
);

// Lot 33 (HUB-02, HUB-03) : rôle d'une adhésion, et de l'invitation qui la crée (lot 33b, D12).
// Lot 52 (réponse de Julien du 18/11 au lot 58) : « accountant », le comptable en lecture, invité par la
// Propriétaire, avec double authentification exigée.
export const membershipRoleEnum = hubSchema.enum("membership_role", ["owner", "member", "accountant"]);

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
  // Lot 52 (SEC-02, D5) : bandeau « Sécurisez votre compte » fermé par la Planner ; il revient au plus
  // une fois par mois tant que ses sessions s'ouvrent sans double authentification.
  mfaPromptDismissedAt: timestamp("mfa_prompt_dismissed_at", { withTimezone: true }),
  // Lot 52 (SEC-08, D6) : empreinte des facteurs d'authentification connus chez le fournisseur
  // (identifiants et natures, hachés), pour reconnaître un changement de facteur annoncé par le webhook.
  mfaFactorsFingerprint: text("mfa_factors_fingerprint"),
  // Lot 70a (CHR-02 ; A1, accord de Julien du 26/11/2026, migration 0216) : prénom et nom de la personne,
  // saisis par elle dans Mon compte ; montrés aux membres de ses organisations seulement (« Bastien »,
  // initiales « BL »). Nuls : le début de l'adresse en tient lieu.
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  check("users_first_name_check", sql`${table.firstName} is null or (char_length(${table.firstName}) between 1 and 80 and ${table.firstName} !~ '[[:cntrl:]]')`),
  check("users_last_name_check", sql`${table.lastName} is null or (char_length(${table.lastName}) between 1 and 80 and ${table.lastName} !~ '[[:cntrl:]]')`),
]);

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
  // Lot 52 (HUB-05, D4) : l'appareil lu dans l'en-tête du navigateur (« Safari sur iPhone »),
  // l'identifiant d'appareil aléatoire du cookie, et la dernière activité (au plus une écriture par
  // heure). Aucune adresse IP ni ville.
  deviceLabel: text("device_label"),
  deviceId: text("device_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
}, (table) => [index("sessions_organization_idx").on(table.organizationId), index("sessions_user_idx").on(table.userId)]);

// Lot 52 (SEC-08) — appareils déjà vus pour un compte : une connexion depuis un identifiant d'appareil
// inconnu envoie « Nouvelle connexion à Symbola ». Le lien « Ce n'est pas moi » de l'alerte porte un
// jeton dont seul le haché est gardé (sept jours). Table d'identité, comme hub.sessions : pas de RLS,
// accès par packages/auth seulement (ADR 0013). Gardée tant que le compte vit ; un appareil inactif
// depuis 30 jours est oublié (donnée de sécurité, DPO).
export const knownDevices = hubSchema.table(
  "known_devices",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceLabel: text("device_label"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    alertTokenHash: text("alert_token_hash").unique(),
    alertExpiresAt: timestamp("alert_expires_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.deviceId] }), index("known_devices_last_seen_idx").on(table.lastSeenAt)],
);

// Lot 52 (HUB-04, D1) — transfert de propriété : la Propriétaire désigne une Planner qui a la double
// authentification ; la Planner confirme par le lien de l'e-mail (usage unique, 7 jours), puis les rôles
// s'échangent. Une seule demande en cours par organisation. Table d'identité (adhésions) : pas de RLS,
// accès par packages/auth seulement (ADR 0013, ADR 0094).
export const ownershipTransfers = hubSchema.table(
  "ownership_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    index("ownership_transfers_organization_idx").on(table.organizationId),
    uniqueIndex("ownership_transfers_pending_unique").on(table.organizationId).where(sql`${table.confirmedAt} is null and ${table.cancelledAt} is null`),
  ],
);

// Lot 52 (SEC-08, D6) — alertes de changement d'identité annoncées par le webhook signé du fournisseur
// (adresse e-mail, facteur d'authentification, mot de passe). L'ancienne adresse n'est gardée que
// jusqu'à l'envoi de l'alerte, qui part vers elle (critère) ; la ligne reste 30 jours sans adresse.
// L'identifiant de l'appel du fournisseur rend la réception idempotente (il rejoue un appel en échec).
export const IDENTITY_CHANGE_KINDS = ["email", "mfa", "password"] as const;

export const identityChangeAlerts = hubSchema.table(
  "identity_change_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: IDENTITY_CHANGE_KINDS }).notNull(),
    deliveryKey: text("delivery_key").notNull().unique(),
    previousEmail: text("previous_email"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("identity_change_alerts_user_idx").on(table.userId),
    index("identity_change_alerts_received_idx").on(table.receivedAt),
    check("identity_change_alerts_kind_check", sql`${table.kind} in ('email', 'mfa', 'password')`),
  ],
);

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
  // Lot 71a (décision I4 de Julien, 27/11/2026 ; à confirmer par le DPO) : durée pendant laquelle ce
  // qu'un import n'a pas repris (l'annuaire d'un programme) reste proposé au carnet, puis effacé.
  importLeftoversRetentionDays: integer("import_leftovers_retention_days").notNull().default(90),
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
  // Lot 54 (HUB-27, D1 ; ADR 0101) : la facturation des abonnements par l'éditeur reste éteinte tant
  // que la société n'est pas créée ; aucun envoi de facture tant que ce réglage est faux.
  subscriptionBillingEnabled: boolean("subscription_billing_enabled").notNull().default(false),
  // Lot 54 : règles de l'essai et du quota réglées par l'Exploitation ; null : celles de plans.json.
  subscriptionRules: jsonb("subscription_rules"),
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
  // Lot 71a (HUB-14, C-66 ; migration 0219) : les PDF des prestataires retenus et du programme entrent
  // dans le journal commun des imports (bilan, retrait d'ensemble ; écrans du paquet 71e).
  "event_vendors",
  "program",
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
  // Lot 63b (HUB-14) : proposition douteuse (seul le prénom est commun) : « À vérifier », et « Ce sont
  // deux prestataires » par défaut. Reste dans « À vérifier » jusqu'à ce que la planner l'ait vue.
  toVerify?: boolean;
  reviewed?: boolean;
  // Lot 71d (HUB-14, BUD-01) : ligne de budget rangée sous un poste du mariage, et pourquoi (même nom,
  // nom proche, poste combiné du fichier réparti d'après le détail : « À vérifier »).
  placement?: "same" | "close" | "split";
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
  // Lot 63e (PRE-01, PRE-11) : valeurs combinées du fichier (« Photographe et vidéaste ») dont ce
  // métier vient ; chacune donne plusieurs métiers à la fiche.
  combinedFrom?: string[];
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
  // Lot 71a (HUB-14 ; ADR 0119) : réponses de l'étape « Questions » (contrat ImportAnswers de
  // packages/contracts) ; gardées quand les rapprochements sont recalculés.
  answers?: Record<string, unknown>;
  // Lot 71d (HUB-14, R17 ; maquette 08, « Doublons ») : les postes du mariage qui ne reçoivent aucune
  // ligne du fichier et sont encore « à trouver » : la planner les garde ou les retire de ce mariage
  // (null : pas encore décidé). Identifiants des postes du mariage (ou des postes de départ de l'agence
  // pour un mariage créé à l'écriture).
  unusedSlots?: { slotId: string; decision: "keep" | "remove" | null }[];
  // Lot 71d : les prestataires nommés par un budget, retrouvés au carnet (`found`), doublon possible à
  // trancher (`proposed`), tranché (`same` : la fiche du carnet ; `create` : créer une fiche), ou
  // absents du carnet (`absent`). `name` : le nom écrit dans le fichier ; `vendorId` : la fiche du carnet.
  vendorLinks?: { name: string; vendorId: string | null; decision: "found" | "proposed" | "same" | "create" | "absent" }[];
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
  // Lot 65g (HUB-14, BUD-04 ; recette staging du 22/11/2026) : import lancé depuis un évènement (tâches,
  // lignes de budget) : toutes les lignes vont dans cet évènement, sans colonne pour le désigner.
  // Identifiant opaque (pas de clé étrangère entre schémas).
  targetEventId: uuid("target_event_id"),
  // Lot 71a (HUB-14 ; migration 0219, ADR 0119) : la reprise à laquelle l'import appartient ; nul pour un
  // import d'avant le lot (décision I8) ou hors reprise (contacts, carnet, listes).
  takeoverId: uuid("takeover_id").references((): AnyPgColumn => takeovers.id, { onDelete: "set null" }),
  // Lot 71a (R14, décision I4) : ce que le fichier contenait et qui peut être repris plus tard (l'annuaire
  // d'un programme : noms, rôles, téléphones). Effacé au plus tard après la durée réglée par l'Admin
  // (platform_settings.import_leftovers_retention_days, 90 jours, à confirmer par le DPO), au retrait de
  // l'import et dès que la planner l'a ajouté au carnet ou écarté. Jamais exporté.
  leftovers: jsonb("leftovers").$type<ImportLeftovers | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("imports_organization_idx").on(table.organizationId), index("imports_takeover_idx").on(table.takeoverId)]);

// Lot 71a (R14) : l'annuaire d'un programme repris d'un PDF, proposé au carnet depuis le bilan.
export type ImportLeftovers = { directory?: { role: string; company: string | null; contact: string | null; phone: string | null }[] };

export type ImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  // Lot 71d (HUB-14, C-58) : les nombres annoncés à « Vérifier », comptés par importFigures
  // (packages/contracts) sur ce que l'import a écrit, redits mot pour mot par le bilan et la reprise.
  figures?: Record<string, unknown>;
  // Lot 71d : « Ce que vous avez choisi » (choix de « Doublons »), sans valeur personnelle autre que les
  // intitulés de postes et les noms de prestataires du fichier, déjà dans le budget.
  choices?: { splits: string[]; removedSlots: string[]; sameVendors: { name: string; vendorName: string }[]; createdVendors: string[] };
};

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
  // Lot 71a (R7, décision I9 ; migration 0219) : noms des champs que l'import a écrits sur l'élément, sans
  // aucune valeur, pour « D'où viennent ces valeurs ? » ; gardés tant que l'élément existe.
  fields: text("fields").array(),
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

// Lot 71a (HUB-14, PAR-01, UX-02 ; spécification du lot 71, § 4.1 ; ADR 0119) — la reprise d'un
// mariage en cours : une page par mariage, qui regroupe ses imports. Sortes et états : mêmes listes
// que packages/contracts (takeover/takeover.ts), vérifiées par modules/hub/takeovers.test.ts. Le mariage peut ne pas exister
// encore (ligne 2 de la page) ; son identifiant est contrôlé par le service des évènements (pas de clé
// étrangère entre schémas). Aucune donnée personnelle : des identifiants, des dates, des états.
export const TAKEOVER_STEP_KINDS = ["vendor_book", "event", "budget", "event_vendors", "tasks", "program"] as const;
export const TAKEOVER_STEP_STATES = ["todo", "in_progress", "done", "no_file", "covered"] as const;

export const takeovers = hubSchema.table(
  "takeovers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id"),
    // Première fois que la liste « À compléter » s'est vidée (lot 71f) ; nul tant qu'un point reste.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // La planner a fermé la liste « À compléter » (R9, sept jours après completed_at au plus tard).
    checklistClosedAt: timestamp("checklist_closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row) ; created_by est la personne qui a
    // commencé la reprise.
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("takeovers_organization_event_idx").on(table.organizationId, table.eventId),
    // R1 : une seule page de reprise par mariage.
    uniqueIndex("takeovers_event_idx").on(table.organizationId, table.eventId).where(sql`event_id is not null`),
  ],
);

export const takeoverSteps = hubSchema.table(
  "takeover_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    takeoverId: uuid("takeover_id")
      .notNull()
      .references(() => takeovers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TAKEOVER_STEP_KINDS }).notNull(),
    state: text("state", { enum: TAKEOVER_STEP_STATES }).notNull().default("todo"),
    // L'import de la ligne (en cours ou appliqué) ; nul pour « à faire », « pas de fichier », ou la ligne
    // du mariage saisi à la main.
    importId: uuid("import_id").references((): AnyPgColumn => imports.id, { onDelete: "set null" }),
    // « Avec le budget » : la ligne des prestataires retenus couverte par la ligne du budget.
    coveredByStepId: uuid("covered_by_step_id").references((): AnyPgColumn => takeoverSteps.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("takeover_steps_organization_idx").on(table.organizationId),
    index("takeover_steps_import_idx").on(table.importId),
    uniqueIndex("takeover_steps_kind_idx").on(table.takeoverId, table.kind),
    check("takeover_steps_kind_check", sql`${table.kind} in ('vendor_book', 'event', 'budget', 'event_vendors', 'tasks', 'program')`),
    check("takeover_steps_state_check", sql`${table.state} in ('todo', 'in_progress', 'done', 'no_file', 'covered')`),
    check("takeover_steps_covered_check", sql`(${table.state} = 'covered') = (${table.coveredByStepId} is not null)`),
    check("takeover_steps_decided_check", sql`(${table.state} = 'todo') or ${table.decidedAt} is not null`),
  ],
);

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
    // Lot 48 (DAT-08 ; D5, ADR 0093) : une note confidentielle est chiffrée au niveau du champ
    // (body_sealed, field-box) et body est vide ; lue par la titulaire et son auteur seuls.
    body: text("body"),
    bodySealed: text("body_sealed"),
    isConfidential: boolean("is_confidential").notNull().default(false),
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
    check(
      "contact_notes_body_check",
      sql`(not ${table.isConfidential} and ${table.bodySealed} is null and ${table.body} is not null and char_length(${table.body}) between 1 and 2000) or (${table.isConfidential} and ${table.body} is null and ${table.bodySealed} like 'f1:%' and ${table.authorUserId} is not null)`,
    ),
  ],
);

// Lot 45 (CRM-07 ; D4 ; ADR 0090) — paires de contacts qui se ressemblent (même adresse e-mail ou
// même téléphone, une fois normalisés), détectées à la saisie, au formulaire de contact et chaque
// nuit ; montrées à la planner (« Doublons possibles »), jamais fusionnées seules. « dismissed_at » :
// la planner a dit « ce ne sont pas les mêmes ». Une paire est rangée dans l'ordre des identifiants.
// Un contact fictif (is_demo) n'est jamais apparié à un contact réel.
export const CONTACT_DUPLICATE_REASONS = ["email", "phone"] as const;

export const contactDuplicates = hubSchema.table(
  "contact_duplicates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    firstContactId: uuid("first_contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    secondContactId: uuid("second_contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    reason: text("reason", { enum: CONTACT_DUPLICATE_REASONS }).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissedBy: uuid("dismissed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contact_duplicates_organization_idx").on(table.organizationId),
    index("contact_duplicates_second_idx").on(table.secondContactId),
    uniqueIndex("contact_duplicates_pair_idx").on(table.firstContactId, table.secondContactId),
    check("contact_duplicates_order_check", sql`${table.firstContactId} < ${table.secondContactId}`),
    check("contact_duplicates_reason_check", sql`${table.reason} in ('email', 'phone')`),
  ],
);

// Lot 45 (CRM-07 ; D4, D5) — trace d'une fusion : qui, quand, quelles fiches, et les champs repris de
// la fiche absorbée (leurs noms, jamais leurs valeurs). La fiche absorbée n'existe plus ; les modules
// repointent leurs références à réception de hub.contact.merged. Pas de clé étrangère : la trace reste
// après l'effacement d'une des fiches.
export const contactMerges = hubSchema.table(
  "contact_merges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    keptContactId: uuid("kept_contact_id").notNull(),
    absorbedContactId: uuid("absorbed_contact_id").notNull(),
    fieldsFromAbsorbed: text("fields_from_absorbed").array().notNull().default(sql`'{}'::text[]`),
    mergedByUserId: uuid("merged_by_user_id"),
    mergedAt: timestamp("merged_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contact_merges_organization_idx").on(table.organizationId),
    uniqueIndex("contact_merges_absorbed_idx").on(table.absorbedContactId),
    index("contact_merges_kept_idx").on(table.keptContactId),
    check("contact_merges_distinct_check", sql`${table.keptContactId} <> ${table.absorbedContactId}`),
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
  // Lot 47 (PRE-03, PAR-05 ; D2, D4, D8, D9 ; ADR 0085) : brief à un prestataire, sa relance la veille
  // de la date limite, feuille de route à J-30 et J-7.
  "vendor_brief",
  "vendor_brief_reminder",
  "vendor_roadmap",
  // Lot 43 (FAC-02, FAC-08, FAC-09, FAC-15 ; D10) : proposition, relance avant expiration, RIB du
  // règlement, relance d'impayé.
  "proposal_sent",
  "proposal_expiry_reminder",
  "payment_details",
  "invoice_reminder",
  // Lot 45 (CRM-05, CRM-06, POR-07 ; D9) : réponse à un prospect et relance (le texte de la planner,
  // à l'image de l'organisation), questionnaire envoyé (son lien personnel).
  "prospect_reply",
  "prospect_follow_up",
  "questionnaire_sent",
  // Lot 52 (HUB-04, EVT-06, SEC-08 ; D1, D3, D6 ; ADR 0094) : nouvelle connexion, changement d'identité
  // (à l'ancienne adresse), confirmation du transfert de propriété, lien du renfort du jour J.
  "new_device_login",
  "identity_changed",
  "ownership_transfer",
  "day_helper_link",
  // Lot 53 (HUB-15, UX-16, HUB-28 ; D1, D5) : récapitulatif du matin, rappel au payeur à J-7, alerte.
  "daily_digest",
  "payment_due_reminder",
  "notification_alert",
  // Lot 55 (MSG-03, POR-06) : « Nouveau message sur <sujet> », sans le contenu du message.
  "new_message",
  // Lot 66b (JRJ-01 ; D2 à D4) : le rappel du jour J, par cible.
  "day_reminder_planner",
  "day_reminder_vendor",
  "day_reminder_team",
  "day_reminder_client",
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
    // Lot 66c (HUB-18, MSG-01 ; ADR 0113) : le libellé du bouton du modèle, modifié avec le texte ;
    // nul : le libellé de départ (Emails.button.* des fichiers de traduction).
    buttonLabel: text("button_label"),
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
    // Lot 47 (migration 0163, accord de Julien du 18/11) : natures des prestataires par lien.
    // Lot 43 (migration 0169, accord de Julien du 18/11, D10) : proposition, relance avant expiration,
    // RIB du règlement, relance d'impayé.
    // Lot 45 (migration 0172, accord de Julien du 18/11) : réponse, relance, questionnaire envoyé.
    // Lot 52 (migration 0180, spécification validée par Julien le 18/11) : sécurité, transfert, renfort.
    // Lot 53 (migration 0183, accord de Julien du 18/11) : récapitulatif, rappel J-7, alerte.
    check("email_templates_kind_check", sql`${table.kind} in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link', 'daily_digest', 'payment_due_reminder', 'notification_alert', 'new_message', 'day_reminder_planner', 'day_reminder_vendor', 'day_reminder_team', 'day_reminder_client')`),
    check("email_templates_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("email_templates_subject_check", sql`char_length(${table.subject}) between 1 and 200`),
    check("email_templates_body_check", sql`char_length(${table.body}) between 1 and 5000`),
    check("email_templates_button_label_check", sql`${table.buttonLabel} is null or (char_length(${table.buttonLabel}) between 1 and 60 and ${table.buttonLabel} !~ '[[:cntrl:]]')`),
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

// —— Lot 53 (HUB-15, UX-16, ARC-09, HUB-28, GC-02 ; D1 à D5, D7 ; ADR 0095) ——————————————————————
// Notifications de l'équipe, abonnements push, automatismes et radar des risques. Données d'une
// organisation : RLS forcée. Les sortes, canaux, automatismes et règles sont des catalogues fermés
// (packages/contracts, hub/notifications.ts) ; leurs valeurs de départ sont des données
// (packages/starter-templates). Une notification ou un réglage appartient à une personne : le
// service ne lit jamais que ceux du compte connecté.
export const NOTIFICATION_TYPE_KEYS = [
  "prospect_request",
  "quote_signed",
  "quote_expired",
  "transfer_declared",
  "client_decision",
  "vendor_answer",
  "iban_to_verify",
  "document_expiring",
  "task_overdue",
  "milestone_late",
  "risk_alert",
  "day_of_alert",
  // Lot 55 (MSG-03, POR-06, MSG-05) : message d'un client ou d'un prestataire ; e-mail rejeté.
  "client_message",
  "email_bounced",
  // Lot 63g (HUB-06, HUB-15 ; ADR 0108) : l'app demandée pendant le pilote est activée.
  "module_activated",
  // Lot 70a (CHR-02, HUB-15 ; A19) : une tâche est confiée à la personne par un collègue.
  "task_assigned",
] as const;
const NOTIFICATION_TYPES_SQL = sql.raw(NOTIFICATION_TYPE_KEYS.map((key) => `'${key}'`).join(", "));
export const NOTIFICATION_CHANNEL_KEYS = ["app", "email", "push"] as const;
// État d'un envoi : rien à faire, à faire (à partir de due_at), dans le récapitulatif, envoyé,
// abandonné (canal coupé entre-temps, notification lue, abonnement disparu).
export const NOTIFICATION_DELIVERY_STATES = ["none", "pending", "digest", "sent", "skipped"] as const;

// Récapitulatif, plages de silence et jour J d'une personne dans une organisation. Sans ligne, les
// valeurs de départ (notifications.json). digest_sent_on : jour (dans le fuseau) du dernier
// récapitulatif, pour n'en envoyer qu'un par jour.
export const notificationSettings = hubSchema.table(
  "notification_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    digestEnabled: boolean("digest_enabled").notNull(),
    digestHour: integer("digest_hour").notNull(),
    quietEnabled: boolean("quiet_enabled").notNull(),
    quietStartMinute: integer("quiet_start_minute").notNull(),
    quietEndMinute: integer("quiet_end_minute").notNull(),
    quietSundays: boolean("quiet_sundays").notNull(),
    dayOfOverride: boolean("day_of_override").notNull(),
    timeZone: text("time_zone").notNull().default("Europe/Paris"),
    digestSentOn: date("digest_sent_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("notification_settings_organization_idx").on(table.organizationId),
    uniqueIndex("notification_settings_user_idx").on(table.organizationId, table.userId),
    check("notification_settings_hours_check", sql`${table.digestHour} between 0 and 23 and ${table.quietStartMinute} between 0 and 1439 and ${table.quietEndMinute} between 0 and 1439`),
    check("notification_settings_time_zone_check", sql`char_length(${table.timeZone}) between 1 and 64`),
  ],
);

// Une sorte coupée ou gardée sur un canal, pour une personne (HUB-15 : chaque sorte se coupe
// séparément). Sans ligne, le réglage de départ de la sorte.
export const notificationPreferences = hubSchema.table(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPE_KEYS }).notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNEL_KEYS }).notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("notification_preferences_organization_idx").on(table.organizationId),
    uniqueIndex("notification_preferences_user_type_channel_idx").on(table.organizationId, table.userId, table.type, table.channel),
    check("notification_preferences_type_check", sql`${table.type} in (${NOTIFICATION_TYPES_SQL})`),
    check("notification_preferences_channel_check", sql`${table.channel} in ('app', 'email', 'push')`),
  ],
);

// Une notification d'une personne : sa sorte, son objet (object_key, une seule fois par objet),
// l'écran où agir, et l'état de chaque envoi. Les paramètres sont des libellés courts (numéro de devis,
// intitulé de tâche, nom d'un prestataire), jamais une adresse ni un téléphone ; ils ne sortent ni dans
// un push ni dans l'objet d'un e-mail. Effacée 90 jours après sa création (notifications.json).
export const notifications = hubSchema.table(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPE_KEYS }).notNull(),
    eventId: uuid("event_id"),
    objectKey: text("object_key").notNull(),
    params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
    href: text("href").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    emailState: text("email_state", { enum: NOTIFICATION_DELIVERY_STATES }).notNull().default("none"),
    emailDueAt: timestamp("email_due_at", { withTimezone: true }),
    pushState: text("push_state", { enum: NOTIFICATION_DELIVERY_STATES }).notNull().default("none"),
    pushDueAt: timestamp("push_due_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("notifications_organization_idx").on(table.organizationId),
    index("notifications_user_idx").on(table.userId, table.createdAt),
    index("notifications_event_idx").on(table.eventId),
    uniqueIndex("notifications_object_idx").on(table.organizationId, table.userId, table.type, table.objectKey),
    index("notifications_email_due_idx").on(table.emailState, table.emailDueAt),
    index("notifications_push_due_idx").on(table.pushState, table.pushDueAt),
    check("notifications_type_check", sql`${table.type} in (${NOTIFICATION_TYPES_SQL})`),
    check("notifications_object_key_check", sql`char_length(${table.objectKey}) between 1 and 200`),
    check("notifications_href_check", sql`${table.href} ~ '^/[^/]' and char_length(${table.href}) <= 500`),
    check("notifications_params_check", sql`jsonb_typeof(${table.params}) = 'object' and octet_length(${table.params}::text) <= 2000`),
    check("notifications_email_state_check", sql`${table.emailState} in ('none', 'pending', 'digest', 'sent', 'skipped')`),
    check("notifications_push_state_check", sql`${table.pushState} in ('none', 'pending', 'digest', 'sent', 'skipped')`),
  ],
);

// Un appareil abonné au push (ARC-09, D4) : l'adresse du service de push du navigateur et ses clés
// publiques (données techniques). Supprimé à la désactivation, quand le service répond qu'il n'existe
// plus, ou après 90 jours sans usage (notifications.json).
export const pushSubscriptions = hubSchema.table(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceLabel: text("device_label").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("push_subscriptions_organization_idx").on(table.organizationId),
    index("push_subscriptions_user_idx").on(table.userId),
    uniqueIndex("push_subscriptions_endpoint_idx").on(table.organizationId, table.endpoint),
    check("push_subscriptions_endpoint_check", sql`${table.endpoint} ~ '^https://' and char_length(${table.endpoint}) <= 1000`),
    check("push_subscriptions_keys_check", sql`char_length(${table.p256dh}) between 80 and 100 and char_length(${table.auth}) between 16 and 32`),
    check("push_subscriptions_label_check", sql`char_length(${table.deviceLabel}) between 1 and 80`),
  ],
);

// Un automatisme prêt à activer (HUB-28, D5) : actif ou coupé, son délai en jours s'il en a un.
// resumed_at : dernière remise en route ; ce qui était dû avant n'est jamais rattrapé. Sans ligne, les
// valeurs de départ (automations.json).
export const AUTOMATION_KEY_VALUES = [
  "quote_signed_confirm_event",
  "payment_due_reminder",
  "rsvp_reminder",
  "client_task_reminder",
  "invoice_reminder",
  "proposal_expiry_reminder",
  "prospect_follow_up",
  "vendor_roadmap",
  "risk_radar",
  // Lot 66b (JRJ-01, HUB-28 ; D2 à D4) : le rappel du jour J, réglé par cible (day_reminder_targets).
  "day_reminder",
] as const;
const AUTOMATION_KEYS_SQL = sql.raw(AUTOMATION_KEY_VALUES.map((key) => `'${key}'`).join(", "));

export const automations = hubSchema.table(
  "automations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    key: text("key", { enum: AUTOMATION_KEY_VALUES }).notNull(),
    enabled: boolean("enabled").notNull(),
    days: integer("days"),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    // Lot 53 (GC-02) : jour (Paris) du dernier passage du radar, une fois par matin.
    lastRunOn: date("last_run_on"),
    // Lot 66a (HUB-28 ; D1) : heure d'envoi propre à l'automatisme, heure locale de l'évènement, au
    // quart d'heure ; nulle : l'heure par défaut de l'organisation (sending_settings).
    sendTime: time("send_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("automations_organization_idx").on(table.organizationId),
    uniqueIndex("automations_key_idx").on(table.organizationId, table.key),
    check("automations_key_check", sql`${table.key} in (${AUTOMATION_KEYS_SQL})`),
    check("automations_days_check", sql`${table.days} is null or ${table.days} between 1 and 60`),
    check("automations_send_time_check", sql`${table.sendTime} is null or (extract(minute from ${table.sendTime})::int % 15 = 0 and extract(second from ${table.sendTime}) = 0)`),
  ],
);

// Lot 66a (HUB-28 ; D1) — l'heure d'envoi par défaut de l'organisation, reprise par chaque automatisme
// sans heure propre. Sans ligne : 09:00 (sending-settings.json).
export const sendingSettings = hubSchema.table(
  "sending_settings",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id),
    defaultSendTime: time("default_send_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [check("sending_settings_time_check", sql`extract(minute from ${table.defaultSendTime})::int % 15 = 0 and extract(second from ${table.defaultSendTime}) = 0`)],
);

// Lot 66b (JRJ-01, HUB-28 ; D2, D3, D4) — le rappel du jour J, par cible : la planner (cochée au
// départ), les prestataires retenus, l'équipe du jour, les clients ; la veille ou le matin même, à une
// heure. Sans ligne : les valeurs de départ (day-reminder.json).
export const DAY_REMINDER_TARGETS = ["planner", "vendors", "team", "clients"] as const;
export const DAY_REMINDER_MOMENTS = ["eve", "morning"] as const;
export const dayReminderTargets = hubSchema.table(
  "day_reminder_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    target: text("target", { enum: DAY_REMINDER_TARGETS }).notNull(),
    enabled: boolean("enabled").notNull(),
    moment: text("moment", { enum: DAY_REMINDER_MOMENTS }).notNull(),
    sendTime: time("send_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_reminder_targets_organization_idx").on(table.organizationId),
    uniqueIndex("day_reminder_targets_target_idx").on(table.organizationId, table.target),
    check("day_reminder_targets_target_check", sql`${table.target} in ('planner', 'vendors', 'team', 'clients')`),
    check("day_reminder_targets_moment_check", sql`${table.moment} in ('eve', 'morning')`),
    check("day_reminder_targets_time_check", sql`extract(minute from ${table.sendTime})::int % 15 = 0 and extract(second from ${table.sendTime}) = 0`),
  ],
);

// Le journal d'un automatisme (HUB-28 : chaque automatisation laisse une trace) : quand, sur quoi (un
// libellé court et l'écran de l'objet), avec quel résultat. Effacé après 90 jours.
export const AUTOMATION_RUN_RESULTS = ["sent", "skipped", "failed", "done"] as const;
export const automationRuns = hubSchema.table(
  "automation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    key: text("key", { enum: AUTOMATION_KEY_VALUES }).notNull(),
    objectKey: text("object_key"),
    objectLabel: text("object_label"),
    href: text("href"),
    result: text("result", { enum: AUTOMATION_RUN_RESULTS }).notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("automation_runs_organization_idx").on(table.organizationId),
    index("automation_runs_key_idx").on(table.organizationId, table.key, table.ranAt),
    check("automation_runs_key_check", sql`${table.key} in (${AUTOMATION_KEYS_SQL})`),
    check("automation_runs_result_check", sql`${table.result} in ('sent', 'skipped', 'failed', 'done')`),
    check("automation_runs_label_check", sql`${table.objectLabel} is null or char_length(${table.objectLabel}) <= 200`),
    check("automation_runs_href_check", sql`${table.href} is null or (${table.href} ~ '^/[^/]' and char_length(${table.href}) <= 500)`),
  ],
);

// Une règle du radar des risques (GC-02, D7) : active ou non, son seuil en jours. Sans ligne, les
// valeurs de départ (risk-radar.json).
export const RISK_RULE_KEYS = ["vendor_without_contract", "decision_overdue", "document_expired", "payment_overdue", "milestone_late", "iban_to_verify", "roadmap_unconfirmed"] as const;
const RISK_RULES_SQL = sql.raw(RISK_RULE_KEYS.map((key) => `'${key}'`).join(", "));

export const riskRules = hubSchema.table(
  "risk_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    rule: text("rule", { enum: RISK_RULE_KEYS }).notNull(),
    enabled: boolean("enabled").notNull(),
    thresholdDays: integer("threshold_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("risk_rules_organization_idx").on(table.organizationId),
    uniqueIndex("risk_rules_rule_idx").on(table.organizationId, table.rule),
    check("risk_rules_rule_check", sql`${table.rule} in (${RISK_RULES_SQL})`),
    check("risk_rules_threshold_check", sql`${table.thresholdDays} between 0 and 365`),
  ],
);

// Lot 35b (HUB-13, décisions D6 et D7, ADR 0098) — reprises d'un export Symbola dans une organisation
// vide : la Propriétaire dépose l'archive, la reprise se fait en arrière-plan (un traitement à la
// fois, en une seule transaction : un échec ne laisse rien), puis l'archive déposée est effacée ; la
// ligne garde l'état et le bilan, sans donnée personnelle (nombres par entité, motifs).
export const ORGANIZATION_IMPORT_STATUSES = ["pending", "running", "done", "failed"] as const;
export type OrganizationImportStatus = (typeof ORGANIZATION_IMPORT_STATUSES)[number];
export const ORGANIZATION_IMPORT_ERRORS = [
  "not_empty",
  "unreadable",
  "unknown_format",
  "checksum",
  "schema",
  "file_refused",
  "siren_mismatch",
  "ledger_invalid",
  "failed",
] as const;
export type OrganizationImportError = (typeof ORGANIZATION_IMPORT_ERRORS)[number];

// Bilan : par entité de l'archive, le nombre de lignes lues et reprises, ou le motif de l'écart.
export type OrganizationImportReport = {
  entities: { entity: string; rows: number; imported: number; reason: string | null }[];
  files: { imported: number; missing: number };
  teamMembersToInvite: number;
  linksToRecreate: number;
  ledger: { entries: number; lastSequence: number } | null;
};

export const organizationImports = hubSchema.table(
  "organization_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    status: text("status", { enum: ORGANIZATION_IMPORT_STATUSES }).notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // Archive déposée, rangée dans le stockage privé le temps de la reprise, puis effacée.
    archiveKey: text("archive_key"),
    archiveBytes: bigint("archive_bytes", { mode: "number" }).notNull().default(0),
    // Date de l'export repris (manifeste), pour le bilan.
    sourceGeneratedAt: timestamp("source_generated_at", { withTimezone: true }),
    report: jsonb("report").$type<OrganizationImportReport>(),
    error: text("error", { enum: ORGANIZATION_IMPORT_ERRORS }),
    // Entité ou chemin en cause (jamais une valeur de l'archive).
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("organization_imports_organization_idx").on(table.organizationId),
    uniqueIndex("organization_imports_active_idx").on(table.organizationId).where(sql`status in ('pending', 'running')`),
    check("organization_imports_status_check", sql`${table.status} in ('pending', 'running', 'done', 'failed')`),
    check(
      "organization_imports_error_check",
      sql`${table.error} is null or ${table.error} in ('not_empty', 'unreadable', 'unknown_format', 'checksum', 'schema', 'file_refused', 'siren_mismatch', 'ledger_invalid', 'failed')`,
    ),
  ],
);

// Lot 35c (RGP-11 ; D8 ; ADR 0100) — trace de chaque fermeture, sans donnée personnelle (l'identifiant
// de l'organisation et des dates) : elle survit à la suppression, l'Exploitation la lit, et elle sert à
// effacer de nouveau, après une restauration de sauvegarde, une organisation déjà supprimée. Sans RLS :
// l'organisation n'existe plus quand la trace sert ; l'app la lit toujours avec un filtre explicite.
export const organizationClosures = hubSchema.table(
  "organization_closures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    deletionDueAt: timestamp("deletion_due_at", { withTimezone: true }).notNull(),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    erasedRows: integer("erased_rows"),
    filesErasedAt: timestamp("files_erased_at", { withTimezone: true }),
    erasedFiles: integer("erased_files"),
    // Dernier rejeu de l'effacement après une restauration.
    replayedAt: timestamp("replayed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("organization_closures_organization_idx").on(table.organizationId),
    uniqueIndex("organization_closures_open_idx").on(table.organizationId).where(sql`reopened_at is null and erased_at is null`),
    check("organization_closures_dates_check", sql`${table.deletionDueAt} >= ${table.closedAt} + interval '29 days'`),
  ],
);

// Lot 54 (HUB-27, ARC-06, DOC-06 ; ADR 0101) — catalogue des offres et des options, administré par
// l'Exploitation. Vide tant qu'elle n'a rien changé : l'app lit alors le catalogue de départ
// (packages/starter-templates/src/plans.json) ; aucun prix n'est écrit dans une migration. Données de
// la plateforme, sans organisation : pas de RLS (comme platform_settings).
export const PLAN_ENTRY_KINDS = ["trial", "plan", "pilot", "module_option", "storage_option"] as const;
export const plans = hubSchema.table(
  "plans",
  {
    key: text("key").primaryKey(),
    kind: text("kind", { enum: PLAN_ENTRY_KINDS }).notNull(),
    position: integer("position").notNull().default(0),
    labelFr: text("label_fr").notNull(),
    labelEn: text("label_en").notNull(),
    descriptionFr: text("description_fr").notNull(),
    descriptionEn: text("description_en").notNull(),
    monthlyPriceCents: integer("monthly_price_cents").notNull(),
    yearlyPriceCents: integer("yearly_price_cents"),
    maxUsers: integer("max_users"),
    storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" }),
    storageUnitBytes: bigint("storage_unit_bytes", { mode: "number" }),
    optionsAllowed: boolean("options_allowed").notNull().default(false),
    selfService: boolean("self_service").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    check("plans_kind_check", sql`${table.kind} in ('trial', 'plan', 'pilot', 'module_option', 'storage_option')`),
    check("plans_key_check", sql`${table.key} ~ '^[a-z][a-z0-9_]{0,39}$'`),
    check("plans_prices_check", sql`${table.monthlyPriceCents} >= 0 and (${table.yearlyPriceCents} is null or ${table.yearlyPriceCents} >= 0)`),
    check("plans_limits_check", sql`(${table.maxUsers} is null or ${table.maxUsers} >= 1) and (${table.storageQuotaBytes} is null or ${table.storageQuotaBytes} >= 0) and (${table.storageUnitBytes} is null or ${table.storageUnitBytes} >= 1)`),
    check("plans_self_service_check", sql`${table.kind} in ('plan', 'module_option', 'storage_option') or not ${table.selfService}`),
  ],
);

// Modules d'une offre : inclus, au choix (App seule), ou ouvert par une option de module.
export const PLAN_MODULE_ROLES = ["included", "choice", "option"] as const;
export const planModules = hubSchema.table(
  "plan_modules",
  {
    planKey: text("plan_key")
      .notNull()
      .references(() => plans.key, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    role: text("role", { enum: PLAN_MODULE_ROLES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.planKey, table.moduleKey] }),
    check("plan_modules_role_check", sql`${table.role} in ('included', 'choice', 'option')`),
  ],
);

// L'abonnement d'une organisation : offre, app choisie, options, tranches de stockage, période et
// état. Absent : l'organisation est réglée par l'Exploitation comme avant le lot 54 (modules de
// organization_modules, sans quota). Ses droits pilotent hub.organization_modules.
export const SUBSCRIPTION_STATUSES = ["trial", "active", "read_only", "cancelled"] as const;
export const organizationSubscriptions = hubSchema.table(
  "organization_subscriptions",
  {
    organizationId: uuid("organization_id").primaryKey(),
    planKey: text("plan_key").notNull(),
    chosenModule: text("chosen_module"),
    options: text("options").array().notNull().default(sql`'{}'::text[]`),
    storageUnits: integer("storage_units").notNull().default(0),
    billingPeriod: text("billing_period", { enum: ["monthly", "yearly"] }).notNull().default("monthly"),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    readOnlySince: timestamp("read_only_since", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id"),
    cancelEffectiveAt: timestamp("cancel_effective_at", { withTimezone: true }),
    // La fermeture du lot 35c a été lancée à l'échéance de la résiliation.
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("organization_subscriptions_status_idx").on(table.status),
    check("organization_subscriptions_status_check", sql`${table.status} in ('trial', 'active', 'read_only', 'cancelled')`),
    check("organization_subscriptions_period_check", sql`${table.billingPeriod} in ('monthly', 'yearly')`),
    check("organization_subscriptions_units_check", sql`${table.storageUnits} >= 0`),
    check("organization_subscriptions_trial_check", sql`${table.status} <> 'trial' or ${table.trialEndsAt} is not null`),
    check("organization_subscriptions_cancel_check", sql`${table.status} <> 'cancelled' or (${table.cancelEffectiveAt} is not null and ${table.cancelledAt} is not null)`),
  ],
);

// Interrupteurs par fonction (NFR-26) : une fonction nouvelle déclare sa clé dans le code ; elle est
// fermée pour tous tant que l'Exploitation ne l'ouvre pas, d'abord à la pilote, puis à tous. Données
// de la plateforme (pas de RLS, comme organization_modules).
export const featureFlags = hubSchema.table("feature_flags", {
  key: text("key").primaryKey(),
  openToAll: boolean("open_to_all").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

export const featureFlagOrganizations = hubSchema.table(
  "feature_flag_organizations",
  {
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [primaryKey({ columns: [table.flagKey, table.organizationId] }), index("feature_flag_organizations_organization_idx").on(table.organizationId)],
);

// DOC-06 : dernière mesure du stockage d'une organisation abonnée face à son quota, paliers déjà
// annoncés, et préavis à 100 % (dépôts refusés à partir de uploads_blocked_from). Des nombres
// seulement, jamais un nom de fichier.
export const storageQuotaStates = hubSchema.table(
  "storage_quota_states",
  {
    organizationId: uuid("organization_id").primaryKey(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    usedBytes: bigint("used_bytes", { mode: "number" }).notNull(),
    usedByModule: jsonb("used_by_module").$type<Record<string, number>>().notNull().default({}),
    quotaBytes: bigint("quota_bytes", { mode: "number" }),
    alertedPercents: integer("alerted_percents").array().notNull().default(sql`'{}'::integer[]`),
    fullSince: timestamp("full_since", { withTimezone: true }),
    uploadsBlockedFrom: timestamp("uploads_blocked_from", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    check("storage_quota_states_bytes_check", sql`${table.usedBytes} >= 0 and (${table.quotaBytes} is null or ${table.quotaBytes} >= 0)`),
    check("storage_quota_states_notice_check", sql`${table.uploadsBlockedFrom} is null or (${table.fullSince} is not null and ${table.uploadsBlockedFrom} >= ${table.fullSince} + interval '6 days')`),
  ],
);

// Lot 55 (MSG-05 ; D2 ; ADR 0102) — journal des envois : chaque e-mail d'une organisation, son objet et
// son statut (envoyé, remis, rejeté, plainte), mis à jour par le webhook signé du service d'envoi.
// Jamais le corps. reference : l'identifiant du message (en-tête Message-ID, sans donnée
// personnelle), par lequel le webhook retrouve la ligne. recipient_hash : SHA-256 de l'adresse en
// minuscules, pour la recherche par contact. Purgé 13 mois après l'envoi.
export const EMAIL_DELIVERY_STATUS_KEYS = ["sent", "delivered", "bounced", "complained"] as const;
export const emailDeliveries = hubSchema.table(
  "email_deliveries",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    reference: text("reference").notNull(),
    recipient: text("recipient"),
    recipientHash: text("recipient_hash").notNull(),
    subject: text("subject").notNull(),
    kind: text("kind"),
    eventId: uuid("event_id"),
    status: text("status", { enum: EMAIL_DELIVERY_STATUS_KEYS }).notNull().default("sent"),
    reason: text("reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    statusAt: timestamp("status_at", { withTimezone: true }).notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("email_deliveries_organization_idx").on(table.organizationId, table.sentAt),
    uniqueIndex("email_deliveries_reference_idx").on(table.reference),
    index("email_deliveries_recipient_idx").on(table.organizationId, table.recipientHash, table.statusAt),
    index("email_deliveries_event_idx").on(table.eventId),
    check("email_deliveries_status_check", sql`${table.status} in ('sent', 'delivered', 'bounced', 'complained')`),
    check("email_deliveries_reason_check", sql`${table.reason} is null or ${table.reason} in ('mailbox_not_found', 'mailbox_full', 'blocked', 'spam_complaint', 'other')`),
    check("email_deliveries_reference_check", sql`char_length(${table.reference}) between 1 and 300`),
    check("email_deliveries_hash_check", sql`${table.recipientHash} ~ '^[0-9a-f]{64}$'`),
    check("email_deliveries_subject_check", sql`char_length(${table.subject}) <= 300`),
    check("email_deliveries_kind_check", sql`${table.kind} is null or char_length(${table.kind}) between 1 and 60`),
  ],
);

// Lot 63g (HUB-06, HUB-27, ARC-07, SEC-09 ; ADR 0108) — demandes d'activation d'une app pendant le
// pilote : la Propriétaire demande une app non activée, sans champ libre ; elle l'annule tant que la
// demande attend ; l'Exploitation l'active (la demande passe à « activated », la planner est notifiée)
// ou la classe sans l'activer (« declined »). Une seule demande en attente par app et par
// organisation. L'Exploitation n'en lit que l'organisation, la clé du module et la date (SEC-09) ;
// jamais la personne qui a demandé. RLS forcée ; aucune suppression par l'app (trace).
export const MODULE_REQUEST_STATUSES = ["pending", "cancelled", "activated", "declined"] as const;
export const moduleRequests = hubSchema.table(
  "module_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    moduleKey: text("module_key").notNull(),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: MODULE_REQUEST_STATUSES }).notNull().default("pending"),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("module_requests_organization_idx").on(table.organizationId, table.requestedAt),
    uniqueIndex("module_requests_pending_idx").on(table.organizationId, table.moduleKey).where(sql`status = 'pending'`),
    index("module_requests_status_idx").on(table.status),
    check("module_requests_status_check", sql`${table.status} in ('pending', 'cancelled', 'activated', 'declined')`),
    check("module_requests_module_key_check", sql`${table.moduleKey} ~ '^[a-z][a-z0-9_]{0,39}$'`),
    check("module_requests_handled_check", sql`(${table.status} = 'pending') = (${table.handledAt} is null)`),
  ],
);

// Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) — qui envoie les
// messages de la relation (proposition, relances, brief, programme…) : « planner », par défaut, la
// planner les envoie de sa messagerie (Symbola les prépare) ; « symbola », Symbola les envoie pour elle
// (adresse de l'ADR 0102, pièces jointes, relances automatiques). Sans ligne : « planner ». Les modèles
// techniques (accès, signature, rendez-vous en ligne, sécurité, avis) partent toujours de Symbola.
export const RELATION_MAIL_SENDER_KEYS = ["planner", "symbola"] as const;
export const relationMailSettings = hubSchema.table(
  "relation_mail_settings",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id),
    sender: text("sender", { enum: RELATION_MAIL_SENDER_KEYS }).notNull().default("planner"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [check("relation_mail_settings_sender_check", sql`${table.sender} in ('planner', 'symbola')`)],
);

// Lot 65d — les messages de la relation préparés pour la messagerie de la planner : « à envoyer »
// (déposé par un geste ou par un automatisme du lot 53), puis « envoyé » quand la planner dit l'avoir
// envoyé (date, personne, modèle), ou « écarté ». Aucun contenu : le message est recomposé à
// l'ouverture depuis ses références (ref : des identifiants seulement), le destinataire est désigné
// par son identifiant (lien personnel, contact ou signataire), jamais par son adresse. source_key :
// la clé de l'envoi qu'il remplace (une seule fois par clé). Pas de clé étrangère vers un autre schéma
// (avenant de l'ADR 0012) : l'évènement est désigné par son identifiant.
export const PREPARED_EMAIL_RECIPIENT_TYPES = ["event_link", "contact", "quote_signer"] as const;
export const PREPARED_EMAIL_STATUS_KEYS = ["to_send", "sent", "dismissed"] as const;
export const PREPARED_EMAIL_ORIGINS = ["gesture", "automation"] as const;
export const preparedEmails = hubSchema.table(
  "prepared_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id"),
    kind: text("kind").notNull(),
    recipientType: text("recipient_type", { enum: PREPARED_EMAIL_RECIPIENT_TYPES }).notNull(),
    recipientId: uuid("recipient_id").notNull(),
    ref: jsonb("ref").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    origin: text("origin", { enum: PREPARED_EMAIL_ORIGINS }).notNull(),
    automationKey: text("automation_key"),
    sourceKey: text("source_key"),
    status: text("status", { enum: PREPARED_EMAIL_STATUS_KEYS }).notNull().default("to_send"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("prepared_emails_organization_idx").on(table.organizationId, table.status, table.createdAt),
    index("prepared_emails_event_idx").on(table.eventId),
    uniqueIndex("prepared_emails_source_key_idx").on(table.organizationId, table.sourceKey).where(sql`source_key is not null`),
    check("prepared_emails_kind_check", sql`${table.kind} ~ '^[a-z][a-z_]{0,59}$'`),
    check("prepared_emails_recipient_type_check", sql`${table.recipientType} in ('event_link', 'contact', 'quote_signer')`),
    check("prepared_emails_origin_check", sql`${table.origin} in ('gesture', 'automation')`),
    check("prepared_emails_status_check", sql`${table.status} in ('to_send', 'sent', 'dismissed')`),
    check("prepared_emails_ref_check", sql`jsonb_typeof(${table.ref}) = 'object'`),
    check("prepared_emails_automation_key_check", sql`${table.automationKey} is null or ${table.automationKey} ~ '^[a-z][a-z_]{0,59}$'`),
    check("prepared_emails_source_key_check", sql`${table.sourceKey} is null or char_length(${table.sourceKey}) between 1 and 300`),
    check("prepared_emails_sent_check", sql`(${table.status} = 'sent') = (${table.sentAt} is not null)`),
    check("prepared_emails_dismissed_check", sql`(${table.status} = 'dismissed') = (${table.dismissedAt} is not null)`),
  ],
);

// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) — la marque des e-mails de l'organisation : la police
// (quatre familles compatibles avec les messageries, repli sur une police système), une ligne libre en
// pied, le nom affiché de l'expéditeur (l'adresse reste sur le domaine de Symbola, ADR 0102), le modèle
// commun des signatures (les éléments affichés) et la personne dont la signature porte les envois
// automatiques (nulle : la titulaire). Sans ligne : les valeurs de départ.
export const EMAIL_FONT_KEYS = ["sans", "serif", "elegant", "rounded"] as const;
export const SIGNATURE_ELEMENT_KEYS = ["photo", "title", "organization", "phone", "website", "links"] as const;
export const emailBranding = hubSchema.table(
  "email_branding",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id),
    font: text("font", { enum: EMAIL_FONT_KEYS }).notNull().default("sans"),
    footerLine: text("footer_line"),
    senderName: text("sender_name"),
    signatureElements: text("signature_elements").array().notNull().default(sql`'{photo,title,organization,phone,website,links}'::text[]`),
    automaticSignerUserId: uuid("automatic_signer_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    check("email_branding_font_check", sql`${table.font} in ('sans', 'serif', 'elegant', 'rounded')`),
    check("email_branding_footer_line_check", sql`${table.footerLine} is null or (char_length(${table.footerLine}) between 1 and 200 and ${table.footerLine} !~ '[[:cntrl:]]')`),
    check("email_branding_sender_name_check", sql`${table.senderName} is null or (char_length(${table.senderName}) between 1 and 80 and ${table.senderName} !~ '[[:cntrl:]<>"]')`),
    check("email_branding_signature_elements_check", sql`${table.signatureElements} <@ array['photo', 'title', 'organization', 'phone', 'website', 'links']::text[]`),
  ],
);

// Lot 66c (HUB-18 ; D5 ; ADR 0113) — la signature d'un membre de l'équipe, une par personne et par
// organisation : nom affiché, fonction, téléphone, site, jusqu'à quatre liens ({ label, url }), photo
// facultative (clé du stockage privé, contrôlée comme le logo). Champs personnels au registre RGPD,
// effacés avec l'accès du membre. Chacun n'écrit que la sienne (politique de la base).
export const memberSignatures = hubSchema.table(
  "member_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    displayName: text("display_name"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    website: text("website"),
    links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default(sql`'[]'::jsonb`),
    photoKey: text("photo_key"),
    photoSizeBytes: integer("photo_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("member_signatures_organization_idx").on(table.organizationId),
    uniqueIndex("member_signatures_user_idx").on(table.organizationId, table.userId),
    check("member_signatures_display_name_check", sql`${table.displayName} is null or (char_length(${table.displayName}) between 1 and 120 and ${table.displayName} !~ '[[:cntrl:]]')`),
    check("member_signatures_job_title_check", sql`${table.jobTitle} is null or (char_length(${table.jobTitle}) between 1 and 120 and ${table.jobTitle} !~ '[[:cntrl:]]')`),
    check("member_signatures_phone_check", sql`${table.phone} is null or ${table.phone} ~ '^[0-9+(). -]{3,40}$'`),
    check("member_signatures_website_check", sql`${table.website} is null or (char_length(${table.website}) <= 300 and ${table.website} ~ '^https?://[^[:space:]"<>]+$')`),
    check("member_signatures_links_check", sql`jsonb_typeof(${table.links}) = 'array' and jsonb_array_length(${table.links}) <= 4`),
    check("member_signatures_photo_check", sql`(${table.photoKey} is null) = (${table.photoSizeBytes} is null)`),
  ],
);
