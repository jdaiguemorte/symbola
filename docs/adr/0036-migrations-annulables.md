# ADR 0036 — Migrations annulables par script, types énumérés compris

- Statut : accepté (07/11/2026, décision R du lot 15 validée par Julien)
- Date : 2026-11-07

## Contexte

CLAUDE.md (§ 5) demande que chaque migration soit réversible. Drizzle ne génère que des
migrations « aller ». Pour l'essentiel, les migrations ajoutent des colonnes ou des tables, et
leur retour est évident (les supprimer). Mais les migrations 0070 et 0072 (lot 14) **ajoutent
une valeur au type énuméré** `hub.import_entity_type`, et PostgreSQL ne sait pas retirer une
valeur d'un type énuméré.

## Décision

1. Chaque migration qui le justifie a un **script d'annulation** à côté :
   `packages/db/drizzle-rollback/<tag>.sql`. Les migrations des lots 14 et 15 (0069 à 0074)
   en ont un ; toute nouvelle migration en aura un, dans la même PR.
2. **Type énuméré** : le script recrée le type sans la valeur (renommer l'ancien, créer le
   nouveau à partir des valeurs restantes, convertir la colonne, supprimer l'ancien). Il
   **refuse** de s'exécuter tant qu'une ligne utilise la valeur, sans rien modifier.
3. Commande `pnpm --filter @symbola/db rollback -- <tag>`, avec le rôle admin, **réservée à
   l'opérateur** (jamais lancée par l'app) :
   - seule la **dernière migration appliquée** s'annule ; les plus récentes d'abord ;
   - le script et le retrait de la migration du journal de Drizzle se font **dans la même
     transaction** ; la migration peut ensuite être rejouée par `migrate`.
4. Un test d'intégration (`packages/db/src/rollback.integration.test.ts`) fait l'aller, le
   retour et l'aller sur une base temporaire, refus compris.

## Conséquences

- Revenir en arrière après un déploiement raté ne demande plus de restaurer une sauvegarde
  entière quand seul le schéma est en cause (runbook de restauration, § 4 bis).
- Un script qui supprime une colonne perd ses données : il se lance **après une sauvegarde**,
  et le runbook le rappelle.
- Pour éviter d'autres types énumérés difficiles à faire évoluer, une nouvelle liste de valeurs
  peut être une colonne texte avec une contrainte de vérification ; le choix reste à faire au
  cas par cas.
