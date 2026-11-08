-- Lot 16 (ADR 0045) : la table témoin hello.greetings du lot 0 est supprimée,
-- avec son schéma ; le module hello a quitté l'app (ARC-01, ADR 0043) et les
-- tests d'isolation portent sur les tables des modules. Décision de Julien
-- du 08/11/2026.
DROP TABLE "hello"."greetings" CASCADE;--> statement-breakpoint
DROP SCHEMA "hello";
