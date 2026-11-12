-- Annulation de 0110 (lot 26a) : le journal n'accepte plus l'auteur « link »
-- pour les nouvelles lignes. Il est en ajout seul : les lignes déjà écrites
-- par un lien restent, d'où NOT VALID (elles ne sont pas revérifiées).
ALTER TABLE "core"."audit_entries" DROP CONSTRAINT "audit_entries_actor_kind_check";
--> statement-breakpoint
ALTER TABLE "core"."audit_entries" ADD CONSTRAINT "audit_entries_actor_kind_check" CHECK ("core"."audit_entries"."actor_kind" in ('member', 'admin', 'operator', 'system')) NOT VALID;
