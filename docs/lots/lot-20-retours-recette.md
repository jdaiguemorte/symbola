# Lot 20 — Retours de la recette des lots 18 et 19

**Statut** : en cours sur la branche `lot-20-retours-recette`. Julien veut un lot complet avant
de pousser. Les corrections sans choix à faire (partie A) partent directement. Les sujets qui
changent l'organisation des écrans ou les données (partie B) passent d'abord par une maquette à
valider.

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

## B. À valider sur maquette

1. **Accès aux réglages d'un module** : une seule forme partout (Événements, Devis et
   factures, Tâches, Prestataires, Budget). Aujourd'hui, c'est une roue crantée sur trois
   écrans et un bouton sur Événements.
2. **« Plus d'options » des Événements** : il ne contient que l'essai guidé. Il est retiré et
   l'essai guidé se lance depuis sa section de l'aide.
3. **Longues listes de réglages** (Étiquettes, Types de prestataires, Modèles de programme,
   Sources et motifs) : l'ajout en tête, toujours accessible, et une liste qui se filtre.
4. **Blocs de l'accueil** : empilés sur toute la largeur, même en-tête (titre à gauche, lien
   « Tout voir » à droite), les trois prochaines lignes, chaque ligne mène à son écran.
5. **Étiquettes des prestataires** : rattachées à une ou plusieurs familles de prestataires
   (pas de « couchage » pour une fleuriste). Elles sont présentées en pastilles cliquables,
   colorées quand elles sont choisies. Les paliers forment un groupe à choix unique (par
   exemple « 50 à 100 », « 100 à 150 » ou « 150 à 200 personnes »). Changement de données :
   ADR et migration.
6. **Vocabulaire des écrans qui mêlent les événements** (Tâches, Devis et factures) :
   « Événement » et « Clients » dès que l'organisation a des événements de plusieurs types,
   sinon le vocabulaire du métier.
