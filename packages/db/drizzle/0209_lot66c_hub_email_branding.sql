-- Lot 66c (HUB-18, MSG-01 ; décisions D5 et D6 de Julien du 22/11/2026 ; ADR 0113) : la signature et
-- la marque des e-mails de la planner.
-- - hub.email_branding : police, ligne libre du pied, nom affiché de l'expéditeur, éléments affichés
--   des signatures, personne dont la signature porte les envois automatiques (nulle : la titulaire) ;
--   sans ligne : les valeurs de départ.
-- - hub.member_signatures : la signature de chaque membre (nom affiché, fonction, téléphone, site,
--   quatre liens au plus, photo facultative) ; chacun n'écrit que la sienne (politique restrictive).
-- - hub.email_templates.button_label : le libellé du bouton d'un modèle (nul : celui de départ).
-- Schéma hub seulement ; ajouts seuls : compatible avec l'image précédente (ARC-14).
CREATE TABLE "hub"."email_branding" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"font" text DEFAULT 'sans' NOT NULL,
	"footer_line" text,
	"sender_name" text,
	"signature_elements" text[] DEFAULT '{photo,title,organization,phone,website,links}'::text[] NOT NULL,
	"automatic_signer_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "email_branding_font_check" CHECK ("hub"."email_branding"."font" in ('sans', 'serif', 'elegant', 'rounded')),
	CONSTRAINT "email_branding_footer_line_check" CHECK ("hub"."email_branding"."footer_line" is null or (char_length("hub"."email_branding"."footer_line") between 1 and 200 and "hub"."email_branding"."footer_line" !~ '[[:cntrl:]]')),
	CONSTRAINT "email_branding_sender_name_check" CHECK ("hub"."email_branding"."sender_name" is null or (char_length("hub"."email_branding"."sender_name") between 1 and 80 and "hub"."email_branding"."sender_name" !~ '[[:cntrl:]<>"]')),
	CONSTRAINT "email_branding_signature_elements_check" CHECK ("hub"."email_branding"."signature_elements" <@ array['photo', 'title', 'organization', 'phone', 'website', 'links']::text[])
);
--> statement-breakpoint
CREATE TABLE "hub"."member_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"job_title" text,
	"phone" text,
	"website" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_key" text,
	"photo_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "member_signatures_display_name_check" CHECK ("hub"."member_signatures"."display_name" is null or (char_length("hub"."member_signatures"."display_name") between 1 and 120 and "hub"."member_signatures"."display_name" !~ '[[:cntrl:]]')),
	CONSTRAINT "member_signatures_job_title_check" CHECK ("hub"."member_signatures"."job_title" is null or (char_length("hub"."member_signatures"."job_title") between 1 and 120 and "hub"."member_signatures"."job_title" !~ '[[:cntrl:]]')),
	CONSTRAINT "member_signatures_phone_check" CHECK ("hub"."member_signatures"."phone" is null or "hub"."member_signatures"."phone" ~ '^[0-9+(). -]{3,40}$'),
	CONSTRAINT "member_signatures_website_check" CHECK ("hub"."member_signatures"."website" is null or (char_length("hub"."member_signatures"."website") <= 300 and "hub"."member_signatures"."website" ~ '^https?://[^[:space:]"<>]+$')),
	CONSTRAINT "member_signatures_links_check" CHECK (jsonb_typeof("hub"."member_signatures"."links") = 'array' and jsonb_array_length("hub"."member_signatures"."links") <= 4),
	CONSTRAINT "member_signatures_photo_check" CHECK (("hub"."member_signatures"."photo_key" is null) = ("hub"."member_signatures"."photo_size_bytes" is null))
);
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD COLUMN "button_label" text;--> statement-breakpoint
ALTER TABLE "hub"."email_branding" ADD CONSTRAINT "email_branding_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."email_branding" ADD CONSTRAINT "email_branding_automatic_signer_user_id_users_id_fk" FOREIGN KEY ("automatic_signer_user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."member_signatures" ADD CONSTRAINT "member_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_signatures_organization_idx" ON "hub"."member_signatures" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_signatures_user_idx" ON "hub"."member_signatures" USING btree ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_button_label_check" CHECK ("hub"."email_templates"."button_label" is null or (char_length("hub"."email_templates"."button_label") between 1 and 60 and "hub"."email_templates"."button_label" !~ '[[:cntrl:]]'));
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Les lignes
-- partent avec l'organisation (fermeture du lot 35c, core.erase_organization_schema) ; une signature
-- part avec l'accès du membre (retrait par la titulaire).
ALTER TABLE "hub"."email_branding" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."email_branding" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."email_branding"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."email_branding" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "hub"."member_signatures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."member_signatures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."member_signatures"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- D5 et § 6 de la spécification : un membre n'écrit que sa signature, même avec un bug applicatif.
-- L'auteur de la transaction (app.actor_kind, app.actor_id, ADR 0060) est celui de la session ; une
-- tâche de fond ou un script (« system ») n'est pas un membre. La suppression (retrait d'un accès par
-- la titulaire) n'est pas restreinte.
CREATE POLICY own_signature_insert ON "hub"."member_signatures" AS RESTRICTIVE FOR INSERT
  WITH CHECK (coalesce(current_setting('app.actor_kind', true), '') <> 'member' OR user_id::text = current_setting('app.actor_id', true));
--> statement-breakpoint
CREATE POLICY own_signature_update ON "hub"."member_signatures" AS RESTRICTIVE FOR UPDATE
  USING (coalesce(current_setting('app.actor_kind', true), '') <> 'member' OR user_id::text = current_setting('app.actor_id', true))
  WITH CHECK (coalesce(current_setting('app.actor_kind', true), '') <> 'member' OR user_id::text = current_setting('app.actor_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."member_signatures" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "email_branding_stamp" BEFORE INSERT OR UPDATE ON "hub"."email_branding"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "email_branding_journal_deletion" BEFORE DELETE ON "hub"."email_branding"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "member_signatures_stamp" BEFORE INSERT OR UPDATE ON "hub"."member_signatures"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "member_signatures_journal_deletion" BEFORE DELETE ON "hub"."member_signatures"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
