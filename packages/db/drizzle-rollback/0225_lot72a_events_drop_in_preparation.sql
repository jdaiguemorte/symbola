-- Annulation de 0225 (lot 72a) : la valeur « En préparation » revient dans l'énumération, pour que
-- l'image d'avant le lot 72a puisse tourner. Les évènements et lignes d'historique convertis restent
-- « Confirmé » (aucune règle ne les distinguait ; décision J1 : aucune donnée réelle concernée).
ALTER TYPE "events"."event_status" ADD VALUE IF NOT EXISTS 'in_preparation' AFTER 'confirmed';
