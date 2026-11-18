// Schéma du module appointments (lot 46 : RDV-01 à RDV-04, EVT-10 ; décisions D1 à D11 ; ADR 0083).
// Le module Rendez-vous : types, disponibilités, agendas extérieurs lus (plages occupées seulement),
// rendez-vous, comptes rendus et leurs actions. Chaque table a organization_id (CLAUDE.md § 2.3),
// protégé par Row-Level Security forcée (migration 0151). Les autres modules n'y sont connus que par
// un identifiant opaque : la personne qui reçoit (compte du hub), le contact (hub), l'évènement et la
// tâche (events) ; aucune clé étrangère entre schémas (avenant de l'ADR 0012).
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgSchema, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const appointmentsSchema = pgSchema("appointments");

// Colonnes communes : auteur et dates de la ligne (DAT-06, core.stamp_row).
const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
};

// Suppression logique (ADR 0073), avec la politique restrictive soft_delete_visibility.
const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
};

// D11 — la page publique de réservation de l'organisation : une adresse lisible, unique, choisie par
// la planner (/reserver/<adresse>). L'adresse est publique par nature : la politique de lecture la
// laisse lire sans organisation (retrouver l'organisation d'une adresse), l'écriture reste à la
// seule organisation. Rien d'autre que l'adresse, l'état et la mention d'information (publique,
// affichée sur la page).
export const bookingPages = appointmentsSchema.table(
  "booking_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    slug: text("slug").notNull(),
    active: boolean("active").notNull().default(true),
    // RGP-03 : mention d'information au nom de la planner ; nulle = texte de départ (données).
    privacyNotice: text("privacy_notice"),
    ...stamps,
  },
  (table) => [
    uniqueIndex("booking_pages_organization_idx").on(table.organizationId),
    uniqueIndex("booking_pages_slug_idx").on(table.slug),
    check("booking_pages_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.slug}) between 3 and 60`),
    check("booking_pages_notice_check", sql`${table.privacyNotice} is null or char_length(${table.privacyNotice}) between 1 and 3000`),
  ],
);

// RDV-01 — un type de rendez-vous. Durée de 15 minutes à 8 heures ; lieu (adresse, visio par un lien
// saisi, téléphone) ; marges avant et après ; délai de prévenance et horizon de réservation ;
// rappels (D10) ; zéro à cinq questions préalables ; la personne qui reçoit ; D6 : accepter ou non
// les rendez-vous les jours d'évènement.
export const appointmentTypes = appointmentsSchema.table(
  "appointment_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    locationKind: text("location_kind", { enum: ["place", "video", "phone"] }).notNull().default("video"),
    location: text("location"),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(1440),
    horizonDays: integer("horizon_days").notNull().default(60),
    reminders: text("reminders", { enum: ["none", "24h", "24h_2h"] }).notNull().default("24h"),
    questions: jsonb("questions").$type<{ id: string; label: string; kind: "choice" | "text"; choices: string[] }[]>().notNull().default([]),
    hostUserId: uuid("host_user_id").notNull(),
    allowEventDays: boolean("allow_event_days").notNull().default(false),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...stamps,
    ...softDelete,
  },
  (table) => [
    index("appointment_types_organization_idx").on(table.organizationId),
    check("appointment_types_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("appointment_types_location_kind_check", sql`${table.locationKind} in ('place', 'video', 'phone')`),
    check("appointment_types_reminders_check", sql`${table.reminders} in ('none', '24h', '24h_2h')`),
    check("appointment_types_duration_check", sql`${table.durationMinutes} between 15 and 480`),
    check("appointment_types_location_check", sql`${table.location} is null or char_length(${table.location}) between 1 and 500`),
    check("appointment_types_buffers_check", sql`${table.bufferBeforeMinutes} between 0 and 240 and ${table.bufferAfterMinutes} between 0 and 240`),
    check("appointment_types_notice_check", sql`${table.minNoticeMinutes} between 0 and 43200`),
    check("appointment_types_horizon_check", sql`${table.horizonDays} between 1 and 365`),
    check("appointment_types_questions_check", sql`jsonb_typeof(${table.questions}) = 'array' and jsonb_array_length(${table.questions}) <= 5`),
  ],
);

// Partie A — plages hebdomadaires de la personne qui reçoit (1 = lundi … 7 = dimanche), heures
// murales de Paris.
export const availabilityRules = appointmentsSchema.table(
  "availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    ...stamps,
  },
  (table) => [
    index("availability_rules_organization_idx").on(table.organizationId),
    index("availability_rules_user_idx").on(table.userId),
    check("availability_rules_weekday_check", sql`${table.weekday} between 1 and 7`),
    check("availability_rules_time_check", sql`${table.endTime} > ${table.startTime}`),
  ],
);

// Partie A — jours fermés (congés, salon), du premier au dernier jour compris ; motif court.
export const availabilityClosures = appointmentsSchema.table(
  "availability_closures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    reason: text("reason"),
    ...stamps,
  },
  (table) => [
    index("availability_closures_organization_idx").on(table.organizationId),
    check("availability_closures_dates_check", sql`${table.endsOn} >= ${table.startsOn}`),
    check("availability_closures_reason_check", sql`${table.reason} is null or char_length(${table.reason}) between 1 and 80`),
  ],
);

// D2 — agenda extérieur d'une personne de l'équipe : son adresse secrète ICS, chiffrée au repos
// (DAT-08, ADR 0079 ; « f1: »), jamais affichée en entier (url_hint : hôte et quatre derniers
// caractères). Trois échecs de suite : « error », aucun créneau tant qu'elle n'est pas relue.
export const calendarSources = appointmentsSchema.table(
  "calendar_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    label: text("label").notNull(),
    urlSealed: text("url_sealed").notNull(),
    urlHint: text("url_hint").notNull(),
    state: text("state", { enum: ["pending", "ok", "error"] }).notNull().default("pending"),
    failures: integer("failures").notNull().default(0),
    lastErrorKind: text("last_error_kind"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    ...stamps,
  },
  (table) => [
    index("calendar_sources_organization_idx").on(table.organizationId),
    index("calendar_sources_user_idx").on(table.userId),
    check("calendar_sources_label_check", sql`char_length(${table.label}) between 1 and 80`),
    check("calendar_sources_state_check", sql`${table.state} in ('pending', 'ok', 'error')`),
    check("calendar_sources_sealed_check", sql`${table.urlSealed} like 'f1:%'`),
    check("calendar_sources_hint_check", sql`char_length(${table.urlHint}) between 1 and 120`),
    check("calendar_sources_failures_check", sql`${table.failures} between 0 and 1000`),
    check("calendar_sources_error_check", sql`${table.lastErrorKind} is null or ${table.lastErrorKind} in ('blocked', 'too_large', 'timeout', 'http', 'parse')`),
  ],
);

// D4 — plages occupées d'un agenda extérieur : début et fin seulement (ni titre, ni lieu, ni
// participants), de la veille à l'horizon, remplacées à chaque lecture.
export const busyIntervals = appointmentsSchema.table(
  "busy_intervals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => calendarSources.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("busy_intervals_organization_idx").on(table.organizationId),
    index("busy_intervals_source_idx").on(table.sourceId, table.startsAt),
    check("busy_intervals_range_check", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export type AppointmentAnswer = { questionId: string; label: string; answer: string };

// RDV-02, RDV-03 — un rendez-vous, pris sur la page publique ou saisi par l'équipe. Le type, le lieu
// et les marges sont figés à la réservation ; nom, e-mail et téléphone aussi (le contact du hub peut
// changer). Le lien de gestion (D10) : empreinte du jeton seulement (SEC-14), valable jusqu'à la fin
// du rendez-vous ; le jeton lui-même n'est gardé que chiffré, pour le redonner dans les rappels.
export const appointments = appointmentsSchema.table(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    typeId: uuid("type_id").references(() => appointmentTypes.id, { onDelete: "set null" }),
    typeName: text("type_name").notNull(),
    hostUserId: uuid("host_user_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    locationKind: text("location_kind", { enum: ["place", "video", "phone"] }).notNull(),
    location: text("location"),
    reminders: text("reminders", { enum: ["none", "24h", "24h_2h"] }).notNull().default("24h"),
    status: text("status", { enum: ["booked", "cancelled"] }).notNull().default("booked"),
    origin: text("origin", { enum: ["public", "manual"] }).notNull(),
    personName: text("person_name").notNull(),
    personEmail: text("person_email"),
    personPhone: text("person_phone"),
    locale: text("locale", { enum: ["fr", "en"] }).notNull().default("fr"),
    answers: jsonb("answers").$type<AppointmentAnswer[]>().notNull().default([]),
    contactId: uuid("contact_id"),
    eventId: uuid("event_id"),
    manageTokenHash: text("manage_token_hash"),
    // Le même jeton, chiffré (DAT-08, ADR 0079) : les rappels redonnent le lien déjà envoyé.
    manageTokenSealed: text("manage_token_sealed"),
    rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by", { enum: ["person", "planner"] }),
    cancelReason: text("cancel_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    ...stamps,
    ...softDelete,
  },
  (table) => [
    index("appointments_organization_idx").on(table.organizationId),
    index("appointments_host_start_idx").on(table.hostUserId, table.startsAt),
    index("appointments_event_idx").on(table.eventId),
    index("appointments_contact_idx").on(table.contactId),
    uniqueIndex("appointments_manage_token_idx").on(table.manageTokenHash),
    check("appointments_range_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("appointments_location_kind_check", sql`${table.locationKind} in ('place', 'video', 'phone')`),
    check("appointments_reminders_check", sql`${table.reminders} in ('none', '24h', '24h_2h')`),
    check("appointments_status_check", sql`${table.status} in ('booked', 'cancelled')`),
    check("appointments_origin_check", sql`${table.origin} in ('public', 'manual')`),
    check("appointments_locale_check", sql`${table.locale} in ('fr', 'en')`),
    check("appointments_cancelled_by_check", sql`${table.cancelledBy} is null or ${table.cancelledBy} in ('person', 'planner')`),
    check("appointments_type_name_check", sql`char_length(${table.typeName}) between 1 and 120`),
    check("appointments_person_name_check", sql`char_length(${table.personName}) between 1 and 200`),
    check("appointments_email_check", sql`${table.personEmail} is null or (${table.personEmail} = lower(btrim(${table.personEmail})) and char_length(${table.personEmail}) between 3 and 254)`),
    check("appointments_phone_check", sql`${table.personPhone} is null or char_length(${table.personPhone}) between 1 and 40`),
    check("appointments_buffers_check", sql`${table.bufferBeforeMinutes} between 0 and 240 and ${table.bufferAfterMinutes} between 0 and 240`),
    check("appointments_location_check", sql`${table.location} is null or char_length(${table.location}) between 1 and 500`),
    check("appointments_token_check", sql`${table.manageTokenHash} is null or ${table.manageTokenHash} ~ '^[0-9a-f]{64}$'`),
    check("appointments_token_sealed_check", sql`(${table.manageTokenSealed} is null or ${table.manageTokenSealed} like 'f1:%') and (${table.manageTokenSealed} is null) = (${table.manageTokenHash} is null)`),
    check("appointments_cancel_check", sql`(${table.status} = 'cancelled') = (${table.cancelledAt} is not null)`),
    check("appointments_cancel_reason_check", sql`${table.cancelReason} is null or ${table.cancelReason} in ('schedule', 'other_provider', 'project_changed', 'other')`),
    check("appointments_answers_check", sql`jsonb_typeof(${table.answers}) = 'array' and jsonb_array_length(${table.answers}) <= 5`),
  ],
);

// EVT-10 (D8) — le compte rendu d'un rendez-vous : notes libres (mise en garde de RGP-04) ; l'évènement
// lié (identifiant opaque du module events) est celui du rendez-vous au moment de l'écriture.
export const appointmentReports = appointmentsSchema.table(
  "appointment_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    notes: text("notes"),
    ...stamps,
  },
  (table) => [
    index("appointment_reports_organization_idx").on(table.organizationId),
    uniqueIndex("appointment_reports_appointment_idx").on(table.appointmentId),
    check("appointment_reports_notes_check", sql`${table.notes} is null or char_length(${table.notes}) <= 10000`),
  ],
);

// EVT-10 (D9) — une action du compte rendu (quoi, pour quand, qui) ; « En faire une tâche » la
// change en tâche de l'évènement lié et en garde l'identifiant (opaque).
export const appointmentReportActions = appointmentsSchema.table(
  "appointment_report_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => appointmentReports.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    dueOn: date("due_on"),
    responsible: text("responsible", { enum: ["planner", "clients"] }).notNull().default("planner"),
    taskId: uuid("task_id"),
    taskEventId: uuid("task_event_id"),
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (table) => [
    index("appointment_report_actions_organization_idx").on(table.organizationId),
    index("appointment_report_actions_report_idx").on(table.reportId),
    check("appointment_report_actions_label_check", sql`char_length(${table.label}) between 1 and 200`),
    check("appointment_report_actions_responsible_check", sql`${table.responsible} in ('planner', 'clients')`),
    check("appointment_report_actions_task_check", sql`(${table.taskId} is null) = (${table.taskEventId} is null)`),
  ],
);
