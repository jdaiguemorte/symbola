-- Annulation de 0078 (lot 16, SEC-02, ADR 0044) : limitation de débit. Les
-- tentatives des dernières 24 heures sont oubliées ; l'image précédente de
-- l'app ne limite plus rien.
DROP TABLE "core"."rate_limit_events";
