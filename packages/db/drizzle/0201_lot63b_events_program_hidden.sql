-- Lot 63b (CHR-08, CHR-07, POR-10 ; Q44, accord de Julien du 21/11/2026) : une séquence du programme
-- peut être cachée des mariés (surprise du DJ, organisation interne). Faux par défaut : rien ne change
-- pour les séquences existantes. Une colonne du schéma events, RLS inchangée ; l'app précédente
-- l'ignore (pas d'arrêt requis).
ALTER TABLE "events"."program_items" ADD COLUMN "hidden_from_clients" boolean DEFAULT false NOT NULL;
