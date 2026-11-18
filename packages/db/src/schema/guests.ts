// Schéma du module guests (lot 49, ADR 0011, 0012 et 0083 ; décision D1) : foyers et personnes
// invités à un évènement, leurs réponses par temps fort, leurs régimes (chiffrés, avec l'accord de
// l'invité), leurs liens personnels et la purge de tout cela après l'évènement. Chaque table a
// organization_id, protégée par Row-Level Security (migration 0153). Les invités ne sont pas des
// contacts du hub (CRM-03) : ils appartiennent à l'évènement, dont l'identifiant est gardé sans clé
// étrangère entre schémas (avenant de l'ADR 0012) ; même chose pour les temps forts
// (events.key_moments) et le côté (un client de l'évènement).
import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, pgSchema, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const guestsSchema = pgSchema("guests");

// Valeurs fixes du module (pas des listes métier) : nature d'une personne, tranches d'âge d'un
// enfant (RGP-18), canal d'une réponse ou d'un accord, nature d'une entrée de la liste des régimes.
export const GUEST_KINDS = ["adult", "child"] as const;
export const GUEST_AGE_RANGES = ["0-2", "3-5", "6-11", "12-17"] as const;
export const RSVP_CHANNELS = ["link", "planner", "client"] as const;
export const DIETARY_OPTION_KINDS = ["diet", "allergen"] as const;

// Partie G (INV-07) : réglages du module pour l'organisation. La titulaire confirme avoir complété
// l'analyse d'impact « socle » avant toute saisie (réponse 5 de la DPO) ; la mention d'information
// de la page de réponse (RGP-03, article 14) remplace, si elle est écrite, le texte de départ.
export const moduleSettings = guestsSchema.table("module_settings", {
  organizationId: uuid("organization_id").primaryKey(),
  impactAssessmentConfirmedAt: timestamp("impact_assessment_confirmed_at", { withTimezone: true }),
  impactAssessmentConfirmedBy: uuid("impact_assessment_confirmed_by"),
  privacyNotice: text("privacy_notice"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  check("module_settings_notice_check", sql`${table.privacyNotice} is null or char_length(${table.privacyNotice}) between 1 and 4000`),
]);

// Réglages des réponses d'un évènement (D11, D13, D10) et état de sa purge (D9). La clôture est
// obligatoire avant l'envoi des invitations ; les liens expirent à sa fin (SEC-15).
export const eventSettings = guestsSchema.table("event_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  responsesCloseOn: date("responses_close_on"),
  askDiet: boolean("ask_diet").notNull().default(true),
  askAccommodation: boolean("ask_accommodation").notNull().default(false),
  askTransport: boolean("ask_transport").notNull().default(false),
  // Relances automatiques : jours avant la clôture (zéro à trois relances).
  reminderDays: integer("reminder_days").array().notNull().default(sql`'{21,7}'::integer[]`),
  invitationsSentAt: timestamp("invitations_sent_at", { withTimezone: true }),
  // Préavis et purge (RGP-08) : régimes d'abord, puis le reste.
  dietPurgeNoticeAt: timestamp("diet_purge_notice_at", { withTimezone: true }),
  purgeNoticeAt: timestamp("purge_notice_at", { withTimezone: true }),
  dietsPurgedAt: timestamp("diets_purged_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_settings_organization_idx").on(table.organizationId),
  unique("event_settings_event_unique").on(table.eventId),
  check("event_settings_reminders_check", sql`cardinality(${table.reminderDays}) <= 3 and (cardinality(${table.reminderDays}) = 0 or (1 <= all(${table.reminderDays}) and 90 >= all(${table.reminderDays})))`),
]);

// Groupes d'invités d'un évènement (« Amis du lycée ») : étiquettes créées à la volée, sans liste
// en dur.
export const householdGroups = guestsSchema.table("household_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("household_groups_organization_idx").on(table.organizationId),
  uniqueIndex("household_groups_label_idx").on(table.eventId, sql`lower(${table.label})`),
  check("household_groups_label_check", sql`char_length(${table.label}) between 1 and 100`),
]);

// Import d'une liste (INV-02, D12) : trace sans donnée personnelle, pour annuler l'import.
export const guestImports = guestsSchema.table("guest_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  channel: text("channel").notNull(),
  householdCount: integer("household_count").notNull(),
  guestCount: integer("guest_count").notNull(),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("guest_imports_organization_idx").on(table.organizationId),
  check("guest_imports_channel_check", sql`${table.channel} in ('planner', 'client')`),
  check("guest_imports_counts_check", sql`${table.householdCount} >= 0 and ${table.guestCount} >= 0`),
]);

// Foyer (INV-01) : un nom affiché, un côté (un client de l'évènement, ou les deux), un groupe, la
// langue des messages, le répondant (l'adulte dont le lien répond à la présence de tout le foyer,
// D3), les temps forts auxquels il est invité (null : tous), et ses réponses d'ensemble.
export const households = guestsSchema.table("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  displayName: text("display_name").notNull(),
  sideKind: text("side_kind"),
  sideClientId: uuid("side_client_id"),
  groupId: uuid("group_id").references(() => householdGroups.id, { onDelete: "set null" }),
  language: text("language").notNull().default("fr"),
  respondentGuestId: uuid("respondent_guest_id"),
  keyMomentIds: uuid("key_moment_ids").array(),
  needsAccommodation: boolean("needs_accommodation"),
  needsTransport: boolean("needs_transport"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  importId: uuid("import_id").references(() => guestImports.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("households_organization_idx").on(table.organizationId),
  index("households_event_idx").on(table.eventId),
  check("households_name_check", sql`char_length(${table.displayName}) between 1 and 200`),
  check("households_side_check", sql`(${table.sideKind} is null and ${table.sideClientId} is null) or (${table.sideKind} = 'both' and ${table.sideClientId} is null) or (${table.sideKind} = 'client' and ${table.sideClientId} is not null)`),
  check("households_language_check", sql`${table.language} in ('fr', 'en')`),
]);

// Personne invitée (INV-01, RGP-18) : un adulte (prénom, nom, e-mail, téléphone) ou un enfant
// (prénom et tranche d'âge, jamais de moyen de contact : contrainte en base). Une opposition
// (RGP-08, partie F) efface aussitôt ses coordonnées et ses régimes.
export const guests = guestsSchema.table("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: GUEST_KINDS }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  ageRange: text("age_range", { enum: GUEST_AGE_RANGES }),
  position: integer("position").notNull().default(0),
  opposedAt: timestamp("opposed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("guests_organization_idx").on(table.organizationId),
  index("guests_household_idx").on(table.householdId),
  index("guests_event_idx").on(table.eventId),
  // Clé de la référence des liens : un lien ne désigne qu'un adulte (RGP-18, D3).
  unique("guests_id_kind_unique").on(table.id, table.kind),
  check("guests_kind_check", sql`${table.kind} in ('adult', 'child')`),
  check("guests_first_name_check", sql`char_length(${table.firstName}) between 1 and 100`),
  check("guests_last_name_check", sql`${table.lastName} is null or char_length(${table.lastName}) between 1 and 100`),
  check("guests_email_check", sql`${table.email} is null or (${table.email} = lower(btrim(${table.email})) and char_length(${table.email}) between 3 and 320)`),
  check("guests_phone_check", sql`${table.phone} is null or char_length(${table.phone}) between 3 and 40`),
  check("guests_age_range_check", sql`${table.ageRange} is null or ${table.ageRange} in ('0-2', '3-5', '6-11', '12-17')`),
  // RGP-18 : aucun contact direct, ni nom de famille, pour un enfant ; pas de tranche d'âge pour un adulte.
  check("guests_child_no_contact_check", sql`${table.kind} <> 'child' or (${table.email} is null and ${table.phone} is null and ${table.lastName} is null)`),
  check("guests_adult_age_check", sql`${table.kind} <> 'adult' or ${table.ageRange} is null`),
]);

// Réponse d'une personne pour un temps fort (INV-03) : présente ou non.
export const rsvpAnswers = guestsSchema.table("rsvp_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  keyMomentId: uuid("key_moment_id").notNull(),
  attending: boolean("attending").notNull(),
  channel: text("channel", { enum: RSVP_CHANNELS }).notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("rsvp_answers_organization_idx").on(table.organizationId),
  unique("rsvp_answers_guest_moment_unique").on(table.guestId, table.keyMomentId),
  check("rsvp_answers_channel_check", sql`${table.channel} in ('link', 'planner', 'client')`),
]);

// Liste fermée des régimes et allergies de l'organisation (RGP-06, D6), copiée des données de
// départ (dietary-options.json) ; la planner masque une entrée ou en ajoute une (libellé court).
// Aucun champ libre côté invité.
export const dietaryOptions = guestsSchema.table("dietary_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  kind: text("kind", { enum: DIETARY_OPTION_KINDS }).notNull(),
  starterKey: text("starter_key"),
  label: text("label"),
  hidden: boolean("hidden").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("dietary_options_organization_idx").on(table.organizationId),
  unique("dietary_options_starter_unique").on(table.organizationId, table.starterKey),
  check("dietary_options_kind_check", sql`${table.kind} in ('diet', 'allergen')`),
  check("dietary_options_label_check", sql`(${table.starterKey} is not null and ${table.label} is null) or (${table.starterKey} is null and char_length(${table.label}) between 1 and 60)`),
]);

// Régimes et allergies d'une personne (RGP-07, DAT-08, D7) : la liste cochée, chiffrée au niveau
// du champ (AES-256-GCM, clé DATA_ENCRYPTION_KEY, ADR 0079) ; jamais en clair en base.
export const diets = guestsSchema.table("diets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  optionsSealed: text("options_sealed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("diets_organization_idx").on(table.organizationId),
  unique("diets_guest_unique").on(table.guestId),
  check("diets_sealed_check", sql`${table.optionsSealed} like 'f1:%'`),
]);

// Preuve de l'accord donné pour les régimes (RGP-06 ; réponse 3 de la DPO) : horodatage, version du
// texte, canal, personne, et la déclaration de représentant légal pour un enfant. Le retrait garde
// son horodatage. À la purge du reste (J+30), la ligne perd la personne (horodatage anonymisé).
export const dietConsents = guestsSchema.table("diet_consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  givenByGuestId: uuid("given_by_guest_id").references(() => guests.id, { onDelete: "set null" }),
  textVersion: text("text_version").notNull(),
  channel: text("channel").notNull().default("personal_link"),
  legalGuardian: boolean("legal_guardian").notNull().default(false),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("diet_consents_organization_idx").on(table.organizationId),
  index("diet_consents_guest_idx").on(table.guestId),
  check("diet_consents_channel_check", sql`${table.channel} in ('personal_link')`),
  check("diet_consents_version_check", sql`char_length(${table.textVersion}) between 1 and 40`),
  check("diet_consents_dates_check", sql`${table.withdrawnAt} is null or ${table.withdrawnAt} >= ${table.grantedAt}`),
]);

// Lien personnel d'un adulte invité (INV-03, SEC-14 à SEC-17, D3) : seul l'empreinte du jeton est
// gardée. Jamais pour un enfant : la référence composée (personne, nature) n'accepte qu'un adulte.
// Il expire à la fin du jour de clôture des réponses de l'évènement (SEC-15), relu à chaque usage.
export const guestLinks = guestsSchema.table("guest_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  guestId: uuid("guest_id").notNull(),
  guestKind: text("guest_kind").notNull().default("adult"),
  tokenHash: text("token_hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("guest_links_organization_idx").on(table.organizationId),
  index("guest_links_guest_idx").on(table.guestId),
  unique("guest_links_token_unique").on(table.tokenHash),
  foreignKey({ name: "guest_links_adult_fk", columns: [table.guestId, table.guestKind], foreignColumns: [guests.id, guests.kind] }).onDelete("cascade"),
  check("guest_links_adult_check", sql`${table.guestKind} = 'adult'`),
  check("guest_links_hash_check", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
]);

// Report de la purge d'un évènement (RGP-08, D9) : un seul, motivé, borné par les réglages.
export const purgePostponements = guestsSchema.table("purge_postponements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  reason: text("reason").notNull(),
  postponedUntil: date("postponed_until").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("purge_postponements_organization_idx").on(table.organizationId),
  unique("purge_postponements_event_unique").on(table.eventId),
  check("purge_postponements_reason_check", sql`char_length(btrim(${table.reason})) between 3 and 500`),
]);
