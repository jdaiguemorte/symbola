-- Annulation de 0205 (lot 65d) : le réglage « qui envoie » et les messages préparés disparaissent ;
-- sans réglage, l'app d'avant envoie tout de Symbola, comme avant le lot. Refusée tant qu'un message
-- attend d'être envoyé (la planner le perdrait sans le savoir) ou qu'une organisation a réglé l'envoi
-- (son choix serait perdu sans le savoir) : les traiter d'abord, ou garder la migration. Les messages
-- déjà déclarés envoyés ou écartés partent avec la table (une trace sans contenu).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."prepared_emails" WHERE "status" = 'to_send') THEN
    RAISE EXCEPTION 'Annulation refusée : des messages préparés attendent d''être envoyés (hub.prepared_emails).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."relation_mail_settings") THEN
    RAISE EXCEPTION 'Annulation refusée : une organisation a réglé qui envoie ses messages (hub.relation_mail_settings).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."prepared_emails";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."relation_mail_settings";
