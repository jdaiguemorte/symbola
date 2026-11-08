ALTER TABLE "hub"."users" ADD COLUMN "mfa_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "totp_last_used_step" bigint;