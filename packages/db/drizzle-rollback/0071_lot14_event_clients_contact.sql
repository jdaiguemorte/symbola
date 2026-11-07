-- Annulation de 0071 (lot 14c, DB-01) : coordonnées des clients et budget
-- souhaité. Ces données sont perdues : à ne lancer qu'après une sauvegarde.
ALTER TABLE "events"."event_clients" DROP COLUMN "email";
ALTER TABLE "events"."event_clients" DROP COLUMN "phone";
ALTER TABLE "events"."event_clients" DROP COLUMN "address_line";
ALTER TABLE "events"."event_clients" DROP COLUMN "postal_code";
ALTER TABLE "events"."event_clients" DROP COLUMN "city";
ALTER TABLE "events"."events" DROP COLUMN "wanted_budget_cents";
