# ADR 0055 — Statuts d'évènement, report et annulation ; rétroplanning à la création

- Statut : accepté (décision Q7 a de Julien du 11/11/2026) ; mise en œuvre au lot 34
- Date : 2026-11-11
- Remplace : la décision L12-EVT-13 du lot 12 (rétroplanning seulement pour un évènement
  confirmé, `docs/lots/lot-12-demarrage.md`), en vigueur jusqu'au lot 34.
- Exigences : EVT-01, EVT-05, CHR-01 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Un évènement a aujourd'hui cinq statuts : `prospect`, `quote_sent`, `confirmed`, `done`, `lost`.
Le rétroplanning n'est proposé qu'au passage en « Confirmé » (L12-EVT-13). Le nouveau cahier des
charges fixe d'autres statuts et génère le rétroplanning dès la création.

## Décision

1. **Statuts** (EVT-05) : Option, Confirmé, En préparation, Jour J, Clôturé, Reporté, Annulé.
   Ce sont des états du cycle de vie, sur lesquels portent des règles (échéances, purge,
   portail) : leur liste est fixe dans le code, leurs libellés sont traduits, et le vocabulaire
   du métier reste réglé par les types d'évènement (ADR 0045).
2. **Création en trois champs** (EVT-01) : nom, date, type. Le rétroplanning, le budget type et
   les listes de contrôle sont générés depuis le modèle du type, dès la création.
3. **Échéances relatives** (CHR-01) : chaque tâche garde son écart avec la date de l'évènement.
   Un report recalcule les échéances après confirmation et liste celles qui tombent dans le
   passé (EVT-05).
4. **Annulé** garde les données ; leur durée de conservation suit les règles RGPD (ADR 0024 et
   0056).
5. **Reprise** : la correspondance avec les statuts actuels et la migration sont fixées au
   lot 34, qui change le schéma et attend la validation de Julien. La suite commerciale d'avant
   la confirmation (prospect, devis envoyé, perdu) relève du pipeline (CRM-02, lot 44).

## Conséquences

- Un évènement créé est tout de suite planifiable ; une option non confirmée porte déjà ses
  tâches.
- Les écrans, les filtres, l'import et la purge qui lisent le statut changent au lot 34.
