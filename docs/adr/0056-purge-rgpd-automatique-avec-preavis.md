# ADR 0056 — Purge RGPD automatique avec préavis

- Statut : accepté (décision Q10 b de Julien du 11/11/2026) ; mise en œuvre au lot 34
- Date : 2026-11-11
- Complète : [0024](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md) (purge
  mensuelle validée à la main), dont il remplace les points 2 et 3 au lot 34.
- Exigences : RGP-05 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Aujourd'hui, la purge est une liste mensuelle que le planner valide ligne par ligne (ADR 0024).
Sans validation, rien n'est purgé. Le nouveau cahier des charges veut des réglages protecteurs
par défaut : un espace neuf doit être conforme sans aucun réglage (RGP-05).

## Décision

1. **La purge s'exécute seule**, à l'échéance de chaque donnée, sans validation.
2. **Préavis** : les données qui arrivent à échéance sont annoncées au planner avant la purge
   (durée fixée au lot 34 ; proposition : 30 jours). Il peut exclure une ligne, avec un motif
   obligatoire ; une ligne exclue revient à l'échéance suivante, comme aujourd'hui.
3. **Inchangé** : les règles d'échéance de l'ADR 0024 (dates simulées dans les tests, échéance
   le jour même), le contrat `privacy/v1` de chaque module, la conservation des factures.
4. **Trace** : chaque purge est journalisée sans donnée personnelle (journal du lot 23).

## Conséquences

- Un espace laissé sans suivi reste conforme.
- Une erreur de règle d'échéance devient plus coûteuse : les tests avec horloge simulée et le
  préavis sont les garde-fous.
