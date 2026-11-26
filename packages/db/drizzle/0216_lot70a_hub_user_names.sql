-- Lot 70a (CHR-02 ; A1, « je préfère les champs qui reprennent prénom/nom dans mon compte », 26/11/2026) :
-- prénom et nom d'une personne, saisis par elle dans Mon compte (1 à 80 caractères, sans caractère de
-- contrôle). Ils appartiennent à la personne, pas à l'organisation : hub.users, pas hub.memberships.
-- Schéma hub seulement (accord de Julien, A1) ; colonnes facultatives, compatibles avec l'image précédente.
ALTER TABLE "hub"."users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD CONSTRAINT "users_first_name_check" CHECK ("hub"."users"."first_name" is null or (char_length("hub"."users"."first_name") between 1 and 80 and "hub"."users"."first_name" !~ '[[:cntrl:]]'));--> statement-breakpoint
ALTER TABLE "hub"."users" ADD CONSTRAINT "users_last_name_check" CHECK ("hub"."users"."last_name" is null or (char_length("hub"."users"."last_name") between 1 and 80 and "hub"."users"."last_name" !~ '[[:cntrl:]]'));