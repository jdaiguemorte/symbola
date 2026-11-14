# ADR 0055 — Statuts d'évènement, report et annulation ; rétroplanning à la création

- Statut : accepté (décision Q7 a de Julien du 11/11/2026) ; mis en œuvre au lot 34a (14/11/2026,
  spécification `docs/lots/lot-34-statuts-fiche.md`, décisions D2 à D9)
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

## Mise en œuvre (lot 34a)

- **Statuts enregistrés** : `option`, `confirmed`, `in_preparation`, `closed`, `postponed`,
  `cancelled` (migration 0132). **Jour J n'est pas enregistré** : il se calcule le jour de
  l'évènement, dans son fuseau, pour un évènement confirmé ou en préparation
  (`apps/symbola/modules/events/lifecycle.ts`). Aucun traitement n'a donc à le poser ni à le
  retirer à minuit ; la clôture se propose dès le lendemain (D3).
- **Reprise** (D2) : prospect et devis envoyé deviennent Option, réalisé devient Clôturé, perdu
  devient Annulé, l'historique des statuts compris. L'écart des tâches existantes se calcule
  depuis la date d'application du rétroplanning (`tasks_scheduled_for`). L'annulation de 0132
  rend les statuts du PRD (En préparation et Reporté redeviennent Confirmé).
- **Contrats** : `events.event.created` et `events.event.status_changed` passent en version 2
  (accord de Julien du 14/11/2026) ; un événement de version 1 reste lisible, ses statuts
  traduits par la correspondance de D2 (`readEventStatusChanged`).
- **Report** (D4, D5) : la date et le statut d'avant sont gardés jusqu'à la confirmation ; elle
  recalcule les échéances relatives (tâches faites et fixées exceptées) après la liste de celles
  qui tomberaient dans le passé. Garder les échéances après un changement de date recompte
  l'écart des tâches depuis la nouvelle date.
- **Annulation** (D6, D7) : liens fermés, rappels arrêtés, factures d'acompte programmées
  suspendues (elles partent si l'évènement est réactivé), avoir proposé pour chaque facture
  émise ; la signature d'un devis ne confirme qu'une option.
- **Écarts assumés, à trancher par Julien** :
  - une signature en attente chez le fournisseur n'est pas annulée : l'interface de signature
    n'a pas d'annulation et l'appel de Documenso n'est pas vérifié. Une signature arrivée après
    l'annulation marque le devis signé sans confirmer l'évènement ;
  - au report, les échéances du devis signé suivent la date (D7) sans que le PDF signé change :
    à faire relire par l'expert-comptable et l'avocat ;
  - les « listes de contrôle » d'EVT-01 sont lues comme le rétroplanning généré (ambiguïté de la
    spécification).

