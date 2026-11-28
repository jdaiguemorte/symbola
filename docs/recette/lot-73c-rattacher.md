# Lot 73c — Rattacher un prestataire à un mariage : rejeu local (28/11/2026)

Spécification : `docs/lots/lot-73-prestataires.md`, § 5.3 (critères 1 à 9) ; maquette 19. Données entièrement
fictives, créées par les tests et les parcours. Aucun serveur réel. Pas de rejeu de scénario du § 17 à ce
paquet : SC-04 et SC-05 se rejouent au 73g, comme pour le 73b.

## Ce qui a été rejoué

1. Base locale neuve (`symbola_lot73c`), migrations de `main` (0234 et 0235 du 73a comprises). Aucune
   migration nouvelle.
2. Tests de calcul (`app/prestataires/add-to-event-model.test.ts`, 12) et d'intégration contre PostgreSQL
   (`lib/vendors/add-to-event-73c.integration.test.ts`, 13 ; avec `slot-retention.integration.test.ts`, 21) :
   critères 1 à 8, « Annuler » (nouveau et ancien retenu, réel du budget compris) et les abus (fiche de B vers un
   mariage de A, fiche de A vers un mariage de B, poste d'un autre mariage, mariage annulé, Planner restreinte),
   tous avec la même réponse « introuvable » et rien d'écrit.
3. Parcours `e2e/lot-73c-rattacher.spec.ts` sur l'app compilée (production, port 3073, session ouverte en base
   sans le fournisseur d'identité local), projets « desktop » et « mobile-375 » : **11 réussis, 1 sauté par
   construction** (la mesure des noms à 1 280 et 1 366 px ne se joue qu'à l'ordinateur).
4. Parcours voisins sur la même compilation : `lot-73b-carnet`, `lot-63c-evenements-budget-documents`,
   `bud-01-02-cinq-montants`, `pre-03-04-09-bud-05-prestataires-par-lien`, `prd-bud-03-devis-joint` :
   **38 réussis, 2 sautés par construction**, mesure de rapidité du carnet de 500 fiches comprise.

## Ce que montrent les parcours

- Depuis la ligne du carnet (à l'ordinateur), le menu « ⋯ » (sur téléphone), la sélection et la fiche : la même
  fenêtre « Ajouter « Les Fleurs du Causse » à un mariage ». Le mariage le plus proche est choisi ; « Fleurs et
  décoration » est proposé d'après le métier « Fleuriste » ; rien n'est coché ; « Ajouter au mariage » sans
  réponse écrit « Choisissez comment l'ajouter. » et n'envoie rien. Aucun « engag… » à l'écran (P14).
- En comparaison : « Ajouté à « Fleurs et décoration », en comparaison. » puis « Les Fleurs du Causse · Léa &
  Maxime · 1 en comparaison », avec « Annuler » et « Ouvrir le poste » ; « Annuler » retire la fiche du poste.
- Poste « Traiteur » déjà pourvu par Maison Haddad : « Retenu » remplace le pied par « Remplacer Maison Haddad »
  (bouton plein, d'abord) et « Retenir aussi » (bouton simple, ensuite), chacun avec sa phrase ; « Remplacer »
  fait repasser Maison Haddad en comparaison, sans la supprimer.
- Deux fiches sélectionnées : « En comparaison » seul, choisi et dit ; aucun poste proposé ; « 2 fiches · Léa &
  Maxime · 2 en comparaison ».
- Le panneau du poste (700 px à l'ordinateur, une page avec « ← Budget » à 375 px) : « Fleuriste du carnet · 1 »,
  « Fleuriste · Millau », « Aucune pièce demandée », la phrase des deux boutons, « Chercher dans tout le carnet
  (3 fiches) » ; après « Mettre en comparaison », le panneau reste ouvert et la fiche dit « Dans la
  comparaison » ; la recherche est vide à la réouverture.
- Le carnet ouvert depuis le poste : un filtre « Traiteur » qui s'enlève, aucun lieu dans l'adresse, le bandeau
  « Pour le poste « Traiteur » de Léa & Maxime · choisissez un prestataire, ou plusieurs. » et « Revenir au
  mariage » ; Maison Haddad, déjà sur le poste, dit « Dans la comparaison » ; « Ajouter à ce poste… » ouvre la
  fenêtre, mariage et poste déjà choisis.
- axe-core sans violation sur la fenêtre, le panneau et le carnet filtré ; à 375 px, ni défilement de côté ni
  commande sous 44 px dans la fenêtre ou le panneau ; à 1 280 et 1 366 px, aucun nom coupé.

## Corrigé pendant le rejeu

- « Ajouter à ce poste… » avait un nom accessible qui ne contenait pas son texte visible (axe-core,
  `label-content-name-mismatch`) : il devient « Ajouter à ce poste… (Belle Époque Traiteur) ».
- Les deux liens du pied du panneau faisaient 18 px de haut sur téléphone : ils passent à 44 px.
- Sur téléphone, le panneau en page recouvrait le message de retour : « Annuler » n'était pas touchable. Le
  message passe au-dessus du panneau tant qu'il est ouvert.

## Ce qui n'a pas été rejoué ici

- « Nouveau prestataire » depuis le panneau : le formulaire actuel, remplacé par le formulaire unique au 73d.
- La relance et l'écran du budget refait (73e).
- La recette sur le staging : après la fin des lots de réalisation des maquettes (décision du 27/11).
