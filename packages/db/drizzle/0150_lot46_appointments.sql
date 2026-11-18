-- Lot 46 (RDV-01 à RDV-04, EVT-10 ; D1 à D11 ; ADR 0080) : le module Rendez-vous, dans son propre
-- schéma (appointments) : page publique de réservation, types, disponibilités, agendas extérieurs
-- (adresse chiffrée, plages occupées seulement), rendez-vous, comptes rendus et actions. Schéma
-- appointments seulement ; les autres modules n'y sont connus que par un identifiant opaque.
-- Ajout seul : compatible avec la version précédente du code (ARC-14). Droits et RLS : 0151.
CREATE SCHEMA "appointments";
--> statement-breakpoint
CREATE TABLE "appointments"."appointment_report_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"label" text NOT NULL,
	"due_on" date,
	"responsible" text DEFAULT 'planner' NOT NULL,
	"task_id" uuid,
	"task_event_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "appointment_report_actions_label_check" CHECK (char_length("appointments"."appointment_report_actions"."label") between 1 and 200),
	CONSTRAINT "appointment_report_actions_responsible_check" CHECK ("appointments"."appointment_report_actions"."responsible" in ('planner', 'clients')),
	CONSTRAINT "appointment_report_actions_task_check" CHECK (("appointments"."appointment_report_actions"."task_id" is null) = ("appointments"."appointment_report_actions"."task_event_id" is null))
);
--> statement-breakpoint
CREATE TABLE "appointments"."appointment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "appointment_reports_notes_check" CHECK ("appointments"."appointment_reports"."notes" is null or char_length("appointments"."appointment_reports"."notes") <= 10000)
);
--> statement-breakpoint
CREATE TABLE "appointments"."appointment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"location_kind" text DEFAULT 'video' NOT NULL,
	"location" text,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_minutes" integer DEFAULT 1440 NOT NULL,
	"horizon_days" integer DEFAULT 60 NOT NULL,
	"reminders" text DEFAULT '24h' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"host_user_id" uuid NOT NULL,
	"allow_event_days" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "appointment_types_name_check" CHECK (char_length("appointments"."appointment_types"."name") between 1 and 120),
	CONSTRAINT "appointment_types_location_kind_check" CHECK ("appointments"."appointment_types"."location_kind" in ('place', 'video', 'phone')),
	CONSTRAINT "appointment_types_reminders_check" CHECK ("appointments"."appointment_types"."reminders" in ('none', '24h', '24h_2h')),
	CONSTRAINT "appointment_types_duration_check" CHECK ("appointments"."appointment_types"."duration_minutes" between 15 and 480),
	CONSTRAINT "appointment_types_location_check" CHECK ("appointments"."appointment_types"."location" is null or char_length("appointments"."appointment_types"."location") between 1 and 500),
	CONSTRAINT "appointment_types_buffers_check" CHECK ("appointments"."appointment_types"."buffer_before_minutes" between 0 and 240 and "appointments"."appointment_types"."buffer_after_minutes" between 0 and 240),
	CONSTRAINT "appointment_types_notice_check" CHECK ("appointments"."appointment_types"."min_notice_minutes" between 0 and 43200),
	CONSTRAINT "appointment_types_horizon_check" CHECK ("appointments"."appointment_types"."horizon_days" between 1 and 365),
	CONSTRAINT "appointment_types_questions_check" CHECK (jsonb_typeof("appointments"."appointment_types"."questions") = 'array' and jsonb_array_length("appointments"."appointment_types"."questions") <= 5)
);
--> statement-breakpoint
CREATE TABLE "appointments"."appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type_id" uuid,
	"type_name" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"location_kind" text NOT NULL,
	"location" text,
	"reminders" text DEFAULT '24h' NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"origin" text NOT NULL,
	"person_name" text NOT NULL,
	"person_email" text,
	"person_phone" text,
	"locale" text DEFAULT 'fr' NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_id" uuid,
	"event_id" uuid,
	"manage_token_hash" text,
	"manage_token_sealed" text,
	"rescheduled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "appointments_range_check" CHECK ("appointments"."appointments"."ends_at" > "appointments"."appointments"."starts_at"),
	CONSTRAINT "appointments_location_kind_check" CHECK ("appointments"."appointments"."location_kind" in ('place', 'video', 'phone')),
	CONSTRAINT "appointments_reminders_check" CHECK ("appointments"."appointments"."reminders" in ('none', '24h', '24h_2h')),
	CONSTRAINT "appointments_status_check" CHECK ("appointments"."appointments"."status" in ('booked', 'cancelled')),
	CONSTRAINT "appointments_origin_check" CHECK ("appointments"."appointments"."origin" in ('public', 'manual')),
	CONSTRAINT "appointments_locale_check" CHECK ("appointments"."appointments"."locale" in ('fr', 'en')),
	CONSTRAINT "appointments_cancelled_by_check" CHECK ("appointments"."appointments"."cancelled_by" is null or "appointments"."appointments"."cancelled_by" in ('person', 'planner')),
	CONSTRAINT "appointments_type_name_check" CHECK (char_length("appointments"."appointments"."type_name") between 1 and 120),
	CONSTRAINT "appointments_person_name_check" CHECK (char_length("appointments"."appointments"."person_name") between 1 and 200),
	CONSTRAINT "appointments_email_check" CHECK ("appointments"."appointments"."person_email" is null or ("appointments"."appointments"."person_email" = lower(btrim("appointments"."appointments"."person_email")) and char_length("appointments"."appointments"."person_email") between 3 and 254)),
	CONSTRAINT "appointments_phone_check" CHECK ("appointments"."appointments"."person_phone" is null or char_length("appointments"."appointments"."person_phone") between 1 and 40),
	CONSTRAINT "appointments_buffers_check" CHECK ("appointments"."appointments"."buffer_before_minutes" between 0 and 240 and "appointments"."appointments"."buffer_after_minutes" between 0 and 240),
	CONSTRAINT "appointments_location_check" CHECK ("appointments"."appointments"."location" is null or char_length("appointments"."appointments"."location") between 1 and 500),
	CONSTRAINT "appointments_token_check" CHECK ("appointments"."appointments"."manage_token_hash" is null or "appointments"."appointments"."manage_token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "appointments_token_sealed_check" CHECK (("appointments"."appointments"."manage_token_sealed" is null or "appointments"."appointments"."manage_token_sealed" like 'f1:%') and ("appointments"."appointments"."manage_token_sealed" is null) = ("appointments"."appointments"."manage_token_hash" is null)),
	CONSTRAINT "appointments_cancel_check" CHECK (("appointments"."appointments"."status" = 'cancelled') = ("appointments"."appointments"."cancelled_at" is not null)),
	CONSTRAINT "appointments_cancel_reason_check" CHECK ("appointments"."appointments"."cancel_reason" is null or "appointments"."appointments"."cancel_reason" in ('schedule', 'other_provider', 'project_changed', 'other')),
	CONSTRAINT "appointments_answers_check" CHECK (jsonb_typeof("appointments"."appointments"."answers") = 'array' and jsonb_array_length("appointments"."appointments"."answers") <= 5)
);
--> statement-breakpoint
CREATE TABLE "appointments"."availability_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "availability_closures_dates_check" CHECK ("appointments"."availability_closures"."ends_on" >= "appointments"."availability_closures"."starts_on"),
	CONSTRAINT "availability_closures_reason_check" CHECK ("appointments"."availability_closures"."reason" is null or char_length("appointments"."availability_closures"."reason") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "appointments"."availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "availability_rules_weekday_check" CHECK ("appointments"."availability_rules"."weekday" between 1 and 7),
	CONSTRAINT "availability_rules_time_check" CHECK ("appointments"."availability_rules"."end_time" > "appointments"."availability_rules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "appointments"."booking_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"privacy_notice" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "booking_pages_slug_check" CHECK ("appointments"."booking_pages"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("appointments"."booking_pages"."slug") between 3 and 60),
	CONSTRAINT "booking_pages_notice_check" CHECK ("appointments"."booking_pages"."privacy_notice" is null or char_length("appointments"."booking_pages"."privacy_notice") between 1 and 3000)
);
--> statement-breakpoint
CREATE TABLE "appointments"."busy_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "busy_intervals_range_check" CHECK ("appointments"."busy_intervals"."ends_at" > "appointments"."busy_intervals"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "appointments"."calendar_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url_sealed" text NOT NULL,
	"url_hint" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_error_kind" text,
	"last_read_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "calendar_sources_label_check" CHECK (char_length("appointments"."calendar_sources"."label") between 1 and 80),
	CONSTRAINT "calendar_sources_state_check" CHECK ("appointments"."calendar_sources"."state" in ('pending', 'ok', 'error')),
	CONSTRAINT "calendar_sources_sealed_check" CHECK ("appointments"."calendar_sources"."url_sealed" like 'f1:%'),
	CONSTRAINT "calendar_sources_hint_check" CHECK (char_length("appointments"."calendar_sources"."url_hint") between 1 and 120),
	CONSTRAINT "calendar_sources_failures_check" CHECK ("appointments"."calendar_sources"."failures" between 0 and 1000),
	CONSTRAINT "calendar_sources_error_check" CHECK ("appointments"."calendar_sources"."last_error_kind" is null or "appointments"."calendar_sources"."last_error_kind" in ('blocked', 'too_large', 'timeout', 'http', 'parse'))
);
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_report_actions" ADD CONSTRAINT "appointment_report_actions_report_id_appointment_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "appointments"."appointment_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments"."appointment_reports" ADD CONSTRAINT "appointment_reports_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_type_id_appointment_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "appointments"."appointment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments"."busy_intervals" ADD CONSTRAINT "busy_intervals_source_id_calendar_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "appointments"."calendar_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_report_actions_organization_idx" ON "appointments"."appointment_report_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "appointment_report_actions_report_idx" ON "appointments"."appointment_report_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "appointment_reports_organization_idx" ON "appointments"."appointment_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reports_appointment_idx" ON "appointments"."appointment_reports" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_types_organization_idx" ON "appointments"."appointment_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "appointments_organization_idx" ON "appointments"."appointments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "appointments_host_start_idx" ON "appointments"."appointments" USING btree ("host_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_event_idx" ON "appointments"."appointments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "appointments_contact_idx" ON "appointments"."appointments" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_manage_token_idx" ON "appointments"."appointments" USING btree ("manage_token_hash");--> statement-breakpoint
CREATE INDEX "availability_closures_organization_idx" ON "appointments"."availability_closures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "availability_rules_organization_idx" ON "appointments"."availability_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "availability_rules_user_idx" ON "appointments"."availability_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_pages_organization_idx" ON "appointments"."booking_pages" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_pages_slug_idx" ON "appointments"."booking_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "busy_intervals_organization_idx" ON "appointments"."busy_intervals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "busy_intervals_source_idx" ON "appointments"."busy_intervals" USING btree ("source_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_sources_organization_idx" ON "appointments"."calendar_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_sources_user_idx" ON "appointments"."calendar_sources" USING btree ("user_id");