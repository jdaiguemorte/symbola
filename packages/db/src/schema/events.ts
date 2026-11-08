// Schéma du module events (Lot 2, EVT-01/02/07). Tables métier : chaque
// table a organization_id (CLAUDE.md §2.4), protégée par Row-Level
// Security activée par une migration dédiée (même patron que hello,
// packages/db/drizzle).
import { boolean, date, integer, pgSchema, text, time, timestamp, unique, uuid, jsonb } from "drizzle-orm/pg-core";

export const eventsSchema = pgSchema("events");

// Statuts fixes du cycle de vie d'un événement (PRD EVT-02) — pas une
// liste personnalisable par organisation, à la différence des sources de
// prospect et des motifs de perte ci-dessous.
export const eventStatusEnum = eventsSchema.enum("event_status", [
  "prospect",
  "quote_sent",
  "confirmed",
  "done",
  "lost",
]);

// EVT-07 : « la source est obligatoire, choisie dans une liste qu'elle
// paramètre » — jamais codée en dur (CLAUDE.md §2.5), gérée par
// organisation.
export const prospectSources = eventsSchema.table("prospect_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-02 : motif de perte, également paramétrable par organisation
// (CLAUDE.md §2.5 cite « motifs » comme exemple explicite). isFreeText
// marque l'entrée « autre » : une note libre devient alors obligatoire.
export const lossReasons = eventsSchema.table("loss_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  isFreeText: boolean("is_free_text").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
  },
  (table) => [unique("event_types_organization_starter_key_unique").on(table.organizationId, table.starterKey)],
);

export const events = eventsSchema.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  status: eventStatusEnum("status").notNull().default("prospect"),
  // Date sans heure (CLAUDE.md §5) ; nulle tant que la date n'est pas
  // fixée (« Date à définir », EVT-01).
  eventDate: date("event_date"),
  // Lieu en texte libre : l'app Prestataires (fiches réutilisables) est
  // V2, hors MVP (cahier des charges §5.5).
  venueName: text("venue_name"),
  venueCity: text("venue_city"),
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
  // EVT-04 : date de l'événement pour laquelle les échéances du
  // rétroplanning ont été calculées. Quand eventDate en diffère, l'app
  // propose de recalculer les échéances des tâches non faites.
  tasksScheduledFor: date("tasks_scheduled_for"),
  // EVT-05 : dernière modification du programme du jour J (ajout,
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
});

// Prénoms/noms affichés dans la liste (EVT-01) ; position fixe l'ordre
// d'affichage (ex. « Alice & Bob »).
export const eventClients = eventsSchema.table("event_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  // Lot 14 (décision I) : coordonnées du client (registre RGPD).
  email: text("email"),
  phone: text("phone"),
  addressLine: text("address_line"),
  postalCode: text("postal_code"),
  city: text("city"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-02 : « chaque changement [de statut] est historisé (date, auteur) ».
export const eventStatusHistory = eventsSchema.table("event_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  fromStatus: eventStatusEnum("from_status"),
  toStatus: eventStatusEnum("to_status").notNull(),
  changedByUserId: uuid("changed_by_user_id").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-03 : statuts fixes d'un poste prestataire (PRD) — pas une liste
// personnalisable, à la différence des postes eux-mêmes.
export const vendorSlotStatusEnum = eventsSchema.enum("vendor_slot_status", [
  "to_find",
  "quote_requested",
  "quote_received",
  "booked",
  "not_required",
]);

// EVT-03 : « la liste de postes par défaut de la planner » — paramétrable
// par organisation (CLAUDE.md §2.5), éventuellement chargée depuis le
// modèle de départ (packages/starter-templates), jamais codée en dur.
export const defaultVendorSlots = eventsSchema.table("default_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  // Lot 12 (EVT-14) : icône de la ligne du budget (clé connue de l'app).
  icon: text("icon"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-03 : postes d'un événement, copiés de la liste par défaut à la
// création puis modifiables événement par événement.
export const eventVendorSlots = eventsSchema.table("event_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  label: text("label").notNull(),
  status: vendorSlotStatusEnum("status").notNull().default("to_find"),
  // Nom du prestataire en texte libre au MVP (l'app Prestataires est V2).
  vendorName: text("vendor_name"),
  // Montant en centimes, devise explicite (CLAUDE.md §5) ; facultatif.
  amountCents: integer("amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  position: integer("position").notNull().default(0),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  // Lot 11 (EVT-10) : ce que veulent les clients pour ce poste, et le
  // prestataire consulté retenu (null tant qu'aucun ne l'est).
  brief: text("brief"),
  selectedCandidateId: uuid("selected_candidate_id"),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 11 (EVT-10) — réponse d'un prestataire consulté : statuts fixes,
// comme ceux du poste (« Retenu » / « Non retenu » se déduisent du poste).
export const vendorCandidateResponseEnum = eventsSchema.enum("vendor_candidate_response", [
  "contacted",
  "quote_received",
  "declined",
]);

// Lot 11 (EVT-10) — prestataires consultés pour un poste. vendor_id
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
  response: vendorCandidateResponseEnum("response").notNull().default("contacted"),
  contactedOn: date("contacted_on"),
  quoteAmountCents: integer("quote_amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  quoteFileKey: text("quote_file_key"),
  quoteMime: text("quote_mime"),
  quoteSizeBytes: integer("quote_size_bytes"),
  shownToClients: boolean("shown_to_clients").notNull().default(false),
  // Lot 12 (EVT-16) : RIB de la fiche du carnet partagé aux clients de l'événement.
  shareRibWithClients: boolean("share_rib_with_clients").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 11 (EVT-11) — notes sur un prestataire consulté : internes par
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
});

// EVT-04 : responsable d'une tâche du rétroplanning (PRD). Une tâche des
// « clients » apparaîtra dans l'espace des mariés (EVT-06).
export const taskResponsibleEnum = eventsSchema.enum("task_responsible", ["planner", "clients"]);

// EVT-04 : modèles de rétroplanning de l'organisation (CLAUDE.md §2.5 :
// jamais codés en dur ; un modèle de départ peut être chargé depuis
// packages/starter-templates).
export const taskTemplates = eventsSchema.table("task_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
});

// EVT-04 : tâches du rétroplanning d'un événement.
export const eventTasks = eventsSchema.table("event_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  label: text("label").notNull(),
  // Échéance, date sans heure (CLAUDE.md §5).
  dueDate: date("due_date").notNull(),
  responsible: taskResponsibleEnum("responsible").notNull().default("planner"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-05 : programme du jour J d'un événement. Heures sans date (« HH:MM »),
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
  // Jamais dans la variante « mariés » du PDF (PRD EVT-05).
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-05 : intervenants d'une ligne — un poste prestataire de l'événement
// (EVT-03) ou un texte libre (officiant, témoin…), l'un ou l'autre.
export const programItemParticipants = eventsSchema.table("program_item_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  programItemId: uuid("program_item_id")
    .notNull()
    .references(() => programItems.id, { onDelete: "cascade" }),
  vendorSlotId: uuid("vendor_slot_id").references(() => eventVendorSlots.id, { onDelete: "cascade" }),
  freeLabel: text("free_label"),
  position: integer("position").notNull().default(0),
});

// EVT-05 : modèles de programme de l'organisation (CLAUDE.md §2.5). Les
// intervenants d'un modèle sont des libellés, rapprochés des postes de
// l'événement quand le modèle est appliqué.
export const programTemplates = eventsSchema.table("program_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
});

// EVT-06 : accès d'un marié à un événement. Une ligne par invitation ;
// userId est posé à l'acceptation (compte hub.users au rôle « client »),
// revokedAt quand la planner retire l'accès. Le jeton d'invitation n'est
// stocké que haché (même patron que hub.invitations).
export const eventClientAccesses = eventsSchema.table("event_client_accesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  email: text("email").notNull(),
  userId: uuid("user_id"),
  tokenHash: text("token_hash").unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedByUserId: uuid("invited_by_user_id").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-06 : fil d'activité d'un événement (« quand un marié coche une
// tâche, la planner le voit »). Le libellé de la tâche est copié pour
// rester lisible si la tâche est supprimée ensuite.
export const eventActivityKindEnum = eventsSchema.enum("event_activity_kind", ["task_done", "task_undone"]);

export const eventActivities = eventsSchema.table("event_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  actorUserId: uuid("actor_user_id").notNull(),
  kind: eventActivityKindEnum("kind").notNull(),
  taskId: uuid("task_id").references(() => eventTasks.id, { onDelete: "set null" }),
  taskLabel: text("task_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lot 12 (EVT-15) — lieux d'un événement (réception, cérémonie,
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
  vendorId: uuid("vendor_id"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
