-- Lot 72a (EVT-05 ; E1, J1 tranchée par Julien le 27/11/2026 ; ADR 0121) : le statut « En préparation »
-- est retiré. Aucune règle ne le distinguait de « Confirmé » ; l'écran les réunit en une étape (« Signé,
-- en préparation »). Étape de données : les évènements et les lignes d'historique qui le portent passent
-- à « Confirmé ». PostgreSQL ne retire pas une valeur d'énumération : nouveau type, colonnes converties,
-- ancien type supprimé. Schéma events seulement.
-- symbola: arret-requis le statut in_preparation disparaît de events.event_status : l'ancienne version de l'app peut encore l'écrire
UPDATE "events"."events" SET "status" = 'confirmed' WHERE "status" = 'in_preparation';
--> statement-breakpoint
UPDATE "events"."events" SET "postponed_from_status" = 'confirmed' WHERE "postponed_from_status" = 'in_preparation';
--> statement-breakpoint
UPDATE "events"."event_status_history" SET "from_status" = 'confirmed' WHERE "from_status" = 'in_preparation';
--> statement-breakpoint
UPDATE "events"."event_status_history" SET "to_status" = 'confirmed' WHERE "to_status" = 'in_preparation';
--> statement-breakpoint
ALTER TYPE "events"."event_status" RENAME TO "event_status_before_lot72a";
--> statement-breakpoint
CREATE TYPE "events"."event_status" AS ENUM('option', 'confirmed', 'closed', 'postponed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DATA TYPE "events"."event_status" USING "status"::text::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DEFAULT 'option';
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "postponed_from_status" SET DATA TYPE "events"."event_status" USING "postponed_from_status"::text::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "from_status" SET DATA TYPE "events"."event_status" USING "from_status"::text::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "to_status" SET DATA TYPE "events"."event_status" USING "to_status"::text::"events"."event_status";
--> statement-breakpoint
DROP TYPE "events"."event_status_before_lot72a";
