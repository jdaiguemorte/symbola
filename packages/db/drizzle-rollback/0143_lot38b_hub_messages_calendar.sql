-- Annulation de 0143 (lot 38b) : les modèles de messages et leurs versions sont perdus, et les
-- adresses de calendrier cessent de répondre (les agendas abonnés ne reçoivent plus rien).
DROP TABLE IF EXISTS "hub"."message_template_versions";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."message_templates";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."calendar_feeds";
