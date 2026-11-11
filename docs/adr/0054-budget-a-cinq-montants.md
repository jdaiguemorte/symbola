# ADR 0054 — Budget à cinq montants

- Statut : accepté (décisions Q8 a et Q9 de Julien du 11/11/2026) ; mise en œuvre au lot 28 (28a : cinq montants, statuts, enveloppe ; avenant ci-dessous)
- Date : 2026-11-11
- Remplace : [0032](0032-budget-remplace-les-postes.md) (prévu, réel, écart), qui reste en
  vigueur jusqu'au lot 28.
- Exigences : BUD-01 à BUD-04, PRE-01, PRE-02 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Le budget actuel a deux montants par ligne, prévu et réel, et leur écart (ADR 0032). Le nouveau
cahier des charges en demande cinq, une enveloppe avec seuil d'alerte, un échéancier par
prestataire et des liens vers les documents.

## Décision

1. **Cinq montants par ligne** (BUD-01) : estimé, devisé, engagé, payé, reste à payer. Le reste à
   payer se calcule (engagé moins payé), il ne se saisit jamais. Les totaux se recalculent à
   chaque saisie.
2. **Enveloppe globale du client** et alerte de dépassement à un seuil réglable, affichée avant
   l'engagement de la dépense (BUD-02).
3. **Échéancier par prestataire** (BUD-03) : acompte, paiements intermédiaires, solde, dates,
   statut, rappels. Chaque échéance proche apparaît dans « Aujourd'hui ».
4. **Liens** entre ligne, prestataire et documents (devis, contrat, facture), ouverts en un clic
   (BUD-04).
5. **Statuts des prestataires** alignés sur le nouveau document (Q9, PRE-01, PRE-02).
6. **Gardé de l'ADR 0032** : le budget existe dès la création de l'évènement ; icône par ligne ;
   lignes par défaut fournies par les modèles de départ (données, ADR 0007) ; montants en
   centimes entiers.
7. **Reprise** : la correspondance des colonnes actuelles (prévu, réel) avec les cinq montants
   et la migration sont fixées au lot 28, qui change le schéma et attend la validation de
   Julien.

## Conséquences

- Le planner voit d'un coup d'œil ce qui est estimé, promis, signé, payé et dû.
- Le lot 28 touche les tables du budget, les écrans, les exports et l'aide.

## Avenant du 12/11/2026 — Correspondance et reprise (lot 28a, décisions D2 à D4)

Décisions de Julien du 11/11/2026 (`docs/lots/lot-28-budget-cinq-montants.md`, toutes en (a)).

1. **Correspondance des montants (D2)** : le prévu devient l'**estimé**, le réel devient
   l'**engagé** (il était rempli au passage du poste à « Réservé » : c'est un engagement, pas un
   paiement). Le **devisé** reprend le devis du prestataire retenu quand il en a un ; le **payé**
   part de vide. L'historique garde ses lignes : `planned` devient `estimated`, `actual` devient
   `committed`. Un import du budget fait avant le lot s'annule encore (ses anciens noms sont
   traduits à la lecture).
2. **Statuts (D3)** : chaque prestataire rattaché à un évènement a l'un des sept statuts
   Pressenti, Consulté, Devis reçu, Retenu, Contrat signé, Soldé, Écarté. Le poste n'a plus de
   statut propre : il affiche le plus avancé de ses prestataires (« À trouver » sans prestataire
   ou quand tous sont écartés) ; « Non requis » est une case du poste. Retenir un prestataire
   écarte les autres prestataires du poste.
3. **Reprise des statuts** (migration 0103) : Contacté → Consulté, Devis reçu → Devis reçu,
   Décliné → Écarté ; le prestataire choisi d'un poste « Réservé » → Retenu ; un poste réservé
   sans prestataire consulté reçoit un prestataire Retenu (son nom et son montant) ; les autres
   prestataires d'un poste retenu (« non retenus ») → Écarté ; un poste « Non requis » coche sa
   case.
4. **« Retenu » engage la ligne** : le module Événements publie `events.vendor_slot.booked`
   (contrat inchangé) quand un prestataire devient retenu ou que son montant change ; le module
   Budget écrit l'engagé, et le devisé s'il est encore vide.
5. **Enveloppe et seuil (D4)** : l'enveloppe est le budget souhaité du client (fiche de
   l'évènement), sinon le total de la simulation. Le seuil d'alerte vaut 90 % par défaut (modèle
   de départ `budget-alert.json`, ADR 0007), se règle par organisation (Paramètres › Budget) et
   s'ajuste par évènement (table `budget.alert_thresholds`, RLS). Avant de retenir un
   prestataire, l'app calcule l'engagé total qui en résulterait ; au-delà du seuil, le
   dépassement chiffré s'affiche et la planner confirme. Un bandeau rappelle le dépassement en
   haut du budget. Sans module Budget, rien ne s'affiche (ARC-06).
6. **Lecture d'un autre schéma** : la reprise du devisé (migration 0104) lit le schéma `events`
   (prestataire retenu et son devis) sans y écrire ; c'est la seule entorse à « une migration ne
   touche que son schéma » (DAT-09), limitée à une lecture, faite une fois, après 0103.
7. **Annulation** : 0104 rend le prévu et le réel (le devisé, le payé, leur historique et les
   seuils sont perdus) ; 0103 rend la réponse du prestataire et le statut du poste (Pressenti
   devient Contacté ; Retenu, Contrat signé et Soldé deviennent Devis reçu, leur poste
   « Réservé » ; Écarté devient Décliné, y compris pour un prestataire seulement « non retenu »).
