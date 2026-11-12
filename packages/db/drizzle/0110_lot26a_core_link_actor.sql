-- Lot 26a (ADR 0053) : le journal d'audit accepte l'auteur « link », un tiers
-- agissant par son lien personnel (actor_id : le lien).
ALTER TABLE "core"."audit_entries" DROP CONSTRAINT "audit_entries_actor_kind_check";
--> statement-breakpoint
ALTER TABLE "core"."audit_entries" ADD CONSTRAINT "audit_entries_actor_kind_check" CHECK ("core"."audit_entries"."actor_kind" in ('member', 'admin', 'operator', 'system', 'link'));
