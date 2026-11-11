-- Annulation de 0087 (lot 23, ADR 0060) : fonctions communes. Les migrations
-- 0088 à 0092 qui les emploient doivent avoir été annulées avant.
DROP FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
DROP FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
DROP FUNCTION "core"."stamp_row"();
