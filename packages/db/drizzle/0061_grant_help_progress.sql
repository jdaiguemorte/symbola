-- Lot 10 — progression dans l'aide : table d'identité (comme
-- hub.user_tour_seen, pas de RLS : clé du compte, aucune donnée métier).
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."help_progress" TO symbola_app;
--> statement-breakpoint
-- Les visites déjà vues (lot 1) deviennent des visites terminées.
INSERT INTO "hub"."help_progress" ("user_id", "item_key", "status", "step", "started_at", "updated_at", "completed_at")
SELECT "user_id", 'tour:' || "module_key", 'completed', 0, "seen_at", "seen_at", "seen_at"
FROM "hub"."user_tour_seen"
ON CONFLICT DO NOTHING;
