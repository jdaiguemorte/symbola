-- Annulation de 0171 (lot 45) : les doublons possibles et la trace des fusions disparaissent.
-- Refusée tant qu'une fusion est tracée : la trace (qui, quand, quelles fiches) est la seule façon de
-- reprendre une fusion à la main. Les paires détectées, elles, se retrouvent à la détection suivante.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."contact_merges") THEN
    RAISE EXCEPTION 'Annulation refusée : des fusions de contacts sont tracées (hub.contact_merges).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."contact_merges";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."contact_duplicates";
