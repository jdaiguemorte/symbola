-- Annulation de 0206 (lot 66) : l'heure propre des automatismes, l'heure par défaut et le rappel du
-- jour J disparaissent ; les envois reviennent au premier passage horaire de 9 h. Refusée tant qu'un
-- réglage a été posé (il serait perdu sans que la planner le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."automations" WHERE "send_time" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des automatismes ont une heure d''envoi propre (hub.automations.send_time).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."sending_settings") THEN
    RAISE EXCEPTION 'Annulation refusée : des heures d''envoi par défaut sont réglées (hub.sending_settings).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."day_reminder_targets") OR EXISTS (SELECT 1 FROM "hub"."automations" WHERE "key" = 'day_reminder') OR EXISTS (SELECT 1 FROM "hub"."automation_runs" WHERE "key" = 'day_reminder') THEN
    RAISE EXCEPTION 'Annulation refusée : le rappel du jour J est réglé ou a déjà servi (hub.day_reminder_targets, hub.automations, hub.automation_runs).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."day_reminder_targets";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."sending_settings";
--> statement-breakpoint
ALTER TABLE "hub"."automations" DROP CONSTRAINT IF EXISTS "automations_send_time_check";
--> statement-breakpoint
ALTER TABLE "hub"."automations" DROP COLUMN IF EXISTS "send_time";
--> statement-breakpoint
ALTER TABLE "hub"."automations" DROP CONSTRAINT IF EXISTS "automations_key_check";
--> statement-breakpoint
ALTER TABLE "hub"."automations" ADD CONSTRAINT "automations_key_check" CHECK ("key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar'));
--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" DROP CONSTRAINT IF EXISTS "automation_runs_key_check";
--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" ADD CONSTRAINT "automation_runs_key_check" CHECK ("key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar'));
