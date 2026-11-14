-- Lot 33b (HUB-09, HUB-03 ; décisions D11 et D12) : le profil de l'organisation garde deux
-- réponses du questionnaire d'accueil, le volume d'évènements par an et les outils remplacés (clés
-- des listes de départ, packages/starter-templates) ; une invitation porte le rôle de l'adhésion
-- qu'elle crée (Propriétaire par l'Exploitation, Planner par la Propriétaire). Les invitations déjà
-- émises restent des invitations de Propriétaire.
ALTER TABLE "hub"."invitations" ADD COLUMN "role" "hub"."membership_role" DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "annual_event_volume" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "replaced_tools" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_annual_event_volume_check" CHECK ("hub"."organization_profiles"."annual_event_volume" is null or char_length("hub"."organization_profiles"."annual_event_volume") between 1 and 40);--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_replaced_tools_check" CHECK (cardinality("hub"."organization_profiles"."replaced_tools") <= 10);