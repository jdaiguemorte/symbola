# ADR 0088 — Une plateforme agréée partenaire pour la facturation électronique

- Statut : accepté (décision de Julien du 18/11/2026, réponse à Q20) ; le partenaire reste à
  contractualiser
- Date : 2026-11-18
- Exigences : FAC-10 (connecteur de plateforme agréée), JUR-03 (facture électronique), JUR-04
  (e-reporting) ; lot 42. Complète l'ADR 0080 (Factur-X, lot 41).
- Étude : `docs/etudes/paiement-et-plateforme-agreee.md`, § 6.

## Contexte

Au 1er septembre 2027, les TPE et PME doivent émettre leurs factures électroniques par une
plateforme agréée par l'État, et déclarer leurs ventes aux particuliers (e-reporting). Les
factures des planners partent de Symbola, au format Factur-X depuis le lot 41. Deux voies :

- relier Symbola à la plateforme que **chaque planner** a choisie : un connecteur par plateforme ;
- relier Symbola à **une** plateforme partenaire.

## Décision

1. **Symbola est d'abord une solution de facturation** : il se rend conforme en appelant **une**
   plateforme agréée partenaire, derrière une interface (ARC-12). Euro-Information (groupe Crédit
   Mutuel Alliance Fédérale) est pressentie.
2. **Le planner ne choisit pas** de plateforme pour les factures émises depuis Symbola : la
   plateforme partenaire les reçoit, les transmet et produit l'e-reporting.
3. Le connecteur doit être en production **avant l'été 2027** (lot 42).

## Conséquences

- Le contrat avec la plateforme partenaire, son prix par facture et ses conditions (qui est son
  client : Symbola ou chaque planner ?) sont à négocier. C'est un geste de Julien.
- **Points à faire confirmer** par la plateforme partenaire et l'expert-comptable, pendant la
  spécification du lot 42 :
  - comment un planner déjà inscrit dans l'annuaire avec une autre plateforme (souvent celle de sa
    banque, pour recevoir) émet par celle de Symbola ;
  - comment l'e-reporting des ventes aux particuliers suit.
  Ce sont des modalités : la stratégie est fixée.
- La plateforme partenaire devient un sous-traitant (données des factures et de leurs clients) :
  ligne à ajouter à `docs/conformite/sous-traitants.md`, contrat de sous-traitance, point pour la
  DPO.
- Changer de partenaire plus tard ne touche que l'adaptateur derrière l'interface.
