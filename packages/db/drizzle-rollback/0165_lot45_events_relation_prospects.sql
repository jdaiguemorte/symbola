-- Annulation de 0165 (lot 45) : messages, relances, réglage des relances, questionnaires et rubrique
-- « Questionnaires » disparaissent. Refusée tant qu'un message est rangé dans l'historique d'un contact
-- ou qu'un questionnaire a été envoyé (ses réponses seraient perdues), et tant qu'un lien a la rubrique
-- « Questionnaires » ouverte (la contrainte la refuserait). Les modèles de questionnaires et le réglage
-- des relances, eux, se perdent : ce sont des réglages ; la brochure reste dans le stockage.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_messages") THEN
    RAISE EXCEPTION 'Annulation refusée : des messages sont rangés dans l''historique des contacts (events.event_messages).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_questionnaires") THEN
    RAISE EXCEPTION 'Annulation refusée : des questionnaires ont été envoyés (events.event_questionnaires).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_links" WHERE 'questionnaires' = ANY ("rubrics")) THEN
    RAISE EXCEPTION 'Annulation refusée : des liens ont la rubrique « Questionnaires » ouverte (events.event_links).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests']::text[]);
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."questionnaire_answers";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_questionnaires";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."questionnaire_template_items";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."questionnaire_templates";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."prospect_follow_ups";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."prospect_follow_up_settings";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_messages";
