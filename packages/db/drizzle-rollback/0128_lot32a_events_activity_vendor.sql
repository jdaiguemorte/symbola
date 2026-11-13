-- Annulation de 0128 (lot 32a, D6) : la référence au prestataire relancé disparaît de l'activité.
-- Les relances inscrites perdent le nom du prestataire (il n'est pas recopié dans task_label) et
-- s'affichent « Relance envoyée à un prestataire retiré. ». Annuler 0127 ensuite reste refusé tant
-- qu'une relance est inscrite.
ALTER TABLE "events"."event_activities" DROP CONSTRAINT "event_activities_vendor_candidate_id_event_vendor_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_activities" DROP COLUMN "vendor_candidate_id";
