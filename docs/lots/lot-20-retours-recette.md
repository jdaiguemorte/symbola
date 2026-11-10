# Lot 20 — Retours de la recette des lots 18 et 19

**Statut** : fait sur la branche `lot-20-retours-recette`. Maquette et décisions 1 à 6 validées
par Julien le 10/11/2026 (https://claude.ai/artifact/9yxipdUcZZpvdXsqoHYzz6) ; choix
d'architecture dans l'[ADR 0049](../adr/0049-etiquettes-reglages-et-ecrans-mixtes.md). Une
migration au déploiement : 0084. Reste la recette sur le staging.

## Contexte

Retours de Julien du 10/11/2026, en recette des lots 18 et 19 sur le staging (captures à
l'appui). Causes relevées dans le code :

- Le « ? » d'un écran qui ne déclare pas d'aide mène au centre d'aide (HUB-19, ADR 0039). Ce
  centre commence par le bloc « Tutoriels faits », d'où l'impression d'un renvoi vers les
  tutoriels. Écrans concernés : Sources et motifs, Délais de relance, Types de prestataires,
  Étiquettes, Estimation des trajets, fiche et création d'un prestataire, Résultats de
  recherche, Tutoriels.
- Les visites du Budget et du Catalogue ont quatre repères, dont trois sans élément à montrer
  sur l'écran (`lib/help/tours.ts`). La visite de l'accueil montre l'agenda, le menu
  Paramètres et le « ? », rien des blocs du dessous.
- Le centre d'aide affiche « ? » à la place de la capture de 19 écrans sans adresse fixe
  (`capture: false`).
- Le vocabulaire n'est pas figé : il suit le métier (Entreprise et TVA) et le type de chaque
  événement (lot 16, ADR 0045). Sur Tâches, qui mêle tous les événements, le métier
  « wedding planner » donne « Mariage » et « Mariés » à toutes les lignes.

## A. Corrections directes

### HUB-25 — En-tête de l'agenda aligné (fait)

- **Étant donné** l'accueil en taille ordinateur, **alors** « ‹ Aujourd'hui › » est centré sur
  le sélecteur de durée. Cause : depuis HUB-24, une barre d'outils aligne ses éléments en
  haut ; la navigation de l'agenda, barre imbriquée, gardait sa marge (environ 14 px).
- **En 375 px**, la navigation passe au-dessus du sélecteur, sans chevauchement.

### HUB-26 — « Voir le parcours des tutoriels » à sa place

- **Quand** elle ouvre le centre d'aide sans aucun tutoriel fait, **alors** le bouton ne
  touche pas la barre de progression, en ordinateur comme en 375 px.

### AIDE-14 — Chaque écran a son aide

- **Quand** elle clique sur « ? » depuis n'importe quel écran de l'app, **alors** le tiroir
  d'aide de cet écran s'ouvre ; jamais le centre d'aide.
- Un test vérifie que chaque `page.tsx` déclare son aide, sauf les écrans hors session
  (connexion, mot de passe, signature fictive).

### AIDE-15 — Des repères qui montrent ce qui est à l'écran

- **Quand** elle ouvre l'aide d'un écran, **alors** chaque repère numéroté désigne un élément
  visible de cet écran. Ce qui n'en a pas devient un paragraphe de la fiche.
- Accueil : navigation de l'agenda, durée affichée, légende, puis les blocs À traiter, À faire
  et Encaissements à venir.
- Répartition du budget et Catalogue : des repères propres à ces écrans.

### AIDE-16 — Une image pour chaque écran du centre d'aide

- **Étant donné** un écran sans adresse fixe (fiche d'un événement, dossier RGPD…), **alors** le
  centre d'aide montre sa capture prise sur des données d'exemple, ou à défaut une
  illustration générique de la rubrique ; jamais « ? ».

### EVT-20 — Rétroplanning : cartes alignées

- **Quand** elle ouvre Paramètres › Rétroplanning, **alors** les cartes des modèles et la carte
  « Nouveau modèle » ont les mêmes bords.

### HUB-27 — Une seule barre de recherche

- **Quand** elle cherche depuis la barre du haut, **alors** les résultats s'affichent sous
  cette même barre, remplie avec sa recherche ; aucun second champ n'apparaît, et la liste
  instantanée ne s'ouvre pas au chargement de la page de résultats.

### PRE-17 — Retirer un prestataire depuis le carnet

- Un prestataire ne s'efface pas : il s'archive (lot 11). Sa fiche quitte le carnet et n'est
  plus proposée, mais ses prestations restent sur les événements et les budgets.
- **Quand** elle choisit « Archiver » sur une ligne du carnet, **alors** une fenêtre demande
  confirmation en nommant le prestataire ; « Annuler » ne change rien. Après confirmation, elle
  revient au carnet avec ses filtres.
- La même confirmation protège désormais le bouton « Archiver » de la fiche.

### AIDE-17 — Textes d'aide revus

- En fin de lot, chaque fiche d'aide est relue au regard des écrans tels qu'ils sont : à quoi
  sert l'écran, quoi faire en premier, ce qui se passe ensuite. Phrases courtes, sans
  redite.

## B. Décisions de la maquette (validées le 10/11/2026)

### Décision 1 — Un seul accès aux réglages

- **Étant donné** Événements, Tâches, Devis et factures, Encaissements ou Prestataires, **alors**
  un bouton « Réglages » (roue et libellé) est à droite du titre et ouvre la rubrique du module
  dans Paramètres. Les onglets de la fiche d'un événement ont le même lien. Plus de roue seule.
- La barre des Événements ne garde que « Nouveau prospect ».

### Décision 2 — L'essai guidé dans l'aide

- **Quand** elle ouvre l'aide des Événements, **alors** la section « Essai guidé » propose
  « Démarrer l'essai » (ou « Reprendre l'essai en cours »). « Plus d'options » n'existe plus.
- **Étant donné** une liste d'événements vide, **alors** l'essai est aussi proposé dans la page.

### Décision 3 — Ajouter sans faire défiler

- Étiquettes, Modèles de rétroplanning, Modèles de programme, Sources et motifs : l'ajout est
  en tête ; dans un modèle, l'ajout d'une ligne précède la liste.
- **Étant donné** plus de 10 étiquettes ou types de prestataires, **alors** un filtre de liste
  apparaît et dit combien restent affichés.

### Décision 4 — Blocs de l'accueil empilés

- **Alors** « À traiter », « À faire cette quinzaine » et « Encaissements à venir » s'empilent
  sur toute la largeur, chacun avec son titre à gauche et son lien à droite.
- Trois lignes au plus, puis « Et N autres » ; chaque ligne mène à sa fiche. Un bloc qui a
  des éléments en retard passe en premier.

### Décision 5 — Étiquettes par groupe et par famille, avec des paliers

- **Étant donné** des étiquettes importées comme « 100 à 150 personnes » et « 150 à 200
  personnes », **alors** l'écran Étiquettes les propose comme palier ; **quand** elle valide,
  **alors** elles forment un groupe « palier », dans l'ordre.
- **Quand** elle ouvre la fiche d'un lieu, **alors** les étiquettes sont des pastilles rangées
  par groupe ; un palier ne se choisit qu'une fois. Le service refuse aussi deux paliers du
  même groupe.
- **Étant donné** une étiquette réservée aux lieux, **alors** elle n'apparaît pas sur la fiche
  d'une fleuriste.
- Isolation : une organisation ne voit, ne modifie ni n'utilise les groupes d'une autre.

### Décision 6 — Vocabulaire des écrans qui mêlent les événements

- **Étant donné** des mariages et un séminaire, **alors** l'accueil, la liste des événements,
  Tâches, Devis et factures et Encaissements disent « Événement » et « Clients ». Sur Tâches,
  chaque ligne garde « Mariés » ou « Clients » selon son événement.
- **Étant donné** des mariages seulement, **alors** le vocabulaire du métier reste.

Tests : `modules/vendors/tag-tiers.test.ts`, `tag-groups.integration.test.ts`,
`modules/events/event-types.integration.test.ts`, `lib/vocabulary.test.ts`,
`lib/help/screens.test.ts`, parcours `lot-20-retours-recette`.
