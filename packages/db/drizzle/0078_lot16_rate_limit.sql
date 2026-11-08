CREATE TABLE "core"."rate_limit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_lookup_idx" ON "core"."rate_limit_events" USING btree ("bucket","key_hash","created_at");--> statement-breakpoint
-- SEC-02 (ADR 0044) : droits du rôle applicatif, comme les autres tables de
-- core (0005, 0007) ; pas de RLS, la limite s'applique avant toute connexion.
-- Pas d'UPDATE : une tentative enregistrée ne se modifie pas.
GRANT SELECT, INSERT, DELETE ON "core"."rate_limit_events" TO symbola_app;--> statement-breakpoint
GRANT USAGE ON SEQUENCE "core"."rate_limit_events_id_seq" TO symbola_app;
