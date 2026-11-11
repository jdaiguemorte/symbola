# ADR 0054 — Budget à cinq montants

- Statut : accepté (décisions Q8 a et Q9 de Julien du 11/11/2026) ; mise en œuvre au lot 28
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
