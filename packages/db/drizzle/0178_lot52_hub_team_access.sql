-- Lot 52 (HUB-04, HUB-05, EVT-06, SEC-02, SEC-08 ; D1 à D6 ; ADR 0094) : équipe et accès.
-- - Rôle « accountant » (comptable en lecture). La valeur s'ajoute au type sans être employée dans cette
--   migration (ADD VALUE en transaction : utilisable après la validation).
-- - Sessions : appareil lu dans le navigateur, identifiant d'appareil, dernière activité (D4 : ni adresse
--   IP ni ville) ; appareils connus d'un compte (alerte de nouvel appareil, SEC-08).
-- - Transfert de propriété (D1), alertes de changement d'identité (D6), bandeau de double
--   authentification (D5), réglage « toutes les Planners voient tout » (D2, activé : rien ne change
--   pour la pilote). Ajouts seuls : compatibles avec la version précédente du code (ARC-14).
ALTER TYPE "hub"."membership_role" ADD VALUE 'accountant';--> statement-breakpoint
CREATE TABLE "hub"."identity_change_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"delivery_key" text NOT NULL,
	"previous_email" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "identity_change_alerts_delivery_key_unique" UNIQUE("delivery_key"),
	CONSTRAINT "identity_change_alerts_kind_check" CHECK ("hub"."identity_change_alerts"."kind" in ('email', 'mfa', 'password'))
);
--> statement-breakpoint
CREATE TABLE "hub"."known_devices" (
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"device_label" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"alert_token_hash" text,
	"alert_expires_at" timestamp with time zone,
	CONSTRAINT "known_devices_user_id_device_id_pk" PRIMARY KEY("user_id","device_id"),
	CONSTRAINT "known_devices_alert_token_hash_unique" UNIQUE("alert_token_hash")
);
--> statement-breakpoint
CREATE TABLE "hub"."ownership_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "ownership_transfers_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "all_planners_see_all_events" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."sessions" ADD COLUMN "device_label" text;--> statement-breakpoint
ALTER TABLE "hub"."sessions" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "hub"."sessions" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_prompt_dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_factors_fingerprint" text;--> statement-breakpoint
ALTER TABLE "hub"."identity_change_alerts" ADD CONSTRAINT "identity_change_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."known_devices" ADD CONSTRAINT "known_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."ownership_transfers" ADD CONSTRAINT "ownership_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."ownership_transfers" ADD CONSTRAINT "ownership_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."ownership_transfers" ADD CONSTRAINT "ownership_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_change_alerts_user_idx" ON "hub"."identity_change_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "identity_change_alerts_received_idx" ON "hub"."identity_change_alerts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "known_devices_last_seen_idx" ON "hub"."known_devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "ownership_transfers_organization_idx" ON "hub"."ownership_transfers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_transfers_pending_unique" ON "hub"."ownership_transfers" USING btree ("organization_id") WHERE "hub"."ownership_transfers"."confirmed_at" is null and "hub"."ownership_transfers"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "hub"."sessions" USING btree ("user_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."known_devices", "hub"."ownership_transfers", "hub"."identity_change_alerts" TO symbola_app;
