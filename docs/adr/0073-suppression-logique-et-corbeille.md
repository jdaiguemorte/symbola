# ADR 0073 — Suppression logique cachée par la base, corbeille de 30 jours et « Annuler »

- Statut : accepté (lot 39, décisions D1 à D6 validées par Julien le 16/11/2026)
- Date : 2026-11-16
- Complète : [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (RLS par organisation),
  [0024](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md) (conservation),
  [0060](0060-journal-d-audit-commun.md) (journal d'audit),
  [0061](0061-pieces-inalterables.md) (pièces inaltérables).
- Exigences : DAT-03, HUB-17, UX-07 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-39-saisie-sure.md` (partie 39a).

## Contexte

Une suppression était définitive dès le clic, et un évènement ne se supprimait pas. DAT-03 veut une
suppression logique datée, puis une purge réelle par tâche de fond ; HUB-17 une corbeille de
30 jours d'où un évènement revient avec tout son contenu ; UX-07 qu'un geste réversible s'exécute
tout de suite et s'annule pendant dix secondes. La règle du dépôt veut aussi qu'aucune requête ne
puisse lire ce qu'elle ne doit pas, « même avec un bug applicatif ».

## Décision

### Une ligne supprimée est cachée par la base (D3)

1. Les tables concernées reçoivent `deleted_at` (date de la suppression) et `deleted_by` (auteur,
   lu dans le contexte de la transaction, comme le journal d'audit).
2. Une politique RLS **restrictive** `soft_delete_visibility` s'ajoute à la politique
   d'organisation : une ligne marquée n'est ni lue, ni modifiée, ni supprimée, sauf quand la
   transaction déclare voir la corbeille (`app.include_deleted = 'on'`). Toutes les lectures
   existantes (listes, « Aujourd'hui », agenda, recherche, flux de calendrier, rappels, liens des
   tiers, statistiques) écartent donc les lignes supprimées sans être réécrites.
3. **Voir la corbeille est un acte explicite** : `includingDeleted(fn)` (`packages/db`) ouvre ce
   droit pour la durée d'un appel, et `withOrganization` le reporte dans la transaction. Seuls
   l'utilisent : la suppression, la restauration et la purge (marquer une ligne la fait sortir de
   ce qui est visible), la liste de la corbeille, les demandes RGPD (recherche, export,
   effacement : une donnée à la corbeille reste tenue) et l'export complet (ADR 0068), qui livre
   les lignes supprimées avec leur date de suppression.
4. **Le contenu d'un évènement suit l'évènement** : dans le schéma `events`, chaque table qui porte
   `event_id` reçoit une politique restrictive `event_visibility` (l'évènement doit être visible).
   Rien n'est recopié ni marqué ligne à ligne ; restaurer l'évènement rend tout son contenu.
   Les modules `budget` et `quotes` ne lisent pas le schéma `events` (ADR 0012) : l'orchestration
   (`lib/trash.ts`, comme `lib/demo-purge.ts`) leur demande de marquer leurs lignes de
   l'évènement (lignes et paiements du budget, devis) à la même date ; la restauration démarque
   les lignes de cette date seulement, pas celles supprimées une à une avant.

### Ce qui va à la corbeille et ce qui s'annule (D2, D6)

5. **Corbeille de 30 jours** : évènement (avec tout son contenu), contact, document d'évènement
   (avec ses versions), modèles (rétroplanning, programme, devis, contrat, message). Ils se
   restaurent depuis Paramètres › Corbeille.
6. **Éléments d'une fiche** (tâche, séquence, lieu, commentaire, note de contact, ligne de budget,
   ligne de devis) : la suppression les marque ; « Annuler » les démarque pendant dix secondes ;
   la purge les efface au plus tôt dix minutes après. Ils ne paraissent pas dans la corbeille.
7. **Purge réelle** par la tâche horaire (`instrumentation.ts`) : lignes et fichiers (Garage)
   effacés, au journal d'audit comme toute suppression.

### Ce qui ne se supprime pas (D4, D5)

8. Un évènement qui porte une pièce à conserver (devis signé, demande de signature en cours ou
   aboutie, facture, reçu d'arrhes) ne se supprime pas : l'écran propose « Annuler
   l'évènement ». Un contact client d'un évènement ne se supprime pas non plus.
9. Toute l'équipe supprime et restaure ce qu'elle peut modifier ; « Supprimer définitivement »
   est réservé à la titulaire.

## Conséquences

- Une contrainte d'unicité doit ignorer les lignes supprimées (adresse e-mail d'un contact) ;
  restaurer une ligne qui entrerait en conflit est refusé avec un message clair.
- Marquer ou démarquer une ligne exige `includingDeleted` : sans lui, la base refuse la nouvelle
  ligne (politique restrictive), ce qui empêche une suppression logique faite par erreur hors des
  fonctions prévues.
- Les politiques `event_visibility` ajoutent une lecture de l'évènement par ligne lue ; c'est
  négligeable au volume du pilote et indexé (clé primaire).
- L'annulation des migrations retire colonnes et politiques ; elle est refusée tant qu'une ligne
  est à la corbeille (elle redeviendrait visible sans que personne l'ait restaurée).
