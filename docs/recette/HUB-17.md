# Rejeu HUB-17 / UX-07 — une fausse manœuvre sur le mariage de référence (SU-01, ORG-01)

Aucun scénario du cahier des charges (§ 17) ne joue la corbeille : le rejeu fait faire à Camille
trois fausses manœuvres sur l'atelier chargé du jeu fictif, comme prévu par la spécification du
lot 39 (`docs/lots/lot-39-saisie-sure.md`, Tests).

## Lot 39a — supprimer, annuler, restaurer

- Date : 17/11/2026, en local, par Claude Code.
- Environnement :
  - app compilée (`next start`) ;
  - base neuve `symbola_lot24`, jeu fictif chargé par `pnpm --filter @symbola/app seed:recette`
    (comptes dans le fichier local de recette, hors du dépôt) ;
  - Logto, Mailpit et Garage du socle de dev.
- Méthode : navigateur intégré, sur ordinateur. Camille se connecte par le lien reçu dans
  Mailpit, puis par son second facteur de test.
- Préparation hors mesure : le jeu fictif ne porte aucun document pour ORG-01 ; un plan de table
  (PDF minimal) est déposé par script sur le mariage de Léa et Maxime avant le rejeu.

| Étape | Qui | Ce qu'elle fait | Résultat |
| --- | --- | --- | --- |
| A | Camille | Rétroplanning de Léa & Maxime, tâche « Commander la papeterie », « Supprimer la tâche » | La tâche disparaît ; bandeau « Tâche supprimée. » avec « Annuler » |
| A | Camille | « Annuler » dans les dix secondes | « C'est rétabli. » ; la tâche est revenue, telle qu'elle était |
| B | Camille | Onglet Documents, « Gérer » puis « Supprimer « Plan de table » » (aucune confirmation) | Le document disparaît ; bandeau « Document mis à la corbeille. » avec « Annuler » et « Voir la corbeille » |
| B | Camille | Laisse passer les dix secondes, ouvre Paramètres › Corbeille | « Document · Plan de table », « Supprimé le 17 novembre 2026 à 07:50 par camille.roussel@exemple.test · effacé pour de bon le 17 décembre 2026 » |
| B | Camille | « Restaurer » | « C'est restauré, tel que c'était. » ; « La corbeille est vide. » ; le plan de table est revenu dans l'onglet Documents, téléchargeable |
| C | Camille | Aperçu de l'Anniversaire (en option, sans pièce à conserver), « Supprimer l'évènement » | Retour à la liste, l'évènement n'y est plus ; bandeau « Évènement mis à la corbeille. » |
| C | Camille | Paramètres › Corbeille, « Restaurer » l'Anniversaire | L'évènement revient avec son client et ses neuf lignes de budget (« Toutes les lignes (9) ») |

**Mesures** : un geste pour supprimer, un pour annuler ; deux pour restaurer depuis la corbeille
(ouvrir la corbeille, « Restaurer »). axe-core : le parcours `e2e/hub-17-ux-07-corbeille.spec.ts`
n'a aucune violation, en 1 280 px et en 375 px.

**Remarques laissées en l'état** :
- Le refus de supprimer un évènement qui porte une pièce à conserver (D4) n'a pas de cas dans le
  jeu fictif d'ORG-01 (aucun devis signé) : il est prouvé par le test d'intégration
  `lib/trash.integration.test.ts`.
- La suppression définitive (titulaire, confirmation qui nomme l'objet) est jouée par le parcours
  e2e, pas par ce rejeu.

Résultat : **fausses manœuvres rattrapées sans blocage**.
