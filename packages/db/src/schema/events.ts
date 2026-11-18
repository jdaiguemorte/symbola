// Schéma du module events (Lot 2, PRD-EVT-01/02/07). Tables métier : chaque
// table a organization_id (CLAUDE.md §2.4), protégée par Row-Level
// Security activée par une migration dédiée (même patron que hello,
// packages/db/drizzle).
import { sql } from "drizzle-orm";
import { boolean, check, date, integer, pgSchema, text, time, timestamp, unique, uniqueIndex, uuid, jsonb, index } from "drizzle-orm/pg-core";

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
}, (table) => [
  index("events_organization_idx").on(table.organizationId),
  check("events_time_zone_check", sql`char_length(${table.timeZone}) between 1 and 64`),
  check("events_guests_check", sql`(${table.guestsEstimated} is null or ${table.guestsEstimated} between 0 and 100000) and (${table.guestsConfirmed} is null or ${table.guestsConfirmed} between 0 and 100000)`),
  check("events_identity_text_check", sql`(${table.style} is null or char_length(${table.style}) <= 2000) and (${table.notes} is null or char_length(${table.notes}) <= 10000)`),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_vendor_candidates_organization_idx").on(table.organizationId)]);

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
export const eventTasks = eventsSchema.table("event_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
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
}, (table) => [
  index("event_tasks_organization_idx").on(table.organizationId),
  index("event_tasks_vendor_candidate_idx").on(table.vendorCandidateId),
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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("program_template_items_organization_idx").on(table.organizationId)]);

// PRD-EVT-06 : accès d'un marié à un événement. Une ligne par invitation ;
// userId est posé à l'acceptation (compte hub.users au rôle « client »),
// revokedAt quand la planner retire l'accès. Le jeton d'invitation n'est
// stocké que haché (même patron que hub.invitations).
// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) — lien personnel
// d'un tiers : une personne, un événement, des droits. Le jeton envoyé est
// « <organisation>.<secret> » : seul le haché du secret est stocké, et il
// disparaît quand le lien est retiré. Remplace event_client_accesses (comptes
// des mariés, ADR 0020).
export const eventLinkAudienceEnum = eventsSchema.enum("event_link_audience", ["client", "vendor", "guest"]);

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
  check("event_links_rubrics_check", sql`${table.rubrics} <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires']::text[]`),
  check("event_links_budget_scope_check", sql`${table.budgetScope} in ('all', 'selected')`),
  check("event_links_vendor_candidate_check", sql`${table.audience} <> 'vendor' or ${table.vendorCandidateId} is not null`),
  check("event_links_locale_check", sql`${table.locale} in ('fr', 'en')`),
]);

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
export const eventActivityKindEnum = eventsSchema.enum("event_activity_kind", ["task_done", "task_undone", "decision_made", "vendor_reminded", "document_link_opened", "stage_changed"]);

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
  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
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
  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
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
