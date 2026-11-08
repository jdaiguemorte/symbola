-- Annulation de 0079 (lot 16, ADR 0045) : recrée le schéma hello et sa table
-- témoin, vide, avec la même Row-Level Security et les mêmes droits qu'aux
-- migrations 0000 et 0001. Les lignes de test supprimées ne reviennent pas.
CREATE SCHEMA "hello";
CREATE TABLE "hello"."greetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
GRANT USAGE ON SCHEMA "hello" TO symbola_app;
ALTER TABLE "hello"."greetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hello"."greetings" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "hello"."greetings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "hello"."greetings" TO symbola_app;
