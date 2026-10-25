# ADR 0012 — Une seule base PostgreSQL, schémas logiques par module (remplace ADR 0003 pour le MVP)

- Statut : accepté, remplace ADR 0003 pour le MVP ; les principes de l'ADR 0003 (RLS,
  `organization_id`, pas de `BYPASSRLS`) restent en vigueur
- Date : 2026-10-26

## Contexte

L'ADR 0003 proposait une base et un rôle PostgreSQL par app, pour garantir qu'une app ne puisse
jamais lire les données d'une autre, même par bug. Avec une seule app Next.js (ADR 0011), ce
risque spécifique (une app distincte accède à la base d'une autre) n'existe plus de la même
façon : la frontière à protéger est désormais entre organisations clientes (RLS), pas entre
process applicatifs séparés.

## Décision

Un seul serveur PostgreSQL, une seule base pour le MVP, avec un schéma par module (`events.*`,
`budget.*`, `quotes.*`, `hub.*`). Chaque table métier porte `organization_id`, protégée par des
policies RLS qui lisent `app.organization_id` fixé par transaction (`SET LOCAL`), exactement
comme prévu par l'ADR 0003. Règle stricte : aucune requête SQL ne lit ni ne joint un schéma
depuis le code d'un autre module — seulement via le `service.ts` du module propriétaire (ADR
0011). Le rôle applicatif reste non-propriétaire des tables et sans `BYPASSRLS`.

## Conséquences

Pas de jointure possible entre schémas au niveau SQL, mais une seule connexion à gérer, une
seule chaîne de migrations à appliquer, pas de duplication de la logique RLS sur 5 bases. Si
l'extraction en apps séparées (ADR 0011) a lieu plus tard, séparer les bases redevient
pertinent : `pg_dump --schema=<module>` vers une nouvelle base, nouvelle chaîne de connexion,
aucune ligne de code métier à changer puisque l'accès passait déjà uniquement par le module
propriétaire. C'est la migration la moins coûteuse des quatre révisées par cet ADR et les
ADR 0011, 0013, 0014.
