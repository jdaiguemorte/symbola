# ADR 0005 — Bus d'événements : NATS JetStream

- Statut : remplacé par ADR 0014 pour le MVP (à reconsidérer si plusieurs apps séparées
  réapparaissent)
- Date : 2026-10-25

## Contexte

Une app doit réagir aux faits d'une autre (devis signé → événement confirmé) sans dépendre de sa présence.

## Décision

NATS JetStream. Événements nommés `<app>.<entité>.<action>` au passé, schémas versionnés dans `packages/contracts`, consommateurs idempotents. Les lectures directes passent par API `/v1`.

## Conséquences

Couplage faible : si une app est absente, ses événements ne sont simplement pas consommés. Il faut tester les contrats d'événements comme les API.
