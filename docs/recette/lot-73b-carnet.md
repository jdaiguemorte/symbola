# Lot 73b — Le carnet de prestataires : rejeu local (27/11/2026)

Spécification : `docs/lots/lot-73-prestataires.md`, § 5.2 (critères 1 à 11). Données entièrement fictives :
jeu de recette (`docs/recette/symbola-synthetic-users.json`, `seed:recette`) et ateliers créés par les parcours.
Aucun serveur réel. Pas de rejeu de scénario du § 17 à ce paquet : SC-04 et SC-05 se rejouent au 73g.

## Ce qui a été rejoué

1. Base locale neuve, migrations de `main` (0234 et 0235 du 73a comprises), jeu fictif chargé.
2. Regard en navigateur, à 1 440 px et à 375 px, sur l'app en développement :
   - Atelier Camille R. : 18 fiches du jeu « à classer » (leurs métiers n'ont pas de famille) ; la phrase
     « 18 fiches n'ont pas encore de métier. » et « Classer les 18 fiches » en bouton plein ; après pose des
     métiers de départ, l'écran « Classer » propose 9 métiers d'après le nom (« Proposé d'après « Traiteur »
     dans le nom », « … « Domaine » … », « … « DJ » … », « … « Vidéo » … ») ; « Enregistrer les 9 métiers »
     ramène au carnet avec « 9 fiches classées · Revoir » ; les familles apparaissent en pastilles comptées.
   - Maison Belkacem Évènements : carnet porté à 520 fiches ; « 500 fiches sur 520, par nom » et « Les 500
     premières : affinez avec les filtres. » ; menu « ⋯ » d'une ligne ; sur téléphone, une carte par fiche,
     le téléphone en lien qui appelle, les filtres derrière « Filtres » en panneau du bas (« Voir les 500
     fiches »).
3. Parcours `e2e/lot-73b-carnet.spec.ts` sur l'app compilée (production), projets « desktop » et
   « mobile-375 », un parcours à la fois : **20 réussis, 2 sautés par construction** (le tri par en-tête et
   la mesure ne se jouent qu'à l'ordinateur).

## Rapidité, 500 fiches (NFR-02, seuil inchangé de 300 ms)

- Temps serveur de `/prestataires`, carnet de 520 fiches, app compilée : 95e centile de dix requêtes,
  trois séries : **199, 192 et 192 ms**. Le parcours mesure de même un carnet de 510 fiches (médiane des trois
  séries sous 300 ms).
- Un seul menu dans la page avant le premier clic (celui de l'en-tête) : les 500 lignes n'ont qu'un bouton
  « ⋯ », le menu est monté au clic et posé sous la ligne. C'est ce qui avait fait échouer « Tâches » au 70d.
- Poids de la page : 2,7 Mo pour 520 fiches, dont 0,56 Mo de messages de traduction communs à toute l'app ;
  environ 1,6 Ko de HTML par ligne, autant dans la charge React. À surveiller si une agence approche de la
  limite (aucune agence pilote n'en est près, § 4.2).

## Ce qui n'a pas été rejoué ici

- La fenêtre « Ajouter à un mariage… » (paquet 73c) : une fenêtre d'attente dit où le faire aujourd'hui.
- Le panneau du bas commun du 70f (PR #203) : le carnet a le sien en attendant.
- La recette sur le staging : après la fin des lots de réalisation des maquettes (décision du 27/11).
