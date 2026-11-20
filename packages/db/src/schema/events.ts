// Schéma du module events (Lot 2, PRD-EVT-01/02/07). Tables métier : chaque
// table a organization_id (CLAUDE.md §2.4), protégée par Row-Level
// Security activée par une migration dédiée (même patron que hello,
// packages/db/drizzle).
import { sql } from "drizzle-orm";
import { boolean, check, date, integer, pgSchema, text, time, timestamp, unique, uniqueIndex, uuid, jsonb, index, type AnyPgColumn } from "drizzle-orm/pg-core";

export const eventsSchema = pgSchema("events");

// Statuts fixes du cycle de vie d'un événement — pas une liste personnalisable par organisation,
// à la différence des sources de prospect et des motifs de perte ci-dessous. Lot 34a (EVT-05,
// ADR 0055, décisions D2 et D3) : Option, Confirmé, En préparation, Clôturé, Reporté, Annulé ;
// « Jour J » n'est pas stocké, il s'applique de lui-même le jour de l'événement, dans son fuseau.
// Lot 44 (CRM-02, D9 ; ADR 0084) — étapes du pipeline commercial, liste de l'organisation copiée des
// données de départ (pipeline-stages.json), entre une et dix, dans l'ordre de position.
export const pipelineStages = eventsSchema.table(
  "pipeline_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("pipeline_stages_organization_idx").on(table.organizationId), check("pipeline_stages_label_check", sql`char_length(${table.label}) between 1 and 60`)],
);

export const eventStatusEnum = eventsSchema.enum("event_status", [
  "option",
  "confirmed",
  "in_preparation",
  "closed",
  "postponed",
  "cancelled",
]);

// PRD-EVT-07 : « la source est obligatoire, choisie dans une liste qu'elle
// paramètre » — jamais codée en dur (CLAUDE.md §2.5), gérée par
// organisation.
export const prospectSources = eventsSchema.table("prospect_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("prospect_sources_organization_idx").on(table.organizationId)]);

// PRD-EVT-02 : motif de perte, également paramétrable par organisation
// (CLAUDE.md §2.5 cite « motifs » comme exemple explicite). isFreeText
// marque l'entrée « autre » : une note libre devient alors obligatoire.
export const lossReasons = eventsSchema.table("loss_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  isFreeText: boolean("is_free_text").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("loss_reasons_organization_idx").on(table.organizationId)]);

// Lot 16 (ADR 0045) : type d'un événement (mariage, séminaire…), liste propre
// à l'organisation (CLAUDE.md §2.5), installée depuis les données de départ.
// Il dit qui sont les clients, et donc le vocabulaire des écrans de
// l'événement : « les mariés » (couple) ou « le client » (clients).
export const eventTypeAudienceEnum = eventsSchema.enum("event_type_audience", ["couple", "clients"]);

export const eventTypes = eventsSchema.table(
  "event_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    label: text("label").notNull(),
    audience: eventTypeAudienceEnum("audience").notNull().default("clients"),
    position: integer("position").notNull().default(0),
    // Clé du type de départ (packages/starter-templates/src/event-types.json),
    // nulle pour un type créé par l'organisation.
    starterKey: text("starter_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [unique("event_types_organization_starter_key_unique").on(table.organizationId, table.starterKey)],
);

export const events = eventsSchema.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  status: eventStatusEnum("status").notNull().default("option"),
  // Date sans heure (CLAUDE.md §5) ; nulle tant que la date n'est pas
  // fixée (« Date à définir », PRD-EVT-01).
  eventDate: date("event_date"),
  // Lot 34a (ARC-17, D9) : fuseau IANA de l'événement ; les heures liées à l'événement s'y
  // affichent, et le jour J s'y compte.
  timeZone: text("time_zone").notNull().default("Europe/Paris"),
  // Lot 34a (EVT-05, D4) : un report garde la date et le statut d'avant, jusqu'à sa confirmation.
  postponedFromDate: date("postponed_from_date"),
  postponedFromStatus: eventStatusEnum("postponed_from_status"),
  // Lot 34b (EVT-03, D10) : le lieu de réception est le premier lieu de event_places (une seule
  // liste) ; venue_name et venue_city ont été repris par la migration 0133.
  // Lot 34b (EVT-03, D11) : invités estimés et confirmés (saisis à la main jusqu'au module
  // Invités), style et notes en texte libre.
  guestsEstimated: integer("guests_estimated"),
  guestsConfirmed: integer("guests_confirmed"),
  style: text("style"),
  notes: text("notes"),
  // Lot 48 (DAT-08 ; D5, ADR 0093) : notes marquées confidentielles, chiffrées au niveau du champ
  // (field-box, ADR 0079) ; notes est alors vide. Lues par la titulaire et leur auteur seuls.
  notesSealed: text("notes_sealed"),
  notesConfidentialBy: uuid("notes_confidential_by"),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  // Lot 14 (décision K) : budget souhaité par les clients, en centimes
  // (proposé comme total de la simulation du budget).
  wantedBudgetCents: integer("wanted_budget_cents"),
  prospectSourceId: uuid("prospect_source_id").references(() => prospectSources.id),
  // Lot 16 (ADR 0045) : nul pour un événement d'avant le lot 16 ou dont le type
  // a été supprimé ; le vocabulaire suit alors le métier de l'organisation.
  eventTypeId: uuid("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
  lossReasonId: uuid("loss_reason_id").references(() => lossReasons.id),
  lossReasonNote: text("loss_reason_note"),
  // Lot 44 (CRM-02, D9 ; ADR 0084) : étape du pipeline commercial, pour une option ; vide = la première
  // étape. Une étape n'est qu'un repère, les statuts restent ceux du cycle de vie (ADR 0055).
  pipelineStageId: uuid("pipeline_stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
  // PRD-EVT-04 : date de l'événement pour laquelle les échéances du
  // rétroplanning ont été calculées. Quand eventDate en diffère, l'app
  // propose de recalculer les échéances des tâches non faites.
  tasksScheduledFor: date("tasks_scheduled_for"),
  // PRD-EVT-05 : dernière modification du programme du jour J (ajout,
  // modification, suppression d'une ligne) — « date de version » du PDF.
  programUpdatedAt: timestamp("program_updated_at", { withTimezone: true }),
  // AIDE-02, ADR 0008 : événement fictif d'un essai guidé. Ses lignes
  // (clients, postes, tâches, programme) le suivent ; il est exclu de la
  // recherche RGPD et des événements internes, et supprimé à la fin de
  // l'essai ou à demoExpiresAt (essai abandonné).
  isDemo: boolean("is_demo").notNull().default(false),
  demoExpiresAt: timestamp("demo_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
  // Lot 58 (PAR-09, étape 5 ; ADR 0097) : évènement archivé, en lecture seule, hors des listes
  // courantes mais consultable (filtre « Archivés », recherche). Les purges suivent leur calendrier.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by"),
}, (table) => [
  index("events_organization_idx").on(table.organizationId),
  check("events_time_zone_check", sql`char_length(${table.timeZone}) between 1 and 64`),
  check("events_guests_check", sql`(${table.guestsEstimated} is null or ${table.guestsEstimated} between 0 and 100000) and (${table.guestsConfirmed} is null or ${table.guestsConfirmed} between 0 and 100000)`),
  check("events_identity_text_check", sql`(${table.style} is null or char_length(${table.style}) <= 2000) and (${table.notes} is null or char_length(${table.notes}) <= 10000)`),
  check("events_notes_sealed_check", sql`${table.notesSealed} is null or (${table.notes} is null and ${table.notesSealed} like 'f1:%' and ${table.notesConfidentialBy} is not null)`),
]);

// Prénoms/noms affichés dans la liste (PRD-EVT-01) ; position fixe l'ordre
// d'affichage (ex. « Alice & Bob »).
export const eventClients = eventsSchema.table("event_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  // Lot 36a (CRM-03, D4, ADR 0069) : le client est un contact du hub, qui porte son nom et ses
  // coordonnées ; ici, seulement le lien. Vide quand le RGPD a retiré la personne de l'évènement
  // (oubli ou purge) : la ligne reste, pour que les statistiques restent justes.
  contactId: uuid("contact_id"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_clients_organization_idx").on(table.organizationId), index("event_clients_contact_idx").on(table.contactId)]);

// PRD-EVT-02 : « chaque changement [de statut] est historisé (date, auteur) ».
export const eventStatusHistory = eventsSchema.table("event_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  fromStatus: eventStatusEnum("from_status"),
  toStatus: eventStatusEnum("to_status").notNull(),
  // Lot 44 (CRM-01, D5 ; ADR 0084) : vide quand le changement ne vient d'aucun compte (prospect créé
  // par le formulaire de contact public).
  changedByUserId: uuid("changed_by_user_id"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("event_status_history_organization_idx").on(table.organizationId)]);


// PRD-EVT-03 : « la liste de postes par défaut de la planner » — paramétrable
// par organisation (CLAUDE.md §2.5), éventuellement chargée depuis le
// modèle de départ (packages/starter-templates), jamais codée en dur.
export const defaultVendorSlots = eventsSchema.table("default_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  // Lot 12 (L12-EVT-14) : icône de la ligne du budget (clé connue de l'app).
  icon: text("icon"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("default_vendor_slots_organization_idx").on(table.organizationId)]);

// PRD-EVT-03 : postes d'un événement, copiés de la liste par défaut à la
// création puis modifiables événement par événement.
export const eventVendorSlots = eventsSchema.table("event_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  label: text("label").notNull(),
  // Lot 28a (PRE-02, décision D3) : le poste n'a plus de statut à lui ; il
  // affiche le plus avancé de ses prestataires. « Non requis » reste une case.
  notRequired: boolean("not_required").notNull().default(false),
  // Lot 28b (PRE-02, décisions D10 et D14) : plus de prestataire, de montant
  // ni de prestataire choisi sur le poste ; ses prestataires rattachés les
  // portent (plusieurs peuvent être retenus).
  position: integer("position").notNull().default(0),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  // Lot 11 (L11-EVT-10) : ce que veulent les clients pour ce poste.
  brief: text("brief"),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_vendor_slots_organization_idx").on(table.organizationId)]);

// Lot 28a (PRE-02, décisions Q9 et D3) — statut d'un prestataire rattaché à
// un événement : ceux du cahier des charges, dans l'ordre de leur avancée,
// plus « Écarté » (il a décliné, ou un autre a été retenu). « Retenu » engage
// la ligne de budget liée.
export const VENDOR_CANDIDATE_STATUSES = ["shortlisted", "contacted", "quote_received", "retained", "contract_signed", "paid_off", "dismissed"] as const;
export const vendorCandidateStatusEnum = eventsSchema.enum("vendor_candidate_status", VENDOR_CANDIDATE_STATUSES);

// Lot 11 (L11-EVT-10) — prestataires consultés pour un poste. vendor_id
// référence une fiche du carnet (module vendors, ADR 0031) sans clé
// étrangère entre schémas ; le nom reste en clair pour fonctionner sans le
// module Prestataires. Le devis joint suit les règles de l'ADR 0027.
export const eventVendorCandidates = eventsSchema.table("event_vendor_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id")
    .notNull()
    .references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id"),
  vendorName: text("vendor_name").notNull(),
  status: vendorCandidateStatusEnum("status").notNull().default("shortlisted"),
  contactedOn: date("contacted_on"),
  quoteAmountCents: integer("quote_amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  quoteFileKey: text("quote_file_key"),
  quoteMime: text("quote_mime"),
  quoteSizeBytes: integer("quote_size_bytes"),
  shownToClients: boolean("shown_to_clients").notNull().default(false),
  // Lot 12 (L12-EVT-16) : RIB de la fiche du carnet partagé aux clients de l'événement.
  shareRibWithClients: boolean("share_rib_with_clients").notNull().default(false),
  position: integer("position").notNull().default(0),
  // Lot 47 (PRE-03, PRE-04, PAR-05 ; ADR 0085) : le brief reçu, la réponse du prestataire par son
  // lien (disponible ou non, date, message court), la relance de la veille, le motif d'un écart et
  // la facture déposée une fois retenu (un document de l'évènement).
  briefId: uuid("brief_id").references((): AnyPgColumn => vendorBriefs.id, { onDelete: "set null" }),
  availability: text("availability"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  answerMessage: text("answer_message"),
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  dismissalReason: text("dismissal_reason"),
  invoiceDocumentId: uuid("invoice_document_id").references((): AnyPgColumn => eventDocuments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_vendor_candidates_organization_idx").on(table.organizationId),
  index("event_vendor_candidates_brief_idx").on(table.briefId),
  check("event_vendor_candidates_availability_check", sql`${table.availability} is null or ${table.availability} in ('available', 'unavailable')`),
  check("event_vendor_candidates_answer_message_check", sql`${table.answerMessage} is null or char_length(${table.answerMessage}) between 1 and 1000`),
  check("event_vendor_candidates_dismissal_reason_check", sql`${table.dismissalReason} is null or ${table.dismissalReason} in ('unavailable', 'other_chosen')`),
]);

// Lot 11 (L11-EVT-11) — notes sur un prestataire consulté : internes par
// défaut, visibles par les clients note par note.
export const eventVendorCandidateNotes = eventsSchema.table("event_vendor_candidate_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => eventVendorCandidates.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  visibleToClients: boolean("visible_to_clients").notNull().default(false),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_vendor_candidate_notes_organization_idx").on(table.organizationId)]);

// PRD-EVT-04 : responsable d'une tâche du rétroplanning (PRD). Une tâche des
// « clients » apparaîtra dans l'espace des mariés (PRD-EVT-06).
// Lot 34b (CHR-02, D12) : une tâche peut être confiée à un prestataire retenu sur l'événement.
export const taskResponsibleEnum = eventsSchema.enum("task_responsible", ["planner", "clients", "vendor"]);

// PRD-EVT-04 : modèles de rétroplanning de l'organisation (CLAUDE.md §2.5 :
// jamais codés en dur ; un modèle de départ peut être chargé depuis
// packages/starter-templates).
export const taskTemplates = eventsSchema.table("task_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  // Lot 34a (EVT-01, D8) : modèle du type d'événement, appliqué dès la création.
  eventTypeId: uuid("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [index("task_templates_organization_idx").on(table.organizationId)]);

export const taskTemplateItems = eventsSchema.table("task_template_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => taskTemplates.id),
  label: text("label").notNull(),
  // Décalage en jours par rapport à la date de l'événement : -365 pour
  // J-365, 0 pour le jour J, positif après l'événement.
  offsetDays: integer("offset_days").notNull(),
  responsible: taskResponsibleEnum("responsible").notNull().default("planner"),
  position: integer("position").notNull().default(0),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("task_template_items_organization_idx").on(table.organizationId)]);

// PRD-EVT-04 : tâches du rétroplanning d'un événement.
// Lot 53 (CHR-10, CHR-05 ; D6 ; ADR 0095) : une tâche peut n'avoir aucun évènement (déclaration de TVA,
// assurance) et se répéter ; une tâche du rétroplanning peut être un jalon.
export const TASK_RECURRENCES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

export const eventTasks = eventsSchema.table("event_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  // Lot 53 (CHR-10, D6) : nul pour une tâche hors évènement.
  eventId: uuid("event_id").references(() => events.id),
  label: text("label").notNull(),
  // Échéance, date sans heure (CLAUDE.md §5).
  dueDate: date("due_date").notNull(),
  // Lot 34a (DAT-07, D5) : écart en jours avec la date de l'événement (J-90 = -90) ; nul pour une
  // tâche sans date relative. Une tâche déplacée à la main est fixée (fixedAt) : sa date absolue
  // fait foi et le report ne la bouge plus.
  offsetDays: integer("offset_days"),
  fixedAt: timestamp("fixed_at", { withTimezone: true }),
  responsible: taskResponsibleEnum("responsible").notNull().default("planner"),
  // Lot 34b (CHR-02, D12) : le prestataire retenu à qui la tâche est confiée (responsable
  // « vendor ») ; nul si le prestataire est retiré de l'événement.
  vendorCandidateId: uuid("vendor_candidate_id").references(() => eventVendorCandidates.id, { onDelete: "set null" }),
  // Lot 47 (PAR-05, D6 ; ADR 0085) : tâche de suivi créée quand ce prestataire est retenu (contrat,
  // acompte, attestation) ; retirée, si elle n'est pas faite, quand il cesse d'être retenu.
  followUpCandidateId: uuid("follow_up_candidate_id").references((): AnyPgColumn => eventVendorCandidates.id, { onDelete: "set null" }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
  // Lot 53 (CHR-10, D6) : répétition d'une tâche hors évènement ; l'occurrence suivante est créée
  // quand celle-ci est faite, ou à sa date (recurrenceSpawnedAt : déjà créée, une seule fois).
  recurrence: text("recurrence", { enum: TASK_RECURRENCES }),
  recurrenceSpawnedAt: timestamp("recurrence_spawned_at", { withTimezone: true }),
  // Lot 53 (CHR-05) : jalon du rétroplanning ; en retard, il pèse plus sur la santé du planning.
  isMilestone: boolean("is_milestone").notNull().default(false),
}, (table) => [
  index("event_tasks_organization_idx").on(table.organizationId),
  index("event_tasks_vendor_candidate_idx").on(table.vendorCandidateId),
  index("event_tasks_follow_up_candidate_idx").on(table.followUpCandidateId),
  index("event_tasks_event_idx").on(table.eventId),
  check("event_tasks_recurrence_check", sql`${table.recurrence} is null or (${table.recurrence} in ('weekly', 'monthly', 'quarterly', 'yearly') and ${table.eventId} is null)`),
  check("event_tasks_standalone_check", sql`${table.eventId} is not null or (${table.offsetDays} is null and ${table.vendorCandidateId} is null and ${table.followUpCandidateId} is null and ${table.isMilestone} = false and ${table.responsible} = 'planner')`),
]);

// PRD-EVT-05 : programme du jour J d'un événement. Heures sans date (« HH:MM »),
// le jour étant celui de l'événement ; une heure de fin antérieure au
// début signifie que la ligne se termine après minuit.
export const programItems = eventsSchema.table("program_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  startTime: time("start_time").notNull(),
  endTime: time("end_time"),
  label: text("label").notNull(),
  location: text("location"),
  // Jamais dans la variante « mariés » du PDF (PRD PRD-EVT-05).
  internalNote: text("internal_note"),
  // Lot 30b (CHR-06, décision D6) : responsable de la séquence, texte court.
  responsible: text("responsible"),
  // Lot 51 (EVT-04 ; D1, ADR 0091) : le temps fort de la séquence, donc son jour. Facultatif en base
  // (compatible avec l'ancien code, ARC-14) ; l'app rattache toute séquence nouvelle à un temps fort.
  keyMomentId: uuid("key_moment_id").references((): AnyPgColumn => keyMoments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("program_items_organization_idx").on(table.organizationId),
  index("program_items_key_moment_idx").on(table.keyMomentId),
  check("program_items_responsible_check", sql`${table.responsible} is null or char_length(${table.responsible}) between 1 and 120`),
]);

// PRD-EVT-05 : intervenants d'une ligne — un poste prestataire de l'événement
// (PRD-EVT-03) ou un texte libre (officiant, témoin…), l'un ou l'autre.
export const programItemParticipants = eventsSchema.table("program_item_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  programItemId: uuid("program_item_id")
    .notNull()
    .references(() => programItems.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id").references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  freeLabel: text("free_label"),
  position: integer("position").notNull().default(0),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("program_item_participants_organization_idx").on(table.organizationId)]);

// Lot 37b (CHR-07, DAT-14 ; D8, ADR 0071) — versions diffusées du programme du jour J. « Diffuser »
// fige une copie numérotée des séquences, sans note interne ; clients et prestataires lisent la
// dernière version diffusée, jamais le programme en cours de modification. En ajout seul : une
// version ne se modifie pas. publishedByUserId est nul pour la version 1 reprise à la migration.
export type ProgramVersionItemRow = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  responsible: string | null;
  participants: { vendorSlotId: string | null; label: string }[];
};

export const programVersions = eventsSchema.table("program_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  publishedByUserId: uuid("published_by_user_id"),
  items: jsonb("items").$type<ProgramVersionItemRow[]>().notNull(),
  // Lot 38a (D9) : la version a été envoyée par e-mail à ses destinataires (date, nombre).
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  notifiedCount: integer("notified_count"),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("program_versions_organization_idx").on(table.organizationId),
  unique("program_versions_event_number_unique").on(table.eventId, table.number),
  check("program_versions_number_check", sql`${table.number} >= 1`),
]);

// PRD-EVT-05 : modèles de programme de l'organisation (CLAUDE.md §2.5). Les
// intervenants d'un modèle sont des libellés, rapprochés des postes de
// l'événement quand le modèle est appliqué.
export const programTemplates = eventsSchema.table("program_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [index("program_templates_organization_idx").on(table.organizationId)]);

export const programTemplateItems = eventsSchema.table("program_template_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => programTemplates.id, { onDelete: "cascade" }),
  startTime: time("start_time").notNull(),
  endTime: time("end_time"),
  label: text("label").notNull(),
  location: text("location"),
  participantLabels: text("participant_labels").array().notNull().default([]),
  position: integer("position").notNull().default(0),
  // Lot 51 (CHR-08, EVT-04) : un modèle porte plusieurs temps forts (week-end de mariage) : nom du
  // temps fort de la ligne et son jour, compté depuis le jour de l'évènement (0 : le jour même).
  momentName: text("moment_name"),
  dayOffset: integer("day_offset").notNull().default(0),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("program_template_items_organization_idx").on(table.organizationId),
  check("program_template_items_moment_check", sql`(${table.momentName} is null or char_length(${table.momentName}) between 1 and 100) and ${table.dayOffset} between -3 and 6`),
]);

// PRD-EVT-06 : accès d'un marié à un événement. Une ligne par invitation ;
// userId est posé à l'acceptation (compte hub.users au rôle « client »),
// revokedAt quand la planner retire l'accès. Le jeton d'invitation n'est
// stocké que haché (même patron que hub.invitations).
// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) — lien personnel
// d'un tiers : une personne, un événement, des droits. Le jeton envoyé est
// « <organisation>.<secret> » : seul le haché du secret est stocké, et il
// disparaît quand le lien est retiré. Remplace event_client_accesses (comptes
// des mariés, ADR 0020).
// Lot 52 (EVT-06, D3, ADR 0094) : « day_helper », le renfort du jour J, sans compte : son lien n'ouvre
// que le mode Jour J de son évènement, de la veille au lendemain, avec un code à usage unique.
export const eventLinkAudienceEnum = eventsSchema.enum("event_link_audience", ["client", "vendor", "guest", "day_helper"]);

export const eventLinks = eventsSchema.table("event_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  audience: eventLinkAudienceEnum("audience").notNull(),
  personName: text("person_name").notNull(),
  email: text("email").notNull(),
  // Le client de l'événement que la personne représente (facultatif : un
  // parent payeur n'en est pas un).
  eventClientId: uuid("event_client_id").references(() => eventClients.id, { onDelete: "set null" }),
  // Lot 36a (CRM-03, SEC-14, D5) : le contact du hub à qui le lien est envoyé ; le nom et l'adresse
  // d'envoi restent une copie (à qui il a été envoyé).
  contactId: uuid("contact_id"),
  // Rubriques du portail ouvertes à la personne (POR-10 : rien par défaut).
  rubrics: text("rubrics").array().notNull().default(sql`'{}'::text[]`),
  // Budget entier, ou seulement les catégories de event_link_shared_slots.
  budgetScope: text("budget_scope").notNull().default("all"),
  // Lot 26b (D9) : le prestataire consulté qu'un lien « vendor » désigne ;
  // retirer le prestataire de l'événement retire son lien.
  vendorCandidateId: uuid("vendor_candidate_id").references(() => eventVendorCandidates.id, { onDelete: "cascade" }),
  // Lot 26b (POR-01, D6) : un code à usage unique est demandé à l'ouverture.
  otpRequired: boolean("otp_required").notNull().default(false),
  // Lot 27a (CHR-04, D7) : rappels par e-mail des tâches de la personne, dans
  // la langue de l'e-mail du lien.
  taskReminders: boolean("task_reminders").notNull().default(true),
  locale: text("locale").notNull().default("fr"),
  // Lot 52 (EVT-06, D3) : téléphone du renfort du jour J, pour l'annuaire du jour (facultatif).
  phone: text("phone"),
  // SEC-15 : dernier jour valable choisi par la planner ; sinon calculé.
  customExpiresOn: date("custom_expires_on"),
  tokenHash: text("token_hash").unique(),
  renewalRequestedAt: timestamp("renewal_requested_at", { withTimezone: true }),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  // Lot 37b (CHR-07, D11) : dernière version diffusée du programme que la personne a vue ; une
  // version plus récente est signalée « Nouvelle version du programme » sur sa page.
  programVersionSeen: integer("program_version_seen"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_links_organization_idx").on(table.organizationId),
  index("event_links_event_idx").on(table.eventId),
  index("event_links_vendor_candidate_idx").on(table.vendorCandidateId),
  index("event_links_contact_idx").on(table.contactId),
  // Lot 49 (INV-02, D5) : rubrique « Invités », fermée par défaut comme les autres (POR-10).
  // Lot 45 (POR-07, D6) : rubrique « Questionnaires », fermée par défaut puis ouverte à l'envoi d'un questionnaire.
  // Lot 60 (L60-PLA-05, POR-10) : rubrique « Plan de salle », fermée par défaut.
  // Lot 55 (POR-06, MSG-03) : rubrique « Messages », fermée par défaut.
  check("event_links_rubrics_check", sql`${table.rubrics} <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires', 'floorplan', 'messages']::text[]`),
  check("event_links_budget_scope_check", sql`${table.budgetScope} in ('all', 'selected')`),
  check("event_links_vendor_candidate_check", sql`${table.audience} <> 'vendor' or ${table.vendorCandidateId} is not null`),
  check("event_links_locale_check", sql`${table.locale} in ('fr', 'en')`),
  // Lot 52 (D3) : un renfort du jour J n'a aucune rubrique du portail ; il demande un code à l'ouverture.
  check("event_links_day_helper_check", sql`${table.audience}::text <> 'day_helper' or (${table.rubrics} = '{}'::text[] and ${table.otpRequired})`),
  check("event_links_phone_check", sql`${table.phone} is null or char_length(${table.phone}) between 1 and 40`),
]);

// Lot 52 (EVT-06, D2 ; ADR 0094) — l'équipe d'un évènement : un planner principal (« lead », un seul
// par évènement : il reçoit les alertes et récapitulatifs du lot 53) et des assistants (tout
// l'évènement, sauf la suppression). Le membre est un compte de l'organisation (hub.memberships, sans
// clé entre schémas) ; son retrait de l'organisation le retire des équipes.
export const EVENT_TEAM_ROLES = ["lead", "assistant"] as const;

export const eventTeamMembers = eventsSchema.table(
  "event_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: EVENT_TEAM_ROLES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_team_members_organization_idx").on(table.organizationId),
    index("event_team_members_event_idx").on(table.eventId),
    index("event_team_members_user_idx").on(table.userId),
    unique("event_team_members_event_user_unique").on(table.eventId, table.userId),
    uniqueIndex("event_team_members_one_lead").on(table.eventId).where(sql`${table.role} = 'lead'`),
    check("event_team_members_role_check", sql`${table.role} in ('lead', 'assistant')`),
  ],
);

// Lot 26a (POR-10) : catégories du budget (postes de l'événement) partagées
// avec un lien en « catégories choisies ».
export const eventLinkSharedSlots = eventsSchema.table("event_link_shared_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => eventLinks.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id")
    .notNull()
    .references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_link_shared_slots_organization_idx").on(table.organizationId),
  unique("event_link_shared_slots_link_slot_unique").on(table.linkId, table.vendorSlotId),
]);

// Lot 26b (POR-01, décision D6) : code à usage unique demandé à l'ouverture
// d'un lien qui l'exige. Six chiffres envoyés à l'e-mail du lien, dont seul le
// haché est ici ; dix minutes, cinq essais, un seul usage.
export const eventLinkCodes = eventsSchema.table("event_link_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => eventLinks.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
}, (table) => [
  index("event_link_codes_organization_idx").on(table.organizationId),
  index("event_link_codes_link_idx").on(table.linkId),
]);

// Lot 27a (CHR-04, décision D7) : rappels envoyés pour une tâche du client, par
// lien et par seuil (sept jours avant, la veille, le lendemain d'un retard) ;
// jamais deux fois le même.
export const eventTaskReminders = eventsSchema.table("event_task_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => eventTasks.id, { onDelete: "cascade" }),
  linkId: uuid("link_id")
    .notNull()
    .references(() => eventLinks.id, { onDelete: "cascade" }),
  threshold: text("threshold").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("event_task_reminders_organization_idx").on(table.organizationId),
  index("event_task_reminders_link_idx").on(table.linkId),
  unique("event_task_reminders_unique").on(table.taskId, table.linkId, table.threshold),
  check("event_task_reminders_threshold_check", sql`${table.threshold} in ('week', 'eve', 'overdue')`),
]);

// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décision demandée
// au client : choisir entre des options d'un poste, valider une dépense,
// approuver le programme. Le contenu est figé à la demande (snapshot) ; une
// décision répondue ou retirée ne se modifie plus (garde en base), une
// nouvelle la remplace (replaces_decision_id). Le nom de la personne est copié
// à la réponse ; effacé avec son lien lors d'une demande d'oubli.
export const eventDecisions = eventsSchema.table("event_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  // Poste (options), ligne du budget (dépense, module budget) ; null pour le programme.
  subjectId: uuid("subject_id"),
  // Poste concerné (options, dépense) : un payeur ne répond que pour ses catégories.
  slotId: uuid("slot_id"),
  title: text("title").notNull(),
  note: text("note"),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  dueOn: date("due_on"),
  status: text("status").notNull().default("pending"),
  // Option choisie (prestataire consulté), pour une décision « options ».
  choiceId: uuid("choice_id"),
  comment: text("comment"),
  decidedByLinkId: uuid("decided_by_link_id").references(() => eventLinks.id, { onDelete: "set null" }),
  decidedByName: text("decided_by_name"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  replacesDecisionId: uuid("replaces_decision_id"),
  // Lot 47 (PAR-05, PRE-09 ; D6, ADR 0085) : le choix d'une décision « options » engage (Retenu, autres
  // Écartés, tâches de suivi) ; la planner modifie ensuite le prestataire retenu quand elle veut.
  engagedAt: timestamp("engaged_at", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_decisions_organization_idx").on(table.organizationId),
  index("event_decisions_event_idx").on(table.eventId),
  check("event_decisions_kind_check", sql`${table.kind} in ('option', 'expense', 'program')`),
  check("event_decisions_status_check", sql`${table.status} in ('pending', 'approved', 'declined', 'withdrawn')`),
  check("event_decisions_answer_check", sql`(${table.status} in ('approved', 'declined')) = (${table.decidedAt} is not null)`),
]);

// Lot 26a (SEC-17, décision D7) : session ouverte par un lien. Le jeton du lien
// quitte l'adresse dès l'ouverture ; le navigateur garde un cookie dont seul le
// haché est ici. 30 jours sans visite, jamais au-delà de l'expiration du lien,
// supprimée quand le lien est retiré ou renouvelé.
export const eventLinkSessions = eventsSchema.table("event_link_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => eventLinks.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("event_link_sessions_organization_idx").on(table.organizationId)]);

// PRD-EVT-06 : fil d'activité d'un événement (« quand un marié coche une
// tâche, la planner le voit »). Le libellé de la tâche est copié pour
// rester lisible si la tâche est supprimée ensuite.
// Lot 27b (EVT-09) : « decision_made », une décision répondue par un lien.
// Lot 32a (PAR-03, SC-03 étape 5, décision D6) : « vendor_reminded », un prestataire relancé depuis
// le cockpit ; task_label reste vide, le nom se lit sur le prestataire (RGP-05).
// Lot 37a (DOC-04, D7) : « document_link_opened », un lien de partage d'un document ouvert ;
// task_label porte l'intitulé du document.
// Lot 44 (CRM-02) : « stage_changed », une carte passée à une autre étape du pipeline ; task_label
// porte le nom de l'étape au moment du déplacement.
// Lot 47 (PAR-05, PRE-04) : « vendor_answered » (réponse d'un prestataire à un brief),
// « vendor_invoice_received » (facture déposée), « vendor_roadmap_confirmed » (feuille de route
// reçue) ; task_label reste vide, le nom se lit sur le prestataire (RGP-05).
export const eventActivityKindEnum = eventsSchema.enum("event_activity_kind", [
  "task_done",
  "task_undone",
  "decision_made",
  "vendor_reminded",
  "document_link_opened",
  "stage_changed",
  "vendor_answered",
  "vendor_invoice_received",
  "vendor_roadmap_confirmed",
]);

export const eventActivities = eventsSchema.table("event_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  // Compte d'une personne de l'équipe, ou (lot 26a) lien personnel du tiers
  // qui a coché ; l'un des deux, sauf si le lien a été effacé depuis.
  actorUserId: uuid("actor_user_id"),
  actorLinkId: uuid("actor_link_id").references(() => eventLinks.id, { onDelete: "set null" }),
  kind: eventActivityKindEnum("kind").notNull(),
  taskId: uuid("task_id").references(() => eventTasks.id, { onDelete: "set null" }),
  taskLabel: text("task_label").notNull(),
  // Lot 32a (D6) : le prestataire relancé.
  vendorCandidateId: uuid("vendor_candidate_id").references(() => eventVendorCandidates.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("event_activities_organization_idx").on(table.organizationId)]);

// Lot 12 (L12-EVT-15) — lieux d'un événement (réception, cérémonie,
// préparatifs…), saisis une fois puis choisis dans le programme. vendor_id
// : fiche du carnet (module vendors) d'où vient le lieu, sans clé étrangère.
export const eventPlaces = eventsSchema.table("event_places", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  address: text("address"),
  // Lot 34b (EVT-03, D10) : le premier lieu (position la plus petite) est le lieu de réception ;
  // chaque lieu porte sa ville, ses horaires (début et fin, facultatifs) et son contact.
  city: text("city"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  vendorId: uuid("vendor_id"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("event_places_organization_idx").on(table.organizationId),
  check(
    "event_places_details_check",
    sql`(${table.city} is null or char_length(${table.city}) <= 200) and (${table.contactName} is null or char_length(${table.contactName}) <= 200) and (${table.contactPhone} is null or char_length(${table.contactPhone}) <= 40) and (${table.contactEmail} is null or char_length(${table.contactEmail}) <= 320)`,
  ),
]);

// Lot 37a (DOC-01, D3 ; ADR 0070) : dossiers des documents d'un évènement, un seul niveau, nommés
// par l'équipe ; un document sans dossier est rangé dans « Divers ».
export const eventDocumentFolders = eventsSchema.table("event_document_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_document_folders_organization_idx").on(table.organizationId),
  index("event_document_folders_event_idx").on(table.eventId),
  check("event_document_folders_name_check", sql`char_length(${table.name}) between 1 and 80`),
]);

// Lot 29b (JRJ-04, décision D8 ; ADR 0064) : documents propres à l'événement
// (plan de table, plans d'accès, plan B), envoyés par la planner. Le fichier est
// privé (Garage), contrôlé à l'envoi (type par le contenu, antivirus) et servi par
// l'app après contrôle des droits (ADR 0027).
// Lot 37a (DOC-01, POR-10 ; D3, D4, D6 ; ADR 0070) : un dossier ; le fichier est celui de la
// dernière version (event_document_versions garde toutes les versions) ; partagé, à la main, avec
// les clients et les prestataires de l'évènement (rien par défaut).
export const eventDocuments = eventsSchema.table("event_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fileKey: text("file_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // Lot 47 (PRE-04) : une facture déposée par un prestataire retenu, par son lien, n'a pas d'auteur
  // dans l'équipe ; le lien qui l'a déposée est gardé (nul s'il est effacé depuis).
  uploadedByUserId: uuid("uploaded_by_user_id"),
  uploadedByLinkId: uuid("uploaded_by_link_id").references((): AnyPgColumn => eventLinks.id, { onDelete: "set null" }),
  folderId: uuid("folder_id").references(() => eventDocumentFolders.id, { onDelete: "set null" }),
  sharedWithClients: boolean("shared_with_clients").notNull().default(false),
  sharedWithVendors: boolean("shared_with_vendors").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("event_documents_organization_idx").on(table.organizationId),
  index("event_documents_event_idx").on(table.eventId),
  check("event_documents_label_check", sql`char_length(${table.label}) between 1 and 200`),
  check("event_documents_size_check", sql`${table.sizeBytes} > 0`),
]);

// Lot 37a (DOC-01, D4) : versions d'un document déposé, numérotées ; une nouvelle version garde les
// précédentes, consultables. La dernière est recopiée sur le document (event_documents).
export const eventDocumentVersions = eventsSchema.table("event_document_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => eventDocuments.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  fileKey: text("file_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // Lot 47 : nul pour une facture déposée par un prestataire (voir event_documents).
  uploadedByUserId: uuid("uploaded_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_document_versions_organization_idx").on(table.organizationId),
  unique("event_document_versions_unique").on(table.documentId, table.version),
  check("event_document_versions_version_check", sql`${table.version} >= 1`),
  check("event_document_versions_size_check", sql`${table.sizeBytes} > 0`),
]);

// Lot 37a (DOC-04, D7 ; ADR 0070) : lien de partage d'un document, à durée limitée (1 à 30 jours),
// pour une personne sans lien personnel. Jeton gardé haché (SEC-14), révocable ; expiré ou révoqué,
// il répond comme un lien inconnu. Les ouvertures sont comptées et journalisées.
export const eventDocumentLinks = eventsSchema.table("event_document_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => eventDocuments.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").notNull(),
  openCount: integer("open_count").notNull().default(0),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_document_links_organization_idx").on(table.organizationId),
  index("event_document_links_document_idx").on(table.documentId),
  check("event_document_links_open_count_check", sql`${table.openCount} >= 0`),
]);

// Lot 29b (JRJ-04, décision D8) : documents embarqués pour le jour J, choisis
// pour l'événement (toute l'équipe embarque les mêmes). Une pièce vient d'un
// module (source) ; pas de clé étrangère entre schémas : le module la confirme
// par son service.ts à chaque lecture.
export const eventDayDocuments = eventsSchema.table("event_day_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceId: uuid("source_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_day_documents_organization_idx").on(table.organizationId),
  unique("event_day_documents_unique").on(table.eventId, table.source, table.sourceId),
  check("event_day_documents_source_check", sql`${table.source} in ('event_document', 'signed_quote', 'budget_attachment', 'candidate_quote')`),
]);

// Lot 30a (JRJ-03, décision D4) : contacts du jour J saisis pour l'événement
// (régisseur du domaine, taxi, pharmacie de garde), avec les numéros d'urgence
// nationaux (fichier de données) dans l'annuaire de l'écran du jour J.
export const eventDayContacts = eventsSchema.table("event_day_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  phone: text("phone").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_day_contacts_organization_idx").on(table.organizationId),
  index("event_day_contacts_event_idx").on(table.eventId),
  check("event_day_contacts_name_check", sql`char_length(${table.name}) between 1 and 120`),
  check("event_day_contacts_role_check", sql`${table.role} is null or char_length(${table.role}) between 1 and 120`),
  check("event_day_contacts_phone_check", sql`char_length(${table.phone}) between 3 and 40`),
]);

// Lot 34b (CHR-02, D13) : pièces jointes d'une tâche, réservées à l'équipe. Le fichier est
// contrôlé à l'envoi comme les documents de l'événement (type par le contenu, taille, antivirus,
// stockage privé) et servi par l'app après contrôle des droits (ADR 0027).
export const eventTaskAttachments = eventsSchema.table("event_task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => eventTasks.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fileKey: text("file_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_task_attachments_organization_idx").on(table.organizationId),
  index("event_task_attachments_task_idx").on(table.taskId),
  check("event_task_attachments_label_check", sql`char_length(${table.label}) between 1 and 200`),
  check("event_task_attachments_size_check", sql`${table.sizeBytes} > 0`),
]);

// Lot 34b (CHR-02, D13) : fil de commentaires d'une tâche (auteur, date, texte), lu et écrit par
// l'équipe. L'auteur est un compte de l'organisation, sans clé étrangère entre schémas.
export const eventTaskComments = eventsSchema.table("event_task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => eventTasks.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("event_task_comments_organization_idx").on(table.organizationId),
  index("event_task_comments_task_idx").on(table.taskId),
  check("event_task_comments_body_check", sql`char_length(${table.body}) between 1 and 2000`),
]);

// Lot 49 (EVT-04 premier pas, INV-03 ; D2) : temps forts de l'évènement (cérémonie, dîner,
// brunch), gérés depuis la fiche. Le RSVP demande la présence par temps fort ; le lot 51 les
// complète (chrono par temps fort, évènement sur plusieurs jours). Lieu facultatif parmi les lieux
// de l'évènement.
export const keyMoments = eventsSchema.table("key_moments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Date sans heure (CLAUDE.md § 5) ; heure de début facultative, dans le fuseau de l'évènement.
  date: date("date").notNull(),
  startTime: time("start_time"),
  placeId: uuid("place_id").references(() => eventPlaces.id, { onDelete: "set null" }),
  position: integer("position").notNull().default(0),
  // Lot 51 (EVT-04 ; D1) : temps fort unique créé de lui-même pour porter le chrono d'un évènement
  // d'un jour (migration 0165, puis à la première séquence). Tant que la planner ne l'a pas modifié,
  // il n'est pas proposé aux invités : rien ne change pour eux.
  autoCreated: boolean("auto_created").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("key_moments_organization_idx").on(table.organizationId),
  index("key_moments_event_idx").on(table.eventId),
  check("key_moments_name_check", sql`char_length(${table.name}) between 1 and 100`),
]);

// Lot 44 (CRM-01 ; D1 à D5 ; ADR 0084) — le formulaire de contact public d'une organisation
// (/contact/<adresse>). Une ligne par organisation ; l'adresse est unique et se lit sans organisation
// (exception écrite de la RLS, comme la page de réservation du lot 46) ; rien de personnel n'y figure.
// hidden_fields : champs facultatifs masqués ; allowed_origins : sites qui peuvent l'encadrer
// (https, cinq au plus) ; locale : langue des textes de départ (source, e-mail à la titulaire).
export const CONTACT_FORM_OPTIONAL_FIELDS = ["phone", "date", "place", "budget", "guests", "eventType", "source", "message"] as const;

export const contactForms = eventsSchema.table(
  "contact_forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    active: boolean("active").notNull().default(false),
    slug: text("slug").notNull(),
    hiddenFields: text("hidden_fields").array().notNull().default(sql`'{}'::text[]`),
    privacyPolicyUrl: text("privacy_policy_url"),
    allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
    notifyOwner: boolean("notify_owner").notNull().default(true),
    locale: text("locale").notNull().default("fr"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("contact_forms_organization_idx").on(table.organizationId),
    uniqueIndex("contact_forms_slug_idx").on(table.slug),
    check("contact_forms_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.slug}) between 3 and 60`),
    check("contact_forms_hidden_fields_check", sql`${table.hiddenFields} <@ array['phone', 'date', 'place', 'budget', 'guests', 'eventType', 'source', 'message']::text[]`),
    check("contact_forms_privacy_url_check", sql`${table.privacyPolicyUrl} is null or (${table.privacyPolicyUrl} ~ '^https://' and char_length(${table.privacyPolicyUrl}) <= 500)`),
    check("contact_forms_origins_check", sql`coalesce(array_length(${table.allowedOrigins}, 1), 0) <= 5`),
    check("contact_forms_locale_check", sql`${table.locale} in ('fr', 'en')`),
  ],
);

// Lot 44 (CRM-01 ; D4, D5 ; ADR 0084) — une demande reçue par le formulaire de contact. « received » :
// le prospect est créé (évènement Option, contact du hub), la demande garde le message, la période et
// la tranche de budget, affichés tels quels. « to_review » : envoi mis de côté (message à liens) ; rien
// n'est encore créé, les champs reçus attendent dans « pending » ; effacée à 30 jours si elle n'est pas
// traitée (contact-form.json).
export const prospectRequests = eventsSchema.table(
  "prospect_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    message: text("message"),
    period: text("period"),
    budgetRange: text("budget_range"),
    pending: jsonb("pending").$type<Record<string, string> | null>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("prospect_requests_organization_idx").on(table.organizationId),
    index("prospect_requests_event_idx").on(table.eventId),
    check("prospect_requests_state_check", sql`(${table.state} = 'received' and ${table.eventId} is not null and ${table.pending} is null) or (${table.state} = 'to_review' and ${table.eventId} is null and ${table.pending} is not null)`),
    check(
      "prospect_requests_text_check",
      sql`(${table.message} is null or char_length(${table.message}) <= 5000) and (${table.period} is null or char_length(${table.period}) <= 100) and (${table.budgetRange} is null or char_length(${table.budgetRange}) <= 100)`,
    ),
  ],
);

// Lot 51 (JRJ-05 à JRJ-09, ARC-09 ; D2 à D5, ADR 0091) — le jour J de terrain. Toute écriture du
// jour J part d'une file sur l'appareil, même sans réseau : chaque ligne garde l'identifiant de
// l'action créé sur le téléphone (unique par organisation : une action rejouée est ignorée), la
// personne qui l'a faite et l'heure de l'appareil. Les pointages s'ajoutent, jamais ne s'écrasent.
export const dayCheckpoints = eventsSchema.table(
  "day_checkpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    programItemId: uuid("program_item_id")
      .notNull()
      .references(() => programItems.id, { onDelete: "cascade" }),
    // « started » (Commencé) ou « finished » (Terminé).
    kind: text("kind").notNull(),
    deviceAt: timestamp("device_at", { withTimezone: true }).notNull(),
    // Lot 52 (EVT-06, D3) : l'auteur est un compte de l'équipe, ou le lien du renfort du jour J.
    userId: uuid("user_id"),
    linkId: uuid("link_id").references((): AnyPgColumn => eventLinks.id, { onDelete: "set null" }),
    actionId: uuid("action_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_checkpoints_organization_idx").on(table.organizationId),
    index("day_checkpoints_event_idx").on(table.eventId),
    index("day_checkpoints_item_idx").on(table.programItemId),
    unique("day_checkpoints_action_unique").on(table.organizationId, table.actionId),
    check("day_checkpoints_kind_check", sql`${table.kind} in ('started', 'finished')`),
    check("day_checkpoints_author_check", sql`${table.userId} is null or ${table.linkId} is null`),
  ],
);

// Un décalage validé par la planner (JRJ-05) : de combien, quelles séquences, quels prestataires
// prévenus. Rien n'est envoyé sans cette ligne ; « applied_at » quand le programme est décalé et une
// version diffusée, « notified_at » quand les e-mails sont inscrits dans la file (une seule fois).
export const dayShifts = eventsSchema.table(
  "day_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    keyMomentId: uuid("key_moment_id").references(() => keyMoments.id, { onDelete: "set null" }),
    lateItemId: uuid("late_item_id").references(() => programItems.id, { onDelete: "set null" }),
    minutes: integer("minutes").notNull(),
    itemIds: uuid("item_ids").array().notNull(),
    vendorSlotIds: uuid("vendor_slot_ids").array().notNull().default(sql`'{}'::uuid[]`),
    validatedAt: timestamp("validated_at", { withTimezone: true }).notNull(),
    validatedBy: uuid("validated_by").notNull(),
    actionId: uuid("action_id").notNull(),
    // « applied » : programme décalé ; « out_of_day » ou « items_missing » : refusé à l'arrivée.
    outcome: text("outcome"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    programVersion: integer("program_version"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    notifiedCount: integer("notified_count"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_shifts_organization_idx").on(table.organizationId),
    index("day_shifts_event_idx").on(table.eventId),
    unique("day_shifts_action_unique").on(table.organizationId, table.actionId),
    check("day_shifts_minutes_check", sql`${table.minutes} between 1 and 720`),
    check("day_shifts_items_check", sql`coalesce(array_length(${table.itemIds}, 1), 0) between 1 and 200 and coalesce(array_length(${table.vendorSlotIds}, 1), 0) <= 200`),
    check("day_shifts_outcome_check", sql`${table.outcome} is null or ${table.outcome} in ('applied', 'out_of_day', 'items_missing')`),
  ],
);

// Photo du jour J (JRJ-06, JRJ-07, JRJ-09) : réduite sur le téléphone, contrôlée à l'arrivée (type,
// taille, antivirus, ADR 0027). Une photo refusée garde sa ligne, sans fichier : l'écran le dit, et
// l'incident ou la case restent. Interne à l'organisation ; purgée avec l'évènement (DPO-9).
export const dayPhotos = eventsSchema.table(
  "day_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // « incident », « checklist_item » ou « handover » (reçu d'une remise, échéance du budget).
    subject: text("subject").notNull(),
    subjectId: uuid("subject_id").notNull(),
    state: text("state").notNull(),
    rejection: text("rejection"),
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    // Lot 52 (D3) : prise par un compte de l'équipe, ou par le lien du renfort du jour J.
    takenBy: uuid("taken_by"),
    takenByLinkId: uuid("taken_by_link_id").references((): AnyPgColumn => eventLinks.id, { onDelete: "set null" }),
    actionId: uuid("action_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_photos_organization_idx").on(table.organizationId),
    index("day_photos_event_idx").on(table.eventId),
    index("day_photos_subject_idx").on(table.subjectId),
    unique("day_photos_action_unique").on(table.organizationId, table.actionId),
    check("day_photos_subject_check", sql`${table.subject} in ('incident', 'checklist_item', 'handover')`),
    check("day_photos_author_check", sql`${table.takenBy} is null or ${table.takenByLinkId} is null`),
    check(
      "day_photos_state_check",
      sql`(${table.state} = 'stored' and ${table.storageKey} is not null and ${table.contentType} is not null and ${table.sizeBytes} > 0 and ${table.rejection} is null) or (${table.state} = 'rejected' and ${table.storageKey} is null and ${table.rejection} in ('type', 'size', 'virus', 'unavailable'))`,
    ),
  ],
);

// Main courante (JRJ-07) : incident horodaté, dicté par le clavier du téléphone (D2), gravité
// facultative. Données de travail : ni nom d'invité ni donnée de santé (l'aide le rappelle).
export const dayIncidents = eventsSchema.table(
  "day_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    keyMomentId: uuid("key_moment_id").references(() => keyMoments.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    severity: text("severity"),
    deviceAt: timestamp("device_at", { withTimezone: true }).notNull(),
    // Lot 52 (D3) : écrit par un compte de l'équipe, ou par le lien du renfort du jour J.
    userId: uuid("user_id"),
    linkId: uuid("link_id").references((): AnyPgColumn => eventLinks.id, { onDelete: "set null" }),
    actionId: uuid("action_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_incidents_organization_idx").on(table.organizationId),
    index("day_incidents_event_idx").on(table.eventId),
    unique("day_incidents_action_unique").on(table.organizationId, table.actionId),
    check("day_incidents_author_check", sql`${table.userId} is null or ${table.linkId} is null`),
    check("day_incidents_body_check", sql`char_length(${table.body}) between 1 and 2000`),
    check("day_incidents_severity_check", sql`${table.severity} is null or ${table.severity} in ('info', 'follow_up', 'urgent')`),
  ],
);

// Modèles de listes de contrôle de l'organisation (JRJ-06), copiés des données de départ
// (day-checklists.json) à la première lecture ; la planner les modifie (HUB-20).
export const dayChecklistTemplates = eventsSchema.table(
  "day_checklist_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    starterKey: text("starter_key"),
    name: text("name").notNull(),
    // « setup » (installation) ou « teardown » (démontage).
    phase: text("phase").notNull(),
    items: text("items").array().notNull().default(sql`'{}'::text[]`),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_checklist_templates_organization_idx").on(table.organizationId),
    unique("day_checklist_templates_starter_unique").on(table.organizationId, table.starterKey),
    check("day_checklist_templates_name_check", sql`char_length(${table.name}) between 1 and 100`),
    check("day_checklist_templates_phase_check", sql`${table.phase} in ('setup', 'teardown')`),
    check("day_checklist_templates_items_check", sql`coalesce(array_length(${table.items}, 1), 0) <= 100`),
  ],
);

// La liste d'un temps fort, copiée d'un modèle (ou vide), et ses cases.
export const dayChecklists = eventsSchema.table(
  "day_checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    keyMomentId: uuid("key_moment_id").references(() => keyMoments.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => dayChecklistTemplates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phase: text("phase").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_checklists_organization_idx").on(table.organizationId),
    index("day_checklists_event_idx").on(table.eventId),
    check("day_checklists_name_check", sql`char_length(${table.name}) between 1 and 100`),
    check("day_checklists_phase_check", sql`${table.phase} in ('setup', 'teardown')`),
  ],
);

// Une case : cochée d'un toucher (heure de l'appareil, personne, action) ; la première coche reste.
export const dayChecklistItems = eventsSchema.table(
  "day_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => dayChecklists.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    checkedBy: uuid("checked_by"),
    // Lot 52 (D3) : case cochée par le lien du renfort du jour J.
    checkedByLinkId: uuid("checked_by_link_id").references((): AnyPgColumn => eventLinks.id, { onDelete: "set null" }),
    checkActionId: uuid("check_action_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("day_checklist_items_organization_idx").on(table.organizationId),
    index("day_checklist_items_checklist_idx").on(table.checklistId),
    check("day_checklist_items_label_check", sql`char_length(${table.label}) between 1 and 200`),
    // Lot 52 : cochée par un compte ou par un lien (ce dernier peut disparaître avec son évènement).
    check(
      "day_checklist_items_check_check",
      sql`(${table.checkedAt} is null and ${table.checkedBy} is null and ${table.checkedByLinkId} is null) or (${table.checkedAt} is not null and (${table.checkedBy} is null or ${table.checkedByLinkId} is null))`,
    ),
  ],
);

// Le bilan du lendemain (PAR-08, étape 7) : la dernière synthèse préparée, interne à l'organisation.
export type DayReportSummaryRow = Record<string, unknown>;

export const dayReports = eventsSchema.table(
  "day_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull(),
    summary: jsonb("summary").$type<DayReportSummaryRow>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("day_reports_organization_idx").on(table.organizationId), uniqueIndex("day_reports_event_idx").on(table.eventId)],
);
// --- Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; ADR 0085) : prestataires par lien. ---

// D1, D10 : un brief par poste, envoyé à plusieurs prestataires. Le budget indicatif est facultatif
// et masqué par défaut ; montré seulement si la planner le coche. Montants en centimes, EUR (TTC).
export const vendorBriefs = eventsSchema.table("vendor_briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id")
    .notNull()
    .references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  need: text("need").notNull(),
  guestCount: integer("guest_count"),
  indicativeBudgetCents: integer("indicative_budget_cents"),
  showBudget: boolean("show_budget").notNull().default(false),
  // Date limite de réponse, sans heure, dans le fuseau de l'évènement.
  deadline: date("deadline").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentByUserId: uuid("sent_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendor_briefs_organization_idx").on(table.organizationId),
  index("vendor_briefs_event_idx").on(table.eventId),
  unique("vendor_briefs_slot_unique").on(table.vendorSlotId),
  check("vendor_briefs_need_check", sql`char_length(${table.need}) between 1 and 4000`),
  check("vendor_briefs_guest_count_check", sql`${table.guestCount} is null or ${table.guestCount} between 0 and 100000`),
  check("vendor_briefs_budget_check", sql`${table.indicativeBudgetCents} is null or ${table.indicativeBudgetCents} >= 0`),
]);

// Les inspirations d'un brief : des documents de l'évènement, choisis un par un.
export const vendorBriefDocuments = eventsSchema.table("vendor_brief_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  briefId: uuid("brief_id")
    .notNull()
    .references(() => vendorBriefs.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => eventDocuments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendor_brief_documents_organization_idx").on(table.organizationId),
  unique("vendor_brief_documents_unique").on(table.briefId, table.documentId),
]);

// D5 (BUD-05) : scénarios d'options d'un évènement ; au plus un prestataire consulté par poste.
export const vendorScenarios = eventsSchema.table("vendor_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendor_scenarios_organization_idx").on(table.organizationId),
  index("vendor_scenarios_event_idx").on(table.eventId),
  check("vendor_scenarios_name_check", sql`char_length(${table.name}) between 1 and 120`),
]);

export const vendorScenarioChoices = eventsSchema.table("vendor_scenario_choices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  scenarioId: uuid("scenario_id")
    .notNull()
    .references(() => vendorScenarios.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id")
    .notNull()
    .references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => eventVendorCandidates.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendor_scenario_choices_organization_idx").on(table.organizationId),
  unique("vendor_scenario_choices_slot_unique").on(table.scenarioId, table.vendorSlotId),
]);

// D7 (PRE-09) : l'avis d'un client sur une option d'une décision, avant de choisir (« J'aime »,
// « Pas pour nous », un commentaire court). Un avis par lien et par option ; le lien effacé, l'avis
// reste sans auteur.
export const eventDecisionOptionFeedback = eventsSchema.table("event_decision_option_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => eventDecisions.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => eventVendorCandidates.id, { onDelete: "cascade" }),
  linkId: uuid("link_id").references(() => eventLinks.id, { onDelete: "set null" }),
  opinion: text("opinion"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("event_decision_option_feedback_organization_idx").on(table.organizationId),
  index("event_decision_option_feedback_decision_idx").on(table.decisionId),
  unique("event_decision_option_feedback_unique").on(table.decisionId, table.candidateId, table.linkId),
  check("event_decision_option_feedback_opinion_check", sql`${table.opinion} is null or ${table.opinion} in ('like', 'dislike')`),
  check("event_decision_option_feedback_comment_check", sql`${table.comment} is null or char_length(${table.comment}) between 1 and 500`),
  check("event_decision_option_feedback_content_check", sql`${table.opinion} is not null or ${table.comment} is not null`),
]);

// D8 (PAR-05 étapes 5 et 6) : feuille de route d'un prestataire retenu, envoyée à J-30 et à J-7
// (une fois chacune) ; sa confirmation de réception, horodatée, et la version du programme vue.
export const vendorRoadmaps = eventsSchema.table("vendor_roadmaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => eventVendorCandidates.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  programVersion: integer("program_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendor_roadmaps_organization_idx").on(table.organizationId),
  index("vendor_roadmaps_candidate_idx").on(table.candidateId),
  unique("vendor_roadmaps_stage_unique").on(table.candidateId, table.stage),
  check("vendor_roadmaps_stage_check", sql`${table.stage} in ('j30', 'j7')`),
]);

// Partie F : réglages de l'organisation (titulaire). Sans ligne, les valeurs par défaut valent ;
// follow_up_tasks nul : la liste de départ (vendor-follow-up-tasks.json, HUB-20).
export const vendorCoordinationSettings = eventsSchema.table("vendor_coordination_settings", {
  organizationId: uuid("organization_id").primaryKey(),
  briefDeadlineDays: integer("brief_deadline_days").notNull().default(7),
  briefReminder: boolean("brief_reminder").notNull().default(true),
  roadmapMonth: boolean("roadmap_month").notNull().default(true),
  roadmapWeek: boolean("roadmap_week").notNull().default(true),
  roadmapAlertDays: integer("roadmap_alert_days").notNull().default(3),
  followUpTasks: jsonb("follow_up_tasks").$type<{ label: string; dueInDays: number }[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  check("vendor_coordination_settings_deadline_check", sql`${table.briefDeadlineDays} between 1 and 60`),
  check("vendor_coordination_settings_alert_check", sql`${table.roadmapAlertDays} between 1 and 6`),
]);

// Lot 45 (CRM-05, CRM-06, CRM-03 ; D1 à D3 ; ADR 0090) — les messages échangés avec le contact d'un
// évènement, rangés dans son historique : une réponse de la planner (« reply », depuis un modèle),
// une relance (« follow_up »), un questionnaire envoyé (« questionnaire ») ; et deux faits notés par
// la planner d'un geste : « a répondu » (« answered ») et « ne plus relancer » (« stop »). Un message
// part de Symbola (« sent ») ou s'ouvre dans la messagerie de la planner (« prepared ») ; un fait noté
// est « noted ». Le lien de la brochure n'est gardé que haché, et expire (30 jours, données de départ).
export const EVENT_MESSAGE_KINDS = ["reply", "follow_up", "questionnaire", "answered", "stop"] as const;
export const EVENT_MESSAGE_DELIVERIES = ["sent", "prepared", "noted"] as const;

export const eventMessages = eventsSchema.table(
  "event_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // Le contact du hub (sans clé étrangère entre schémas, avenant de l'ADR 0012) ; vide quand le RGPD
    // l'a retiré, ou pour un fait noté sans destinataire.
    contactId: uuid("contact_id"),
    kind: text("kind", { enum: EVENT_MESSAGE_KINDS }).notNull(),
    delivery: text("delivery", { enum: EVENT_MESSAGE_DELIVERIES }).notNull(),
    // Le modèle de message (hub.message_templates) et sa version, pour mémoire ; vides sans modèle.
    templateId: uuid("template_id"),
    templateVersion: integer("template_version"),
    subject: text("subject"),
    body: text("body"),
    brochureTokenHash: text("brochure_token_hash").unique(),
    brochureExpiresAt: timestamp("brochure_expires_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_messages_organization_idx").on(table.organizationId),
    index("event_messages_event_idx").on(table.eventId, table.occurredAt),
    index("event_messages_contact_idx").on(table.contactId),
    check("event_messages_kind_check", sql`${table.kind} in ('reply', 'follow_up', 'questionnaire', 'answered', 'stop')`),
    check(
      "event_messages_delivery_check",
      sql`(${table.kind} in ('answered', 'stop') and ${table.delivery} = 'noted') or (${table.kind} not in ('answered', 'stop') and ${table.delivery} in ('sent', 'prepared'))`,
    ),
    check("event_messages_text_check", sql`(${table.subject} is null or char_length(${table.subject}) <= 200) and (${table.body} is null or char_length(${table.body}) <= 5000)`),
    check("event_messages_brochure_check", sql`(${table.brochureTokenHash} is null) = (${table.brochureExpiresAt} is null)`),
  ],
);

// Lot 45 (CRM-06 ; D2) — le réglage des relances d'une organisation, copié des données de départ
// (prospect-follow-ups.json) à la première lecture : jusqu'à trois relances, chacune à son nombre de
// jours après le dernier envoi de la planner et avec son modèle de message (vide : le texte de la
// nature « prospect_follow_up ») ; envoi automatique désactivé par défaut. La brochure (PDF) de
// l'organisation y est rangée : sa clé dans le stockage privé, son nom et sa taille.
export type ProspectFollowUpStep = { days: number; messageTemplateId: string | null };

export const prospectFollowUpSettings = eventsSchema.table(
  "prospect_follow_up_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    autoSend: boolean("auto_send").notNull().default(false),
    steps: jsonb("steps").$type<ProspectFollowUpStep[]>().notNull().default(sql`'[]'::jsonb`),
    brochureStorageKey: text("brochure_storage_key"),
    brochureFileName: text("brochure_file_name"),
    brochureSizeBytes: integer("brochure_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("prospect_follow_up_settings_organization_idx").on(table.organizationId),
    check("prospect_follow_up_settings_steps_check", sql`jsonb_typeof(${table.steps}) = 'array' and jsonb_array_length(${table.steps}) <= 3`),
    check(
      "prospect_follow_up_settings_brochure_check",
      sql`(${table.brochureStorageKey} is null) = (${table.brochureFileName} is null) and (${table.brochureFileName} is null or char_length(${table.brochureFileName}) between 1 and 200)`,
    ),
  ],
);

// Lot 45 (CRM-06 ; D2, D3) — une relance d'un prospect, préparée à son jour (« prête ») après le
// dernier envoi de la planner (« anchor ») : la planner la relit et l'envoie d'un geste, ou la retire ;
// l'envoi automatique, s'il est réglé, l'envoie seul. Elle s'arrête (stopped_at, stop_reason) dès qu'un
// fait le dit : « a répondu », changement d'étape, confirmation, refus, action du prospect, nouvel
// envoi de la planner, « ne plus relancer » ; c'est revérifié juste avant l'envoi. Une seule relance
// par rang et par envoi de la planner.
export const PROSPECT_FOLLOW_UP_STOP_REASONS = ["answered", "stage_changed", "confirmed", "lost", "prospect_action", "new_message", "stopped", "withdrawn", "no_recipient"] as const;

export const prospectFollowUps = eventsSchema.table(
  "prospect_follow_ups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id"),
    anchorMessageId: uuid("anchor_message_id")
      .notNull()
      .references(() => eventMessages.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentMessageId: uuid("sent_message_id").references(() => eventMessages.id, { onDelete: "set null" }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    stopReason: text("stop_reason", { enum: PROSPECT_FOLLOW_UP_STOP_REASONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("prospect_follow_ups_organization_idx").on(table.organizationId),
    index("prospect_follow_ups_event_idx").on(table.eventId),
    uniqueIndex("prospect_follow_ups_anchor_rank_idx").on(table.anchorMessageId, table.rank),
    check("prospect_follow_ups_rank_check", sql`${table.rank} between 1 and 3`),
    check("prospect_follow_ups_text_check", sql`char_length(${table.subject}) between 1 and 200 and char_length(${table.body}) between 1 and 5000`),
    check(
      "prospect_follow_ups_state_check",
      sql`(${table.stoppedAt} is null) = (${table.stopReason} is null) and not (${table.sentAt} is not null and ${table.stoppedAt} is not null)`,
    ),
    check("prospect_follow_ups_stop_reason_check", sql`${table.stopReason} is null or ${table.stopReason} in ('answered', 'stage_changed', 'confirmed', 'lost', 'prospect_action', 'new_message', 'stopped', 'withdrawn', 'no_recipient')`),
  ],
);

// Lot 45 (POR-07, CRM-09, HUB-21 ; D6 à D8 ; ADR 0090) — modèles de questionnaires (découverte,
// cérémonie, musiques, détails pratiques…), pour tous les évènements ou pour un type, dans une langue,
// duplicables et versionnés : un enregistrement des questions fait une version (les questions d'une
// version restent telles quelles). Un questionnaire envoyé garde ses questions (copie figée).
export const questionnaireTemplates = eventsSchema.table(
  "questionnaire_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    locale: text("locale").notNull(),
    // Clé du modèle de départ (questionnaires.json), nulle pour un modèle de l'organisation.
    starterKey: text("starter_key"),
    // Numéro de la version en cours (la plus récente).
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("questionnaire_templates_organization_idx").on(table.organizationId),
    check("questionnaire_templates_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("questionnaire_templates_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("questionnaire_templates_version_check", sql`${table.version} >= 1`),
  ],
);

// Une question d'une version d'un modèle. « item_key » la désigne d'une version à l'autre (et d'un
// questionnaire à l'autre pour les modèles de départ) ; « event_field » : le champ de l'évènement
// qu'elle alimente. Pas de question « fichier » (D8).
export const QUESTION_NATURES = ["short_text", "long_text", "single_choice", "multiple_choice", "date", "number", "amount"] as const;
export const QUESTION_EVENT_FIELDS = ["event_date", "guests", "budget", "venue", "city", "style", "event_type"] as const;

export const questionnaireTemplateItems = eventsSchema.table(
  "questionnaire_template_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => questionnaireTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    position: integer("position").notNull().default(0),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    help: text("help"),
    nature: text("nature", { enum: QUESTION_NATURES }).notNull(),
    choices: text("choices").array().notNull().default(sql`'{}'::text[]`),
    eventField: text("event_field", { enum: QUESTION_EVENT_FIELDS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("questionnaire_template_items_organization_idx").on(table.organizationId),
    uniqueIndex("questionnaire_template_items_key_idx").on(table.templateId, table.version, table.itemKey),
    check("questionnaire_template_items_label_check", sql`char_length(${table.label}) between 1 and 300 and (${table.help} is null or char_length(${table.help}) <= 500)`),
    check("questionnaire_template_items_key_check", sql`${table.itemKey} ~ '^[a-z0-9_-]{1,60}$'`),
    check("questionnaire_template_items_nature_check", sql`${table.nature} in ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'number', 'amount')`),
    check(
      "questionnaire_template_items_choices_check",
      sql`(${table.nature} in ('single_choice', 'multiple_choice')) = (coalesce(array_length(${table.choices}, 1), 0) between 2 and 30)`,
    ),
    check("questionnaire_template_items_event_field_check", sql`${table.eventField} is null or ${table.eventField} in ('event_date', 'guests', 'budget', 'venue', 'city', 'style', 'event_type')`),
  ],
);

// Lot 45 (POR-07, CRM-09 ; D7) — un questionnaire envoyé à un contact de l'évènement, par son lien
// personnel (rubrique « Questionnaires »). Ses questions sont une copie figée de la version du modèle
// (HUB-21) ; « finished_at » : « Terminer », qui prévient la planner et préremplit l'évènement.
export type FrozenQuestion = {
  key: string;
  label: string;
  help: string | null;
  nature: (typeof QUESTION_NATURES)[number];
  choices: string[];
  eventField: (typeof QUESTION_EVENT_FIELDS)[number] | null;
};

export const eventQuestionnaires = eventsSchema.table(
  "event_questionnaires",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id"),
    linkId: uuid("link_id").references(() => eventLinks.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => questionnaireTemplates.id, { onDelete: "set null" }),
    templateVersion: integer("template_version").notNull(),
    name: text("name").notNull(),
    locale: text("locale").notNull(),
    questions: jsonb("questions").$type<FrozenQuestion[]>().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // La planner a vu « Questionnaire terminé » (Aujourd'hui).
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_questionnaires_organization_idx").on(table.organizationId),
    index("event_questionnaires_event_idx").on(table.eventId),
    index("event_questionnaires_link_idx").on(table.linkId),
    index("event_questionnaires_contact_idx").on(table.contactId),
    check("event_questionnaires_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("event_questionnaires_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("event_questionnaires_questions_check", sql`jsonb_typeof(${table.questions}) = 'array' and jsonb_array_length(${table.questions}) between 1 and 100`),
  ],
);

// Une réponse, enregistrée à chaque question (reprise possible). « resolution » : pour une réponse qui
// alimente un champ déjà rempli autrement, le choix de la planner (« applied » : la réponse remplace la
// fiche ; « kept » : la fiche reste) ; « filled » : le champ était vide et a été rempli.
export const QUESTIONNAIRE_ANSWER_RESOLUTIONS = ["filled", "applied", "kept"] as const;

export const questionnaireAnswers = eventsSchema.table(
  "questionnaire_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => eventQuestionnaires.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    value: jsonb("value").$type<string | string[] | number>().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
    resolution: text("resolution", { enum: QUESTIONNAIRE_ANSWER_RESOLUTIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("questionnaire_answers_organization_idx").on(table.organizationId),
    uniqueIndex("questionnaire_answers_item_idx").on(table.questionnaireId, table.itemKey),
    check("questionnaire_answers_value_check", sql`jsonb_typeof(${table.value}) in ('string', 'array', 'number') and octet_length(${table.value}::text) <= 6000`),
    check("questionnaire_answers_resolution_check", sql`${table.resolution} is null or ${table.resolution} in ('filled', 'applied', 'kept')`),
  ],
);

// Lot 53 (HUB-24 ; D8 ; ADR 0095) — le terme qui désigne les clients d'un type d'évènement, dans une
// langue, avec son genre et son nombre (« les mariés », masculin pluriel ; « le commanditaire »,
// masculin singulier). Il remplace, pour ce type, le vocabulaire fixe de l'ADR 0045 là où l'app nomme
// les clients, et remplit la variable {{terme_clients}} des e-mails et des documents à venir ; un
// document déjà émis garde son texte. Sans ligne, le vocabulaire du type (mariés ou clients) vaut.
export const VOCABULARY_GENDERS = ["masculine", "feminine", "neuter"] as const;
export const VOCABULARY_NUMBERS = ["singular", "plural"] as const;

export const eventTypeVocabulary = eventsSchema.table(
  "event_type_vocabulary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    term: text("term").notNull(),
    gender: text("gender", { enum: VOCABULARY_GENDERS }).notNull(),
    number: text("number", { enum: VOCABULARY_NUMBERS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_type_vocabulary_organization_idx").on(table.organizationId),
    uniqueIndex("event_type_vocabulary_type_locale_idx").on(table.eventTypeId, table.locale),
    check("event_type_vocabulary_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("event_type_vocabulary_term_check", sql`char_length(btrim(${table.term})) between 1 and 40`),
    check("event_type_vocabulary_gender_check", sql`${table.gender} in ('masculine', 'feminine', 'neuter')`),
    check("event_type_vocabulary_number_check", sql`${table.number} in ('singular', 'plural')`),
  ],
);

// Lot 53 (CHR-05) — seuils de l'indicateur de santé du planning, par organisation : une tâche en retard
// compte un point, un jalon en retard milestone_weight points ; « à surveiller » à partir de
// watch_points, « en retard » à partir de late_points. Sans ligne, les valeurs de départ
// (planning-health.json).
export const planningHealthSettings = eventsSchema.table(
  "planning_health_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    watchPoints: integer("watch_points").notNull(),
    latePoints: integer("late_points").notNull(),
    milestoneWeight: integer("milestone_weight").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("planning_health_settings_organization_idx").on(table.organizationId),
    check("planning_health_settings_points_check", sql`${table.watchPoints} between 1 and 100 and ${table.latePoints} between 1 and 100 and ${table.watchPoints} <= ${table.latePoints}`),
    check("planning_health_settings_weight_check", sql`${table.milestoneWeight} between 1 and 10`),
  ],
);

// Lot 58 (PAR-09 ; D4 ; ADR 0097) — clôture d'un évènement, une par évènement : étapes cochées à la
// main, temps passé (déclaratif et facultatif, en minutes), trois leçons, frais propres de la planner
// (libellé et montant HT en centimes, hors du budget du client), budget final figé à la clôture (les
// cinq montants), demande d'avis envoyée. Interne : jamais montrée au client ni au comptable.
export type ClosingOwnExpense = { label: string; amountCents: number };
export type ClosingBudgetSnapshot = { estimatedCents: number; committedCents: number; paidCents: number; remainingCents: number; varianceCents: number };
export const CLOSING_REVIEW_KINDS = ["thanks", "thanks_with_review"] as const;

export const eventClosings = eventsSchema.table(
  "event_closings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    checkedSteps: text("checked_steps").array().notNull().default(sql`'{}'::text[]`),
    timeSpentMinutes: integer("time_spent_minutes"),
    lessons: text("lessons").array().notNull().default(sql`'{}'::text[]`),
    ownExpenses: jsonb("own_expenses").$type<ClosingOwnExpense[]>().notNull().default(sql`'[]'::jsonb`),
    budgetSnapshot: jsonb("budget_snapshot").$type<ClosingBudgetSnapshot | null>(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by"),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    reviewRequestKind: text("review_request_kind", { enum: CLOSING_REVIEW_KINDS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_closings_organization_idx").on(table.organizationId),
    uniqueIndex("event_closings_event_idx").on(table.eventId),
    check("event_closings_time_spent_check", sql`${table.timeSpentMinutes} is null or ${table.timeSpentMinutes} between 0 and 360000`),
    check("event_closings_lessons_check", sql`cardinality(${table.lessons}) <= 10`),
    check("event_closings_expenses_check", sql`jsonb_typeof(${table.ownExpenses}) = 'array' and jsonb_array_length(${table.ownExpenses}) <= 100`),
    check("event_closings_review_check", sql`(${table.reviewRequestKind} is null or ${table.reviewRequestKind} in ('thanks', 'thanks_with_review')) and ((${table.reviewRequestedAt} is null) = (${table.reviewRequestKind} is null))`),
    check("event_closings_closed_check", sql`(${table.closedAt} is null) = (${table.budgetSnapshot} is null)`),
  ],
);

// Lot 58 (PAR-09 ; ADR 0097) — réglages de la clôture, un par organisation : le lien d'avis choisi par
// la planner (Google, Mariages.net, son site) et son nom ; sans lien, la demande d'avis ne propose que
// le remerciement.
export const closingSettings = eventsSchema.table(
  "closing_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    reviewUrl: text("review_url"),
    reviewLabel: text("review_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("closing_settings_organization_idx").on(table.organizationId),
    check("closing_settings_review_url_check", sql`${table.reviewUrl} is null or (${table.reviewUrl} like 'https://%' and char_length(${table.reviewUrl}) <= 500)`),
    check("closing_settings_review_label_check", sql`${table.reviewLabel} is null or char_length(${table.reviewLabel}) between 1 and 60`),
  ],
);

// Lot 58 (EVT-08 ; D5 ; ADR 0097) — modèle d'évènement : des structures seulement (rétroplanning,
// programme, postes et lignes du budget sans montant, questionnaires) et, si la planner l'a coché, les
// prestataires. Aucune donnée personnelle de client : contrôlé avant l'enregistrement.
export const eventTemplates = eventsSchema.table(
  "event_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    name: text("name").notNull(),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
    sourceEventId: uuid("source_event_id").references((): AnyPgColumn => events.id, { onDelete: "set null" }),
    includesVendors: boolean("includes_vendors").notNull().default(false),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_templates_organization_idx").on(table.organizationId),
    check("event_templates_name_check", sql`char_length(btrim(${table.name})) between 1 and 120`),
    check("event_templates_content_check", sql`jsonb_typeof(${table.content}) = 'object'`),
  ],
);

// Lot 55 (MSG-03, POR-06 ; D3 ; ADR 0102) — sujets de discussion d'un évènement (« Traiteur »,
// « Cérémonie »), chacun avec son fil.
export const messageTopics = eventsSchema.table(
  "message_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("message_topics_organization_idx").on(table.organizationId),
    index("message_topics_event_idx").on(table.eventId),
    check("message_topics_name_check", sql`char_length(btrim(${table.name})) between 1 and 120`),
  ],
);

// Les prestataires ajoutés à un sujet par la planner (leurs liens) : ils en lisent les messages
// partagés. Retirer le lien retire le prestataire du sujet.
export const messageTopicLinks = eventsSchema.table(
  "message_topic_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => messageTopics.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => eventLinks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("message_topic_links_organization_idx").on(table.organizationId),
    uniqueIndex("message_topic_links_unique_idx").on(table.topicId, table.linkId),
    index("message_topic_links_link_idx").on(table.linkId),
  ],
);

// Un message d'un sujet. « internal » : l'équipe seulement, jamais écrit par un lien (contrainte) ;
// « shared » : les clients et les prestataires du sujet. La visibilité ne change jamais : le rôle
// applicatif n'a pas le droit de modifier un message (lecture, ajout, effacement seulement).
export const messages = eventsSchema.table(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => messageTopics.id, { onDelete: "cascade" }),
    visibility: text("visibility", { enum: ["internal", "shared"] }).notNull(),
    authorKind: text("author_kind", { enum: ["team", "link"] }).notNull(),
    authorUserId: uuid("author_user_id"),
    authorLinkId: uuid("author_link_id").references(() => eventLinks.id, { onDelete: "set null" }),
    // Copie du nom affiché de l'auteur (le lien peut être retiré).
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("messages_organization_idx").on(table.organizationId),
    index("messages_topic_idx").on(table.topicId, table.createdAt),
    index("messages_event_idx").on(table.eventId),
    check("messages_visibility_check", sql`${table.visibility} in ('internal', 'shared')`),
    check("messages_author_kind_check", sql`${table.authorKind} in ('team', 'link')`),
    // Un message interne vient toujours de l'équipe ; un lien n'écrit que des messages partagés.
    check("messages_internal_team_check", sql`${table.visibility} = 'shared' or ${table.authorKind} = 'team'`),
    check("messages_author_check", sql`(${table.authorKind} = 'team' and ${table.authorLinkId} is null) or (${table.authorKind} = 'link' and ${table.authorUserId} is null)`),
    check("messages_author_name_check", sql`char_length(${table.authorName}) between 1 and 200`),
    check("messages_body_check", sql`char_length(${table.body}) between 1 and 5000`),
  ],
);

// Pièces jointes d'un message : contrôlées à l'envoi (type par le contenu, taille, antivirus,
// stockage privé) et servies par l'app après contrôle des droits (ADR 0027).
export const messageAttachments = eventsSchema.table(
  "message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    fileKey: text("file_key").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("message_attachments_organization_idx").on(table.organizationId),
    index("message_attachments_message_idx").on(table.messageId),
    check("message_attachments_label_check", sql`char_length(${table.label}) between 1 and 200`),
    check("message_attachments_size_check", sql`${table.sizeBytes} > 0`),
  ],
);

// Lot 55 (POR-11 ; ADR 0102) — un appareil d'un client abonné au push du portail (facultatif,
// désactivé par défaut) : nouveaux messages et décisions demandées. Données techniques.
export const linkPushSubscriptions = eventsSchema.table(
  "link_push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => eventLinks.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("link_push_subscriptions_organization_idx").on(table.organizationId),
    index("link_push_subscriptions_link_idx").on(table.linkId),
    uniqueIndex("link_push_subscriptions_endpoint_idx").on(table.organizationId, table.endpoint),
    check("link_push_subscriptions_endpoint_check", sql`${table.endpoint} ~ '^https://' and char_length(${table.endpoint}) <= 1000`),
    check("link_push_subscriptions_keys_check", sql`char_length(${table.p256dh}) between 80 and 100 and char_length(${table.auth}) between 16 and 32`),
  ],
);
