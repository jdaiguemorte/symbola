-- Annulation de 0209 (lot 66c) : la marque des e-mails, les signatures et les libellés de bouton
-- disparaissent ; les e-mails reviennent à la police, au pied et aux boutons de départ, sans signature.
-- Refusée tant qu'un réglage, une signature ou un libellé existe (la planner le perdrait sans le
-- savoir) : les retirer d'abord, ou garder la migration. Les photos des signatures restent dans le
-- stockage privé tant que leur ligne existe : rien n'est à nettoyer quand l'annulation passe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."member_signatures") THEN
    RAISE EXCEPTION 'Annulation refusée : des membres ont rempli leur signature (hub.member_signatures).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."email_branding") THEN
    RAISE EXCEPTION 'Annulation refusée : une organisation a réglé la marque de ses e-mails (hub.email_branding).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "button_label" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles ont un libellé de bouton propre (hub.email_templates.button_label).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."member_signatures";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."email_branding";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT IF EXISTS "email_templates_button_label_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP COLUMN IF EXISTS "button_label";
