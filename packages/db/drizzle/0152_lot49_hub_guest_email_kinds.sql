-- Lot 49 (INV-03, INV-04 ; D4, D10 ; ADR 0082) : deux natures de modèles d'e-mails, l'invitation à
-- répondre et la relance des invités. Remplace seulement la contrainte des natures de
-- hub.email_templates (migration 0142) par la liste élargie (accord de Julien du 18/11/2026) ; une
-- nature inconnue reste refusée. Le lot 46 fait de même pour ses natures : la seconde PR fusionnée
-- réunit les deux listes et renumérote sa migration. Ajout seul : compatible avec la version
-- précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder'));
