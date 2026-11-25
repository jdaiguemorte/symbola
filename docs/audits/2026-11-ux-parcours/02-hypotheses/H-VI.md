# H-VI — Hiérarchie visuelle et typographie (lot 68, phase 2)

## Ce que j'ai regardé

Les quatre modules, aux trois tailles, surtout dans l'espace rempli (Camille) : Aujourd'hui, liste des
évènements, fiche du mariage de référence (Synthèse, Budget et prestataires, Rétroplanning, Programme du
jour J), Tâches (liste, fenêtre « Modifier la tâche », menu « Reporter »), carnet de prestataires (liste,
panneau, fiche complète). En complément : l'espace vide (Aujourd'hui, Tâches), l'espace repris (fiche de
« Léa & Hugo », carnet, accueil de l'import), l'agence (liste de 65 évènements), une rubrique des
Paramètres (Notifications) en 1 440 et en 375 px, et le premier écran de `/events/new`,
`/prestataires/nouveau`, `/demarrage`, `/aide` et de l'étape « Doublons » de l'assistant d'import.
Une cinquantaine de captures du relevé lues, douze captures prises dans l'app (1 440 × 900 et
375 × 812) pour vérifier un clic, un focus ou un menu, et onze recadrages à l'échelle 1 ou agrandis pour
mesurer au pixel. Les jetons actuels viennent de `DESIGN.md`.

Je n'ai pas pu regarder : le survol (l'outil ne survole pas), donc l'état « au survol » des liens et des
boutons ; le reste des Paramètres (deux rubriques vues sur une cinquantaine) ; la suite de `/demarrage`,
des formulaires de création et de l'assistant d'import au-delà de leur premier écran ; `/tutoriels` ; la
vue Calendrier des tâches ; les vues Colonnes et Calendrier des évènements ; le mode sombre du Jour J.
Mes mesures sont prises sur les captures (précision : 2 à 3 px). Mon navigateur a été coupé avant la
fin : je n'ai pas vérifié si la barre d'onglets de la fiche défile au doigt en 375 px, ni rejoué les
écrans en 911 × 512 dans l'app (captures du relevé seulement).

Chemins des preuves : `R/` = `(captures hors dépôt)/releve`
(captures du relevé) ; `V/` = `(captures hors dépôt)/vi`
(mes captures `nav-*.jpg` et mes recadrages).

### Hauteur consommée avant le contenu utile (mesures)

« Contenu utile » = la première ligne sur laquelle on peut agir (première tâche, premier prestataire).

| Écran | 1 440 × 900 | 375 × 812 | 911 × 512 |
| --- | --- | --- | --- |
| Fiche d'un évènement (Synthèse) | carte « Prochaine action » à 552 px, première ligne à 607 px (67 % de l'écran) | barre d'onglets à 800 px, carte à 857 px, première ligne à 913 px : **rien d'utile dans le premier écran** | la frise finit à 455 px, « Reporter / Annuler l'évènement » à 497 px : **les onglets sont hors de l'écran** |
| Aujourd'hui | carte « À traiter en premier » à 265 px, première ligne à 337 px (37 %) | carte à 380 px, premier titre à 443 px (55 %) | carte à 288 px, première ligne à 370 px (72 %) |
| Tâches | carte à 207 px, en-tête du tableau à 394 px, première tâche à 490 px (54 %) | carte à 336 px, en-tête à 620 px, première tâche à 720 px (89 %) | première tâche à 500 px : une demi-ligne visible |
| Carnet de prestataires | panneau des résultats à 479 px, premier nom à 552 px (61 %) ; 710 px (79 %) quand la carte de tutoriel est affichée | « 12 résultats » à 1 008 px, premier nom à 1 096 px : **1,35 écran avant le premier prestataire** | les filtres finissent hors de l'écran, aucun résultat visible |

Preuves : `R/camille/shots/events_id_--1440-haut.jpg`, `accueil--1440-haut.jpg`, `taches--1440-haut.jpg`,
`prestataires--1440-haut.jpg`, les mêmes en `--375-haut` et `--zoom150-haut`, `V/ev375-a.jpg`,
`V/pr375-a.jpg`, `V/ta375-a.jpg`, `V/nav-017.jpg`.

## Hypothèses

### H-VI-01 — Le filtre « Où ? » est un carré de 26 px où la saisie ne se voit pas
- Écran et taille : `/prestataires`, espaces rempli et repris, 1 440, 911 et 375 px
- Constat : le champ de lieu mesure 26 × 38 px (x 715 à 741). Il chevauche la fin du champ « Nom ou ville ». Derrière lui, un pavé blanc de 420 × 72 px contient « dans un rayon de » et la liste « 15 km », centrés. J'ai cliqué dans le carré et tapé « Bordeaux » : le contour de focus apparaît, aucun caractère ne se lit. Les libellés de la rangée sont à quatre hauteurs : « Où ? » à 326 px, « dans un rayon de » à 343 px, « Nom ou ville » et « Déjà travaillé ensemble » à 347 px. En 375 px le carré commence à x = 4, hors de la marge de 16 px.
- Preuve : `V/ou.jpg`, `V/ou2.jpg` (après saisie), `V/nav-019.jpg`, `R/camille/shots/prestataires--375-haut.jpg`
- Gravité présumée : bloque
- Qui bute : toute planner qui cherche « un photographe à 30 km du domaine ». Elle croit le filtre cassé, ou tape sans voir.
- Principe candidat : un champ de texte a une largeur minimale (200 px), et tous les libellés d'une barre de filtres sont sur la même ligne de base.

### H-VI-02 — Téléphone : l'onglet actif de la fiche sort de l'écran
- Écran et taille : `/events/[id]?onglet=retroplanning`, espace rempli, 375 px
- Constat : sur l'onglet Rétroplanning, la barre ne montre que « Synthèse » et « Budget et prestataires 6/9 ». L'onglet actif n'est pas visible. Rien n'indique que la barre continue : ni flèche, ni fondu, ni compteur. Six onglets sur huit sont cachés.
- Preuve : `V/nav-030.jpg` ; `R/camille/shots/events_id_--375-haut.jpg`
- Gravité présumée : bloque
- Qui bute : la planner sur son téléphone. Elle ne sait ni où elle est dans la fiche, ni qu'il existe un Programme, des Invités, des Documents.
- Principe candidat : l'onglet actif est toujours visible ; une barre qui déborde le dit (fondu et flèche) ou devient une liste « Rubrique : … ».

### H-VI-03 — Téléphone : le tableau des tâches ne montre ni l'échéance ni les actions
- Écran et taille : `/taches` et onglet Rétroplanning, 375 px
- Constat : le tableau déborde de sa carte. On voit la case, le rond « Fait » et une colonne de titre de 100 px ; l'en-tête suivant est coupé (« CA »). Un titre de 38 caractères tient sur trois lignes de 13 caractères. L'échéance, « Qui la réalise » et les trois boutons sont hors de l'écran, sans signe de défilement. La première tâche arrive à 720 px.
- Preuve : `R/camille/shots/taches--375-haut.jpg`, `V/ta375-a.jpg`
- Gravité présumée : bloque
- Qui bute : la planner en déplacement. Elle lit des titres sans date : elle ne sait pas ce qui presse.
- Principe candidat : sous 600 px, un tableau devient une liste de cartes : titre sur toute la largeur, échéance et responsable dessous, une action visible, les autres dans « ⋯ ».

### H-VI-04 — La fiche d'un évènement consomme 552 px avant sa première carte
- Écran et taille : `/events/[id]`, tous onglets, 1 440, 911 et 375 px
- Constat : neuf strates précèdent le contenu en 1 440 px : barre du haut (44 à 88 px), lien de retour (127), titre et pastille (160), ligne de faits (189), « Type d'événement » (205 à 249), quatre boutons (265 à 309), frise (333 à 410), « Reporter / Annuler l'évènement… » (453), onglets (490 à 535). La carte commence à 552 px. En 375 px elle commence à 857 px, plus bas que l'écran. En 911 × 512, l'écran s'arrête sous la frise. Ces strates se répètent à l'identique sur les huit onglets.
- Preuve : `R/camille/shots/events_id_--1440-haut.jpg`, `events_id_--375-haut.jpg`, `events_id_--zoom150-haut.jpg`, `V/ev375-a.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui passe d'un onglet à l'autre vingt fois par jour, et toute personne sur un portable à 150 % : elle fait défiler à chaque onglet avant de lire une ligne.
- Principe candidat : l'en-tête d'un objet tient en 200 px au plus en 1 440 px et en un tiers d'écran sur téléphone ; ce qui sert une fois (type, report, annulation) va dans un menu « Plus ».

### H-VI-05 — Le titre d'une tâche a 17 % de la ligne, ses trois boutons 27 %
- Écran et taille : `/taches` et Rétroplanning, 1 440 px
- Constat : le tableau fait 1 006 px. La colonne « Tâche » en reçoit 172 (x 489 à 661) : neuf titres sur onze passent sur deux lignes, un sur trois. La colonne « Catégorie » prend 100 px pour un tiret sur chaque ligne. « Modifier », « Reporter ▾ » et « Supprimer » prennent 276 px. La ligne monte à 90–112 px au lieu de 60. Dans le Rétroplanning, une tâche faite n'a que deux boutons (« Rouvrir », « Supprimer ») : 117 px restent vides à droite, et le titre, barré et gris clair, passe quand même sur deux lignes.
- Preuve : `V/taches-head.jpg`, `V/retro-a.jpg`, `R/camille/shots/taches--1440.jpg` ; relevé : 9 titres sur 11, 32 sur 42
- Gravité présumée : freine
- Qui bute : toute planner qui parcourt sa liste : l'œil descend en zigzag, et onze tâches demandent 1 030 px.
- Principe candidat : dans un tableau, la colonne du nom prend la place restante ; une colonne vide sur toutes les lignes ne s'affiche pas ; les actions de ligne tiennent en un bouton et un menu.

### H-VI-06 — « Reporter » et « Voir 4 de plus » : deux pilules à gauche, sans objet nommé
- Écran et taille : `/events/[id]`, carte « Prochaine action », 1 440 et 375 px
- Constat : les boutons de ligne (« Fait », « Noter une relance ») sont à droite, rectangulaires, texte noir. « Reporter » et « Voir 4 de plus » sont empilés à gauche (x = 333), en pilule, texte vert. « Reporter » est placé sous la troisième ligne, qui est un contrat. Cliqué, il ouvre une carte dans la carte (672 px) avec « Nouvelle date » et un bouton principal « Reporter la tâche » : aucune tâche n'est nommée.
- Preuve : `V/nav-012.jpg`, `V/nav-025.jpg`, `V/nav-026.jpg`
- Gravité présumée : freine
- Qui bute : la planner pressée. Elle ne sait pas quelle tâche elle reporte, ni si « Reporter » concerne le contrat du traiteur.
- Principe candidat : une action de ligne est sur sa ligne, à droite ; une action sous une liste ne peut être que « voir la suite ».

### H-VI-07 — Aucune action principale sur Aujourd'hui : l'œil va au bandeau « fiche entreprise »
- Écran et taille : `/`, espaces rempli et vide, 1 440 et 375 px
- Constat : l'écran n'a aucun bouton principal. Le premier aplat de couleur est le bandeau vert clair « Votre fiche entreprise n'est pas encore complète. La compléter » (1 056 × 46 px, à 203 px), placé au-dessus de « À traiter en premier ». Il a le fond d'une confirmation. En 375 px il prend 68 px avant la carte.
- Preuve : `R/camille/shots/accueil--1440-haut.jpg`, `accueil--375-haut.jpg`, `R/vide/shots/accueil--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la planner chaque matin : une tâche administrative de démarrage passe avant « En retard de 4 jours ».
- Principe candidat : un rappel de réglage ne se place jamais au-dessus du travail du jour ; il va dans « Pour bien démarrer » et se ferme.

### H-VI-08 — « À traiter en premier » : sept liens verts soulignés, sept boutons, trois « Voir… »
- Écran et taille : `/`, espace rempli, 1 440 px
- Constat : dans 460 px de haut, la carte porte 7 titres en lien vert souligné, 7 boutons de ligne (« Fait », « Ouvrir », « Noter une relance »), 3 liens « Voir dans Tâches › », « Voir l'évènement › », « Voir les encaissements › ». Le titre et le bouton « Ouvrir » de la même ligne mènent au même endroit (supposé, non vérifié). Les sous-titres « Tâches (5) », « Relances et messages (1) », « Paiements (1) » sont en gris 13 px, plus discrets que les pastilles de date.
- Preuve : `R/camille/shots/accueil--1440-haut.jpg` ; relevé : 6 zones d'action, 14 commandes dans le premier écran
- Gravité présumée : freine
- Qui bute : la débutante : tout est vert et souligné, rien ne dit par où commencer.
- Principe candidat : une ligne de liste a une seule cible principale (toute la ligne ouvre) et un seul bouton pour l'action rapide.

### H-VI-09 — Dix-neuf formes de commande relevées
- Écran et taille : les quatre modules, 1 440 px
- Constat : j'ai compté dix-neuf formes. (1) bouton plein vert ; (2) bouton plein vert à menu « Nouveau ▾ » ; (3) bouton blanc bordé de 44 px ; (4) le même avec icône (« Réglages », « + Créer ») ; (5) petit bouton blanc de 30, 32 ou 40 px (« Fait », « Noter une relance », « Modifier ») ; (6) bouton bordé rouge (« Supprimer ») ; (7) pilule blanche à texte vert (« Reporter », « Pourquoi ? », « Modifier « Dîner » », « Reprendre les prestataires retenus (PDF) ») ; (8) pastille de filtre ; (9) bascule à option pleine verte ; (10) onglet souligné ; (11) lien vert souligné ; (12) lien vert gras sans soulignement (« Changer le type », « Fermer », « Passer la visite », « Modifier » du programme) ; (13) lien rouge, souligné (« Annuler l'évènement… ») ou non (« Retirer ») ; (14) lien noir souligné (« Archiver ») ; (15) texte noir sans signe qui ouvre (titre d'une tâche, nom d'un évènement, ligne entière) ; (16) rond « Fait » et case à cocher ; (17) bouton rond à icône (« ? », cloche) ; (18) liste déroulante suivie d'un lien qui l'applique (« Type d'événement ») ; (19) date suivie d'une icône de calendrier.
- Preuve : `R/camille/shots/events_id_--1440.jpg`, `taches--1440-haut.jpg`, `prestataires--1440-haut.jpg`, `events_id_onglet_programme--1440.jpg`, `V/nav-026.jpg`
- Gravité présumée : freine
- Qui bute : toutes : la forme ne dit plus l'importance. « Archiver » (définitif pour la liste) est un lien noir, « Pourquoi ? » (une explication) est un bouton.
- Principe candidat : six formes au plus : principal, secondaire, danger, lien, menu « ⋯ », bascule ; deux hauteurs (44 et 32 px).

### H-VI-10 — « Supprimer » en rouge à chaque ligne : le rouge ne veut plus dire « en retard »
- Écran et taille : `/taches`, Rétroplanning, Programme du jour J, 1 440 px
- Constat : dans le premier écran de « Tâches », le rouge apparaît onze fois : 4 boutons « Supprimer », 2 pastilles « En retard », 2 dates rouges avec icône rouge, la pastille « 2 en retard » du menu, la pastille de la cloche. La vue « Toutes » porte 42 boutons rouges, le Programme 28 liens rouges « Retirer ». Les deux tâches vraiment en retard ne ressortent plus.
- Preuve : `R/camille/shots/taches--1440-haut.jpg`, `taches--1440.jpg`, `events_id_onglet_programme--1440.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui cherche d'un coup d'œil ce qui est en retard ; et celle qui craint de cliquer à côté de « Reporter ».
- Principe candidat : le rouge est réservé au retard et à l'erreur ; une suppression est dans le menu de la ligne ou dans la fenêtre, jamais répétée par ligne.

### H-VI-11 — Deux cases voisines par tâche : sélectionner ou cocher « fait » ?
- Écran et taille : `/taches`, Rétroplanning, 1 440 et 375 px
- Constat : chaque ligne commence par un carré de 22 px (sélection, sans en-tête) puis, 56 px plus loin, un rond de 24 px sous l'en-tête « Fait ». Une tâche faite remplace le rond par un carré vert coché : la ligne montre alors deux carrés, un vide et un plein. La tâche faite est dite trois fois : titre barré, titre grisé, pastille « Faite ».
- Preuve : `V/taches-head.jpg`, `V/nav-030.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui veut cocher vite : elle coche la sélection, rien ne se passe, ou l'inverse.
- Principe candidat : une seule case par ligne ; la sélection en lot s'active par un mode (« Sélectionner »), elle n'est pas permanente.

### H-VI-12 — Le carnet : trois lignes et 138 px par prestataire pour un nom
- Écran et taille : `/prestataires`, espaces rempli et repris, 1 440 et 375 px
- Constat : chaque fiche montre le nom, « Non placé sur la carte » (12 fois sur 12) et un lien « Archiver » (12 fois). Elle prend 138 px. Quatre prestataires tiennent dans un écran de 900 px, douze demandent 1 656 px. Ni métier, ni ville, ni téléphone. « Archiver » est le seul lien noir souligné de l'app, décalé de 12 px à droite du nom (x 337 contre 325).
- Preuve : `R/camille/shots/prestataires--1440-haut.jpg`, `V/pr375-a.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui a repris 35 ou 600 contacts : elle fait défiler sans rien apprendre, avec « Archiver » sous le pouce à chaque ligne.
- Principe candidat : une ligne de liste montre ce qui distingue l'objet (métier, ville), pas ce qui lui manque ; une absence commune à toutes les lignes se dit une fois, en tête.

### H-VI-13 — Onglet « Documents » coupé au bord, pastilles d'onglet de trois natures
- Écran et taille : `/events/[id]`, espaces repris et rempli, 1 440 px
- Constat : dans l'espace repris, le septième onglet se lit « Documen », coupé à x = 1 363, sans flèche. Dans l'espace rempli, six onglets sont visibles, les autres sont hors de la barre. Les pastilles d'onglet mêlent un rapport (« 6/9 », vert), une alerte (« 2 en retard », rouge) et un compte (« 1 », vert). « 6/9 » et « 1 » n'ont pas d'unité.
- Preuve : `R/repris/shots/events_id_--1440-haut.jpg`, `R/camille/shots/events_id_--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui cherche ses documents ou ses invités : l'onglet est hors champ ; et celle qui lit « 6/9 » sans savoir de quoi.
- Principe candidat : une barre d'onglets tient entière à 1 440 px (sept au plus, le reste dans « Plus ») ; une pastille d'onglet ne porte qu'une alerte.

### H-VI-14 — Un bouton plein par champ : six sur la fiche d'un prestataire, quatre dans « Modifier les informations »
- Écran et taille : `/prestataires/[id]` et `/events/[id]?onglet=apercu&modifier`, 1 440 px
- Constat : la page porte six boutons pleins verts : « Enregistrer l'IBAN », « Ajouter la pièce », « Demander au prestataire », « Enregistrer la note », « Joindre », « Enregistrer le point ». Les champs font 574 px sur une carte de 1 056 : la moitié droite de quatre cartes est vide. « IBAN » et « BIC » sont écrits deux fois dans la même carte (valeur « — », puis champ). Le titre « Atelier Papier » n'a ni métier ni statut. Même motif dans le panneau « Modifier les informations » de la fiche d'évènement : « Changer la date », « Enregistrer le fuseau », « Enregistrer le budget souhaité », « Enregistrer le lieu », quatre boutons pleins empilés dans 800 px, un par champ.
- Preuve : `R/camille-prestataires/shots/prestataires_id_--1440.jpg`, `R/camille/shots/events_id_onglet_apercu_modifier--1440-haut.jpg` ; relevé : 6 et 12 boutons principaux
- Gravité présumée : freine
- Qui bute : la planner qui complète une fiche : elle ne sait pas si un « Enregistrer » enregistre tout ou seulement son bloc.
- Principe candidat : un seul bouton plein par écran ; les blocs d'une fiche se modifient dans une fenêtre, leur bouton d'entrée est secondaire.

### H-VI-15 — Paramètres : deux menus, deux recherches, une barre du haut qui se déplace
- Écran et taille : `/parametres/notifications`, 1 440 et 375 px
- Constat : le menu des Paramètres (229 px) s'ajoute au menu latéral (232 px) : le contenu commence à x = 570 et garde 794 px. La barre du haut commence à 570 au lieu de 308 : la recherche et « + Créer » changent de place en entrant dans les Paramètres. Deux champs de recherche sont côte à côte (« Chercher un réglage », « Rechercher un événement… »). « Prestataires et données » tient sur deux lignes. En 375 px, le menu remplit le premier écran : le titre « Notifications » n'y est pas.
- Preuve : `R/camille/shots/parametres_notifications--1440-haut.jpg`, `parametres_notifications--375-haut.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui règle une notification sur téléphone : elle croit ne pas avoir changé d'écran.
- Principe candidat : les commandes globales ne bougent pas d'un écran à l'autre ; sur téléphone, un menu de second niveau est replié et l'écran commence par son titre.

### H-VI-16 — Future marque : l'orange se confondra avec l'ambre « attend quelqu'un »
- Écran et taille : les quatre modules (projection, non vue à l'écran)
- Constat : l'ambre occupe déjà : les pastilles de date à venir (« Le 29 novembre 2026 »), « Depuis le… », « À surveiller », « Mariés », « Même jour : … », le bandeau « Chevauchements à vérifier », le point « Jour J » du calendrier, les icônes des familles « Musique » et « Traiteur » du carnet. Un orange de marque sur un bouton ou un compteur y serait lu comme une alerte. Un texte blanc sur un orange vif courant donne environ 2,5:1 : illisible en bouton. Trois répartitions à étudier. (A) Bleu = action et liens ; crème = fond de page et des bandeaux d'information ; orange = marque seulement (logo, illustration, écran vide), jamais dans une liste ; l'attente passe de l'ambre à un jaune moutarde ou à une pastille neutre avec icône d'horloge. (B) Bleu = action ; orange = l'unique « à traiter » (il remplace l'ambre : pastilles d'attente et d'échéance proche), le rouge reste le retard ; crème = fond ; l'orange est alors interdit aux boutons. (C) Bleu = action ; orange = accent d'un seul élément par écran (compteur du jour, étape en cours de la frise), en texte foncé sur orange ; l'attente devient neutre avec icône ; crème = cartes mises en avant.
- Preuve : `R/camille/shots/accueil--1440-haut.jpg`, `R/agence/shots/events--1440-haut.jpg`, `R/repris/shots/prestataires--1440-haut.jpg`, `events_id_onglet_programme--1440.jpg` ; calcul de contraste sur les jetons
- Gravité présumée : freine (si rien n'est décidé avant le changement de marque)
- Qui bute : la planner qui a appris « ambre = j'attends quelqu'un » : elle lira chaque touche d'orange comme une attente.
- Principe candidat : une teinte, un sens ; la couleur de marque secondaire n'entre pas dans les listes tant que les couleurs d'état n'ont pas été recalées.

### H-VI-17 — Écrans vides : le message le plus discret est le plus important
- Écran et taille : `/` et `/taches`, espace vide, 1 440 px
- Constat : sur Aujourd'hui vide, « Rien ne presse : tout est à jour. » est une ligne de 15 px dans une carte de 1 056 × 110 px ; dessous, une grille de 35 cases vides occupe 600 px. Le bandeau vert « fiche entreprise » reste l'élément le plus coloré. Sur Tâches vide, le bloc en pointillés propose « Voir les évènements » (bouton secondaire) et « Lire l'aide » (lien), le lien posé 10 px plus haut que le centre du bouton ; le seul bouton plein de l'écran est « Ajouter la tâche » des tâches hors évènement, 320 px plus bas.
- Preuve : `R/vide/shots/accueil--1440-haut.jpg`, `R/vide/shots/taches--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la nouvelle inscrite : l'écran lui dit que tout va bien alors qu'elle n'a rien créé.
- Principe candidat : un écran vide porte le seul bouton plein de l'écran, centré sur la première création ; les blocs sans contenu se replient.

### H-VI-18 — Assistant d'import : la barre du bas laisse voir le tableau, trois boutons de lot de même poids
- Écran et taille : `/import/[importId]/rapprochements` et `/import`, espace repris, 1 440 px
- Constat : la barre fixe « Retour / Continuer » n'a pas de fond : entre les deux boutons, les lignes du tableau se lisent à travers (y 830 à 880). L'aplat le plus grand de l'écran est le bandeau ambre « 25 rapprochements attendent votre décision » (1 056 × 192 px). Trois boutons blancs de même forme proposent trois traitements en lot : « Valider les 25 rapprochements proposés », « Créer les 25 lignes comme nouvelles », « Tout accepter (25 propositions sûres) ». « Continuer » reste un bouton plein. Les cinq cases d'étape n'ont pas la même hauteur (92 et 100 px). Sur `/import`, les quatre cartes de choix ouvrent au clic sans flèche ni bouton, et l'état « confirmé » du journal est un mot en minuscules, sans pastille.
- Preuve : `R/import/shots/import_importId_rapprochements--1440-haut.jpg`, `R/repris/shots/import--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui reprend 25 ou 600 lignes : elle ne sait pas lequel des trois boutons est le choix sûr, et le seul bouton vert ne peut pas aboutir.
- Principe candidat : dans un choix à plusieurs issues, une seule est en bouton plein et c'est la plus sûre ; une barre fixe a un fond opaque ; un bouton plein n'est jamais une impasse.

### H-VI-19 — La bascule active a le fond du bouton principal
- Écran et taille : `/events`, `/taches`, carnet en 375 px, 1 440 et 375 px
- Constat : sur `/events`, trois aplats verts pleins : « Nouveau ▾ » (à droite, x 1 245), « Liste » (x 313, y 208) et « À venir · 4 » (x 313, y 334). L'œil, qui lit de gauche à droite, rencontre les deux options de bascule avant le bouton. Sur `/taches`, « Liste » est le seul aplat vert du premier écran : il passe pour l'action principale. Deux bascules de même forme servent à deux choses : changer de vue, filtrer par état.
- Preuve : `R/camille/shots/events--1440-haut.jpg`, `taches--1440-haut.jpg` ; relevé : 4 boutons principaux sur `/events`, 2 sur `/taches`
- Gravité présumée : gêne
- Qui bute : la débutante : elle cherche le bouton pour créer et voit trois candidats.
- Principe candidat : l'option active d'une bascule prend le fond clair (`primary-soft`) et un texte fort, jamais l'aplat de l'action principale.

### H-VI-20 — Une même tâche a cinq formes
- Écran et taille : `/`, `/events/[id]` (Synthèse), `/taches`, Rétroplanning, 1 440 px
- Constat : (a) Aujourd'hui : lien vert souligné sur une ligne, « En retard de 4 jours », « Vous », bouton « Fait » de 47 × 30 px. (b) « Prochaine action » de la fiche : même ligne, bouton « Fait » de 47 × 43 px. (c) « Les 14 prochains jours » : trois lignes empilées, bouton « Ouvrir » de 79 × 44 px. (d) Tâches : titre noir sans soulignement, pastille « En retard » sans durée, date « ven. 20 nov. » en rouge, pastille « Planner », rond, trois boutons. (e) calendrier d'Aujourd'hui : texte rouge dans une case. La date s'écrit « Le 29 novembre 2026 » ici, « dim. 29 nov. » là ; le responsable « Vous » ici, « Planner » là.
- Preuve : `R/camille/shots/accueil--1440.jpg`, `V/nav-012.jpg`, `V/nav-027.jpg`, `V/taches-head.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui retrouve « sa » tâche d'un écran à l'autre : elle doit la reconnaître par le texte, pas par la forme.
- Principe candidat : un objet a une ligne type (titre, statut, échéance, responsable, action) reprise partout, en version courte ou longue.

### H-VI-21 — Menu latéral : pastille « 2 en retard » sur deux lignes, adresse coupée sans points
- Écran et taille : menu latéral, toutes les pages, 1 440 et 911 px
- Constat : la pastille mesure 80 × 44 px (x 123 à 203) dans une entrée de 199 px. Il reste 80 px après « Tâches » ; « 2 en retard » en demande environ 84 en 13 px gras. Il manque 4 px. Sur l'entrée active, le rose de la pastille se pose sur le vert clair. C'est l'élément le plus coloré du menu, sur 94 écrans. En bas du menu, l'adresse du compte est coupée net au bord (« camille.roussel+spec@exemple.tes »), sans « … » ni moyen de la lire ; « Créer une autre organisation » est un lien vert centré sur deux lignes, sans soulignement, entre deux blocs alignés à gauche.
- Preuve : `R/camille/shots/accueil--1440-haut.jpg`, `taches--1440-haut.jpg`, `taches--zoom150-haut.jpg`, `V/nav-005.jpg`
- Gravité présumée : gêne
- Qui bute : toutes, à chaque page : un défaut de finition vu en permanence, et une alerte qui pèse plus que l'écran lui-même.
- Principe candidat : un compteur de menu est un nombre dans une pastille ronde (« 2 ») ; son sens est dans le nom accessible et dans l'écran.

### H-VI-22 — Une carte vide occupe 52 % de la largeur du carnet
- Écran et taille : `/prestataires`, espace rempli, 1 440 px
- Constat : la liste a 502 px (x 309 à 811), la carte 553 px (x 811 à 1 364). Aucun prestataire n'est placé : la carte est un aplat gris-vert vide avec « + » et « − ». Dans l'espace repris, « Atelier Pétales » porte « Non placé sur la carte » alors que la carte montre cinq points.
- Preuve : `R/camille/shots/prestataires--1440-haut.jpg`, `R/repris/shots/prestataires--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui débute son carnet : la moitié de l'écran ne lui sert pas, et la liste est comprimée.
- Principe candidat : une vue secondaire vide se replie et laisse sa place à la liste.

### H-VI-23 — « 12 » cinq fois en 390 px, « À classer » deux fois
- Écran et taille : `/prestataires`, espace rempli, 1 440 px
- Constat : « 12 prestataires · … » (170 px), « Tous · 12 » et « À classer · 12 » (225 px), « 12 prestataires à classer : les voir · ranger les types » (283 px), « 12 résultats » (512 px). La pastille « À classer · 12 » et le bandeau disent la même chose à 58 px d'écart. Le bandeau a la forme d'un champ désactivé (bord gris, 1 056 × 44 px).
- Preuve : `R/camille/shots/prestataires--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui vient d'importer : elle lit quatre compteurs avant de voir un nom.
- Principe candidat : un nombre se dit une fois par écran, là où l'on agit dessus.

### H-VI-24 — Les aides passent devant l'écran : carte de tutoriel au-dessus du titre, bulle sur le contenu
- Écran et taille : `/prestataires` après la visite guidée ; fiche d'évènement pendant le chargement, 1 440 px
- Constat : après « Passer la visite », une carte « Découvrir en 4 minutes — Comparer plusieurs devis pour une ligne du budget » s'insère au-dessus du titre (768 × 133 px, à 117 px). Le titre descend de 130 à 288 px. Elle porte un bouton principal « Commencer le tutoriel » : deux boutons principaux à l'écran. Son sujet n'est pas le carnet. Sa largeur (768 px) ne s'aligne sur rien (contenu : 1 056 px). Sur la fiche, la même carte est apparue pendant le chargement puis a disparu. Avant elle, la bulle de la visite guidée (360 px) se pose sur le bloc suivant : elle cache le bandeau « à classer » et la moitié des filtres. Son texte dit « Une pastille par famille » ; la zone encadrée n'en montre que deux. « Passer la visite » est un texte vert sans soulignement, à gauche du bouton plein « Suivant ».
- Preuve : `V/nav-017.jpg`, `V/nav-011.jpg`, `V/nav-012.jpg`, `V/nav-014.jpg`, `V/nav-009.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante : la première chose qu'elle voit n'est pas son écran, et le contenu saute de 158 px.
- Principe candidat : rien ne s'insère au-dessus du titre d'un écran ; une invitation au tutoriel vit dans l'aide de l'écran ou dans un coin fixe.

### H-VI-25 — « Nouveau prospect » : l'astérisque tombe seul sur une ligne
- Écran et taille : `/events/new`, 1 440 px
- Constat : sous « Type d'événement » et sous « Prénom du premier marié », l'astérisque « * » est seul sur une seconde ligne : le libellé prend 46 px au lieu de 20. Le titre du groupe « Premier client * » le garde sur sa ligne. La date, dix caractères, a un champ de 576 px. Les groupes « Premier client » et « Second client » sont des cadres dans la carte. Aucun bouton dans le premier écran.
- Preuve : `R/camille/shots/events_new--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante, sur son premier formulaire : un « * » isolé se lit comme une erreur ou une note oubliée.
- Principe candidat : la marque d'obligation est collée au libellé par une espace insécable ; un champ a la largeur de ce qu'on y tape.

### H-VI-26 — En-tête de la fiche : quatre boutons égaux, une liste « Type » en permanence
- Écran et taille : `/events/[id]`, 1 440 px
- Constat : « Messages », « Écrire au client », « Voir comme Léa Martin », « Jour J » ont la même forme et le même poids : aucun n'est l'action de la fiche. Au-dessus, « Type d'événement : » (13 px gras), une liste de 206 × 44 px et le lien vert « Changer le type » occupent une bande de 44 px sur tous les onglets, pour un choix fait une fois. « 67 jours avant le jour J » est en vert gras, la couleur des liens ; je n'ai pas vérifié s'il se clique.
- Preuve : `R/camille/shots/events_id_--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante : la zone la plus haute de la fiche ne lui dit pas quoi faire.
- Principe candidat : un en-tête d'objet porte le nom, le statut, une action principale et un menu ; un texte vert est un lien, sinon il est noir.

### H-VI-27 — La frise pèse plus que le titre et répète le statut
- Écran et taille : `/events/[id]`, 1 440 et 375 px
- Constat : la frise fait 1 056 × 77 px, avec deux disques verts pleins et un anneau. Le nom « Léa & Maxime » fait 22 px de haut de texte. Le statut est dit deux fois : pastille « En préparation » près du titre, étape 3 de la frise. « Option » et « En préparation » portent la même date, celle du chargement. 43 px plus bas, « Reporter l'évènement… » et « Annuler l'évènement… » (13 px, soulignés, le second en rouge) restent visibles sur tous les onglets. En 375 px, « après le 30 janvier 2027 » tient sur quatre lignes dans une colonne de 68 px ; la frise fait 150 px.
- Preuve : `R/camille/shots/events_id_--1440-haut.jpg`, `events_id_--375-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner au quotidien : la frise lui dit ce qu'elle sait déjà, à la meilleure place de l'écran.
- Principe candidat : un statut se dit une fois ; la frise complète se déplie à la demande, une ligne « Étape 3 sur 5 » suffit par défaut.

### H-VI-28 — Téléphone : « Noter une relance » recouvre la pastille de date
- Écran et taille : `/events/[id]`, « Prochaine action », 375 px
- Constat : sur la troisième ligne, le bouton « Noter une relance » (x 180 à 342) passe par-dessus la pastille « Depuis le 24 novembre 2026 » et en cache la fin. Le titre du contrat, repoussé, tient sur trois lignes de 130 px.
- Preuve : `V/ev375-a.jpg`
- Gravité présumée : gêne
- Qui bute : la planner sur téléphone : texte illisible, bouton posé sur une autre information.
- Principe candidat : sur téléphone, le bouton d'une ligne passe sous le texte, sur toute la largeur ; rien ne se superpose.

### H-VI-29 — « Qui la réalise » sur deux lignes, en-têtes et valeurs décalés
- Écran et taille : `/taches`, Rétroplanning, Budget, 1 440 px
- Constat : l'en-tête « QUI LA RÉALISE » tient sur deux lignes dans une colonne de 72 px (x 939 à 1 010) ; en capitales espacées de 13 px il en demande environ 115. « ÉCHÉANCE » commence à x = 786, ses valeurs à x = 795. Dans le Budget, « PROCHAINE ÉCHÉANCE » est sur deux lignes et sa valeur (« 2 880,00 € · 27 novembre 2026 ») sur quatre, dans 80 px.
- Preuve : `V/taches-head.jpg`, `R/camille/shots/events_id_onglet_budget--1440.jpg` ; relevé : 10 écrans
- Gravité présumée : gêne
- Qui bute : la planner qui lit en colonne : l'œil ne tombe pas droit de l'en-tête à la valeur.
- Principe candidat : un en-tête de colonne tient sur une ligne et s'aligne sur le bord de ses valeurs ; un libellé trop long se raccourcit (« Qui », « Échéance »).

### H-VI-30 — « Léa & Maxime » sous chaque tâche, les mois en titres
- Écran et taille : `/taches` et `/`, 1 440 px
- Constat : le nom de l'évènement est répété sous chacune des onze tâches (gris, 13 px) et après chacun des sept titres d'Aujourd'hui. La liste est groupée par mois (« novembre 2026 », 17 px, la taille d'un titre de carte), pas par évènement.
- Preuve : `R/camille/shots/taches--1440.jpg`, `accueil--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner solo avec un ou deux mariages : une ligne sur deux ne lui apprend rien. Avec 65 évènements (agence), le nom devient utile mais reste le texte le plus petit de la ligne ; je ne l'ai pas vu, l'agence n'a pas de tâche.
- Principe candidat : ce qui est commun à un groupe monte dans le titre du groupe ; on peut grouper par évènement.

### H-VI-31 — Barres d'avancement : un vert et un gris hors jetons, le zéro pèse plus que la valeur
- Écran et taille : `/events` (« Charge des douze prochains mois »), `/events/[id]` (Synthèse, Budget), 1 440 px
- Constat : la barre est d'un vert plus vif que l'émeraude des boutons et sa piste d'un gris foncé. À zéro, la piste reste pleine : neuf barres gris foncé de 378 × 6 px pour les mois à 0, trois barres vertes pour les mois chargés. Dans `/aide`, « Tutoriels faits : 0 sur 11 » est suivi d'une barre gris foncé pleine de 448 px : elle se lit « terminé ». Dans la Synthèse, « 6 lignes pourvues sur 9 » et sa barre (448 px) sont sous la sous-carte « Planning », alors qu'elles parlent du budget.
- Preuve : `V/nav-009.jpg`, `V/nav-027.jpg`, `R/camille/shots/aide--1440-haut.jpg`, `V/budget-a.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui lit sa charge : les mois vides attirent l'œil ; l'agence, sur 65 évènements, lit un mur de barres.
- Principe candidat : une barre d'avancement prend les jetons (piste `line`, valeur `primary`) et se place à côté du chiffre qu'elle illustre.

### H-VI-32 — « Santé de l'évènement » : trois cartes dans une carte, un retard écrit en rouge sans pastille
- Écran et taille : `/events/[id]`, Synthèse, 1 440 et 375 px
- Constat : la carte contient trois sous-cartes de 327 × 168 px. La troisième (« Décisions du client — Aucune en attente ») a 110 px de blanc. « 2 tâches en retard » est un texte rouge de 13 px, sans pastille, à côté de « À surveiller » (pastille ambre) et de « Pourquoi ? » (pilule verte) : trois formes pour un seul signal. En 375 px les trois sous-cartes s'empilent sur 420 px.
- Preuve : `V/nav-027.jpg`, `R/camille/shots/events_id_--375.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui veut l'état du mariage en un regard : elle lit trois boîtes dont une vide.
- Principe candidat : pas de carte dans une carte ; un chiffre clé est un nombre, un libellé et au plus un signal.

### H-VI-33 — Budget : cinq bords gauches dans la première colonne, des pastilles toutes vertes
- Écran et taille : `/events/[id]?onglet=budget`, espace rempli, 1 440 px
- Constat : la colonne « Poste, prestataire et pièces » empile une pastille d'initiales (« LD », « FE »), un lien, une à deux pastilles et le nom du prestataire, sur cinq bords gauches (346, 354, 378, 386 et 390 px). La pastille d'état est tantôt à droite du poste (« Traiteur · Retenu »), tantôt dessous. « Contrat signé », « Engagé », « Retenu », « Soldé » ont le même vert clair : on ne les distingue qu'en lisant. « À trouver » est en rouge, la couleur du retard. « + Ajouter des prestataires ▾ » tient sur deux lignes. Chaque ligne finit par « › » puis « Ouvrir ». En tête, « Détail du budget (simulation, HT, exports) » est un bouton de 332 px.
- Preuve : `V/budget-a.jpg`, `R/camille/shots/events_id_onglet_budget--1440.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui vérifie où en est chaque poste : l'état se perd entre quatre pastilles de même couleur.
- Principe candidat : une cellule, une information ; un état par ligne, dans sa colonne ; le rouge n'est pas un état « à faire ».

### H-VI-34 — Programme du jour J : 56 liens de ligne dont 28 rouges, un second style de tableau
- Écran et taille : `/events/[id]?onglet=programme`, espace rempli, 1 440 px
- Constat : chaque séquence porte « Modifier » (vert gras, sans soulignement) et « Retirer » (rouge, sans soulignement) : 28 lignes, 56 liens. Avant la première séquence, sept commandes de quatre formes : « Importer », « Réglages », deux « Télécharger le PDF », « Diffuser le programme (version 1) », « Ajouter le programme à mon agenda », « Importer un chrono (tableur ou PDF) ». Deux de ces boutons ont un texte de 13 px, les autres de 15 px, pour la même hauteur de 44 px. « Importer » est au milieu de la carte (x 810) ; dans le Budget il est à droite, contre « Réglages ». Les en-têtes du tableau sont en minuscules grises (« Début », « Fin ») ; ceux des tâches et du budget sont en capitales.
- Preuve : `V/prog-a.jpg`, `R/camille/shots/events_id_onglet_programme--1440.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui relit son déroulé la veille : une colonne rouge de 28 « Retirer » borde chaque horaire.
- Principe candidat : dans une liste éditable, la ligne s'ouvre au clic et « Retirer » n'apparaît que dans la ligne ouverte ; un seul style d'en-tête de tableau, « Importer » à la même place partout.

### H-VI-35 — Champ de recherche réduit à « Recher » sur téléphone
- Écran et taille : barre du haut, toutes les pages, 375 et 911 px
- Constat : en 375 px le champ fait 127 px (x 16 à 143). Il affiche « Recher » puis le repère « ⌘K » (34 px), sans objet sur un téléphone. En 911 px il affiche « …un devis, une tâcl ». La rangée (recherche, « + Créer », cloche, « ? ») prend 44 px sous une barre « Symbola / Menu » de 76 px : 157 px avant le titre.
- Preuve : `R/camille/shots/accueil--375-haut.jpg`, `accueil--zoom150-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner sur téléphone : un champ tronqué et un raccourci clavier en première ligne.
- Principe candidat : aucun texte d'invite tronqué : sous 600 px, la recherche est une icône qui ouvre le champ en pleine largeur.

### H-VI-36 — Liste des évènements : filtres, bascule et tableau collés ; noms sans signe de lien
- Écran et taille : `/events`, espaces rempli et agence, 1 440 px
- Constat : les champs de filtre finissent à 310 px, la bascule « À venir · 4 / Terminés · 0 / Archivés » va de 310 à 360, le tableau commence à 360 : aucun espace, les bords se touchent. Le nom de l'évènement est en gras noir, sans soulignement ni flèche ; la ligne entière ouvre la fiche, rien ne le montre. La colonne s'intitule « Mariés » pour « Baptême » et « Anniversaire ».
- Preuve : `R/camille/shots/events--1440-haut.jpg`, `V/nav-009.jpg` ; relevé : 4 liens sans signe, 4 cliquables sans rôle
- Gravité présumée : gêne
- Qui bute : la débutante : elle cherche un bouton « Ouvrir » qui existe ailleurs.
- Principe candidat : 16 px au moins entre deux blocs ; une ligne qui ouvre le montre (chevron à droite, fond au survol).

### H-VI-37 — Agence : 65 pastilles ambre « Même jour » collées aux dates
- Écran et taille : `/events`, agence, 1 440 px
- Constat : chaque ligne porte une pastille ambre « Même jour : Évènement fictif 1 », collée à la date (2 px d'écart), plus large que la date. La colonne « Statut » est repoussée à x = 915. Dix pastilles ambre dans le premier écran : l'ambre, qui veut dire « attend quelqu'un », devient le fond de l'écran.
- Preuve : `R/agence/shots/events--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la directrice d'agence : elle ne distingue plus un vrai conflit de dates d'une option.
- Principe candidat : une alerte qui touche plus d'un tiers des lignes devient un filtre ou un compteur en tête, pas une pastille par ligne.

### H-VI-38 — Calendrier d'Aujourd'hui : titres coupés au milieu d'un mot, légende par la couleur seule
- Écran et taille : `/`, espace rempli, 1 440 px
- Constat : dans les cases de 140 × 96 px, les titres se coupent par césure (« Confirmer la voi-ture des mariés », « Acompte du trai-teur, 30 % Mai-… », « Organiser la dé-gustation finale ») ou par « … ». Les tâches en retard sont en texte rouge. La légende aligne sept points de couleur (Évènement, Client, Prestataires, Administratif, Jour J, Rendez-vous, Paiements) ; le dernier libellé est 3 px plus bas que les autres. Dans les cases, la famille n'est dite que par la couleur d'un trait de 3 px. Les jours d'octobre et de décembre n'ont pas de cadre, ceux de novembre en ont un.
- Preuve : `R/camille/shots/accueil--1440.jpg`
- Gravité présumée : gêne
- Qui bute : une planner daltonienne, ou sur un écran en plein soleil : sept familles, sept teintes, aucun autre signe.
- Principe candidat : jamais plus de quatre couleurs de catégorie, toujours doublées d'une icône ou d'un mot ; pas de césure dans un titre.

### H-VI-39 — Le vert porte huit rôles
- Écran et taille : les quatre modules, 1 440 px
- Constat : le vert sert à : (1) l'action principale ; (2) les liens ; (3) l'entrée de menu, l'onglet et le filtre actifs ; (4) l'option active d'une bascule ; (5) les statuts positifs (« Confirmé », « Soldé », « Engagé », « Faite ») ; (6) le bandeau d'information ; (7) l'avancement (frise, barres) ; (8) un fait mis en valeur (« 67 jours avant le jour J »). Ce qui dépend de la couleur seule : la légende du calendrier ; le filtre actif (fond et bord verts, sans coche) ; la différence entre lien et texte fort (« 67 jours… ») ; les pastilles vertes entre elles. Les statuts de retard et d'attente ont toujours un libellé. Contrastes calculés sur les jetons : gris `ink-muted` 5,7:1 sur le fond, 6,1:1 sur blanc ; ambre sur ambre clair 4,8:1 (limite) ; bord `line` des cartes 1,3:1.
- Preuve : `DESIGN.md` (jetons), `R/camille/shots/events_id_--1440-haut.jpg`, `events--1440-haut.jpg`, `events_id_onglet_budget--1440.jpg`
- Gravité présumée : gêne
- Qui bute : toutes, sans le dire : quand tout est vert, le bouton principal ne ressort pas ; le passage au bleu reportera les huit rôles sur le bleu.
- Principe candidat : la couleur d'action ne sert qu'à ce qui se clique ; un statut positif est neutre ou a sa propre teinte.

### H-VI-40 — Démarrage : cartes de réponse étroites, cinquième étape plus haute
- Écran et taille : `/demarrage`, compte neuf, 1 440 px
- Constat : les trois cartes de réponse font 248 px chacune dans une carte de 1 006 px : 238 px restent vides à droite, et « Autre métier de l'événementiel » comme « Organisation de mariages. » passent sur deux lignes. Les cartes ont trois hauteurs (105, 128 et 150 px). L'étape active « 1. Métier » est une pilule pleine verte, la forme d'un bouton principal, à côté de « Continuer ». La pilule « 5. Outils » fait 44 px de haut, les quatre autres 36. « Passer » est un texte vert sans soulignement. Le menu latéral complet reste affiché pendant les cinq questions.
- Preuve : `R/inscription/shots/demarrage--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la nouvelle inscrite, sur son tout premier écran : des cartes inégales et un menu de onze entrées autour d'une seule question.
- Principe candidat : des choix côte à côte ont la même hauteur et se partagent toute la largeur ; une étape en cours n'a pas la forme d'un bouton.

### H-VI-41 — Mariage repris : deux blocs « Prochaine… », un bouton plein de 909 px
- Écran et taille : `/events/[id]`, espace repris, 1 440 px
- Constat : sous « Prochaine action » (trois contrats à faire signer, « Voir 9 de plus ») vient un bandeau vert « Prochaine étape : créer les liens des mariés », avec un bouton plein « Créer les liens » d'environ 909 px de large et un lien « Plus tard ». Deux blocs se disputent le mot « prochaine ». Le bouton est le plus large de l'app ; partout ailleurs un bouton plein fait 80 à 190 px.
- Preuve : `R/repris/shots/events_id_--1440.jpg`, `R/repris/shots/events_id_--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui reprend un mariage avancé : douze relances d'un côté, un grand bouton de l'autre, elle ne sait pas lequel est « la suite ».
- Principe candidat : une seule « prochaine action » par objet ; un bouton a la largeur de son libellé, sauf sur téléphone.

### H-VI-42 — Valeurs reprises : montants sans espace, noms en capitales, libellés bruts
- Écran et taille : `/events/[id]`, espace repris, Synthèse, 1 440 px
- Constat : la carte « Champs importés » écrit « 18450,50 € », « 21650,50 € », « 3200,00 € », sans espace des milliers ; ailleurs l'app écrit « 24 150,00 € ». Les libellés sont ceux du fichier : « Solde », « Total », « Total Payé ». Les interlocuteurs s'écrivent « Léa MARTIN · Hugo BERNARD » ; dans le mariage créé, « Léa Martin · Maxime Dubois ». Les trois temps forts s'appellent tous « Jour J » (11, 12 et 13 juin) et portent trois boutons identiques « Modifier « Jour J » ».
- Preuve : `V/repris-b.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui vient de reprendre un mariage : ses chiffres n'ont pas la forme de ceux de l'app, elle doute de l'import.
- Principe candidat : une valeur reprise passe par les mêmes formats que les autres (montant, casse des noms) ; ce qui n'a pas pu être rangé le dit en une phrase.

### H-VI-43 — Boutons de ligne de trois hauteurs, bords droits décalés de 8 px
- Écran et taille : `/` et `/events/[id]`, 1 440 px
- Constat : dans « Prochaine action », « Fait » mesure 47 × 43 px et finit à x = 1 331 ; « Noter une relance » mesure 137 × 32 px et finit à x = 1 339. Dans Aujourd'hui, « Fait » (47 × 30) finit à 1 331, « Ouvrir » (65 × 30) à 1 339. Dans « Les 14 prochains jours », « Ouvrir » mesure 79 × 44 px.
- Preuve : `V/pa-right.jpg`, `V/nav-027.jpg`, `R/camille/shots/accueil--1440-haut.jpg`
- Gravité présumée : détail
- Qui bute : personne ne bute ; l'œil voit une colonne de boutons en dents de scie, signe d'un écran pas fini.
- Principe candidat : les boutons d'une même colonne ont la même hauteur et le même bord droit.

### H-VI-44 — Pastilles du tableau des tâches : place variable, contour perdu sur fond gris
- Écran et taille : `/taches`, 1 440 px
- Constat : ligne 1, la pastille est sous le titre, seule sur sa ligne. Ligne 2, elle est à droite de « des mariés », au bout de la deuxième ligne du titre. Sa place dépend de la longueur du titre. Elle répète la date rouge, 130 px plus à droite. Quand le menu « Reporter » d'une ligne est ouvert, la ligne prend un fond gris : la pastille neutre « Planner » y perd son contour, il ne reste que le mot ; la pastille ambre « Mariés » reste visible. Le menu ouvert (254 px) recouvre les boutons des deux lignes suivantes.
- Preuve : `V/taches-head.jpg`, `V/nav-022.jpg`
- Gravité présumée : détail
- Qui bute : la planner qui balaie la colonne pour repérer les retards : ils ne sont pas alignés.
- Principe candidat : un statut a sa colonne, ou une place fixe dans la ligne ; une pastille neutre a un bord, pour tenir sur tous les fonds.

### H-VI-45 — Panneau du carnet : le téléphone coupé en deux lignes
- Écran et taille : `/prestataires?fiche`, 1 440 px
- Constat : dans le panneau de 400 px, « 01 99 00 01 08 » passe à la ligne après « 01 » (colonne de 82 px) alors que la colonne « Contact » en a 250 pour « Lucie Hamon ». Le bouton « Ouvrir la fiche complète » fait 351 px de large. Le panneau se ferme par « × », la fenêtre des tâches par le mot « Fermer ».
- Preuve : `R/camille-prestataires/shots/prestataires_fiche--1440-haut.jpg`, `R/camille/shots/taches_tache--1440-haut.jpg`
- Gravité présumée : détail
- Qui bute : la planner qui veut appeler : un numéro coupé se lit et se copie mal.
- Principe candidat : un numéro, une date, un montant ne se coupent jamais (espaces insécables) ; une seule façon de fermer.

## Dix principes de Design System

1. **Une forme par niveau de commande, six formes en tout.** Principal (plein), secondaire (bordé), danger (dans un menu ou une fenêtre), lien (souligné), menu « ⋯ », bascule. Deux hauteurs : 44 et 32 px. Ni pilule-bouton, ni lien gras sans soulignement, ni lien noir.
2. **Un seul aplat de couleur d'action par écran.** L'option active d'une bascule, un filtre actif, un onglet actif prennent le fond clair. Un bandeau d'information n'a pas la couleur d'une action.
3. **Une teinte, un sens.** Action, attente, retard, réussite : quatre sens, quatre teintes, toujours avec un mot. Le rouge n'habille ni « Supprimer » répété, ni « À trouver ». Avant le passage à la marque bleu-orange-crème, décider si l'orange est « attente » ou « marque » : pas les deux.
4. **L'en-tête d'un objet tient en 200 px.** Nom, statut dit une fois, une action principale, un menu. La première ligne utile est dans le premier tiers de l'écran en 1 440 px et dans le premier écran sur téléphone.
5. **Aucun libellé sur deux lignes, aucune troncature muette.** Colonne du nom élastique, en-têtes courts, compteur de menu réduit à un nombre, numéros et dates insécables, « … » avec le texte entier à portée.
6. **Un objet, une ligne type.** Une tâche, un prestataire, un évènement ont la même anatomie partout (titre, statut, échéance, responsable, action), en version courte ou longue ; même format de date, mêmes mots.
7. **Une ligne de liste : une cible, une action rapide, le reste dans un menu.** La ligne ouvre et le montre ; une seule case par ligne ; rien de destructeur répété à chaque ligne.
8. **Sous 600 px, un tableau devient une liste de cartes et rien ne se superpose.** Onglet actif toujours visible ; boutons sous le texte ; recherche en icône.
9. **Une grille, des bords communs.** Mêmes bords gauche et droit pour les blocs d'un écran, boutons d'une colonne de même hauteur, 16 px au moins entre deux blocs, libellés de champs sur une même ligne, pas de carte dans une carte, champs de 200 px au moins.
10. **Ce qui est vide ou répété se retire.** Une colonne de tirets, une carte sans point, « Non placé sur la carte » douze fois, un compteur dit quatre fois : on le dit une fois en tête, ou on le replie. L'écran vide porte le seul bouton plein.
