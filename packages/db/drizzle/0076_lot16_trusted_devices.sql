CREATE TABLE "hub"."trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "hub"."trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- SEC-03 (ADR 0038) : droits du rôle applicatif, comme les autres tables
-- d'identité (0003) ; pas de RLS, isolation par packages/auth (ADR 0013).
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."trusted_devices" TO symbola_app;
