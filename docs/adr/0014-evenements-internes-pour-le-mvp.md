# ADR 0014 — Table d'événements internes, pas de bus séparé (remplace ADR 0005 pour le MVP)

- Statut : accepté, remplace ADR 0005 pour le MVP
- Date : 2026-10-26

## Contexte

L'ADR 0005 proposait NATS JetStream pour qu'une app réagisse aux faits d'une autre sans dépendre
de sa présence. Avec une seule app (ADR 0011), les événements circulent entre modules du même
process : un bus réseau séparé n'apporte pas de découplage supplémentaire à ce stade, pour un
volume d'événements qui restera faible au MVP (un seul client).

## Décision

Table `domain_events` (motif *transactional outbox*) : chaque module publie en y insérant une
ligne dans la même transaction que son écriture métier ; un worker interne la consomme et appelle
les gestionnaires enregistrés, de façon idempotente. Les événements gardent le même nommage et le
même schéma versionné dans `packages/contracts` que prévu par l'ADR 0005
(`<app>.<entité>.<action>` au passé, ex. `quotes.quote.signed`). Seule change l'implémentation du
transport : un appel de fonction en mémoire plutôt qu'une publication réseau.

## Conséquences

Pas de composant supplémentaire à exploiter, et le pattern est proche de pg-boss déjà retenu sur
le projet Capsule Vocale pour un besoin similaire. Si NATS devient nécessaire plus tard (plusieurs
apps séparées, ADR 0011 inversé), la bascule ne touche que l'implémentation de la fonction
`emit()` : les schémas d'événements et les gestionnaires côté consommateur restent inchangés.
C'est la migration la moins coûteuse des quatre révisées par cette série d'ADR, précisément parce
que les contrats d'événements sont versionnés dès ce lot comme si le transport était déjà
distribué.
