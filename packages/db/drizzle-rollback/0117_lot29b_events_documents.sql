-- Annulation de 0117 (lot 29b) : les documents de l'événement et le choix des
-- documents embarqués sont perdus. Leurs fichiers restent dans le stockage privé,
-- sans ligne qui y mène : à effacer à la main si l'annulation est définitive
-- (docs/runbooks/restauration.md § 4 bis).
DROP TABLE "events"."event_day_documents";
--> statement-breakpoint
DROP TABLE "events"."event_documents";
