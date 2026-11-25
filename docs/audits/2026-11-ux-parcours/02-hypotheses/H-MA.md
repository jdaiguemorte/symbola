# H-MA — Mobile et accessibilité (lot 68, phase 2)

Abréviations des preuves :

- `P/` = (captures hors dépôt)/phase2/preuves-MA/ (mes captures de navigateur, mises à l'abri : la reprise après l'interruption renumérotait les captures et écrasait les premières ; `a-` = première session, `b-` = visite guidée et 360 px, `c-` = touche Tab, `d-` = raccourcis) ;
- `REL/` = (captures hors dépôt)/releve/camille/shots/ ;
- `CODE/` = apps/symbola/.

## 1. Ce que j'ai regardé

**Dans l'app, compte de Camille (espace rempli).** En 375×812 : Aujourd'hui, le menu « Menu » ouvert, défilé, puis Échap ; Tâches (liste, panneau d'une tâche, Échap) ; Évènements ; la fiche « Léa & Maxime » (en-tête, frise, onglets Synthèse, Budget et prestataires, Rétroplanning) ; le carnet (liste et carte) ; « Nouveau prestataire » ; Paramètres › Notifications par son adresse, puis Équipe par le menu des Paramètres, puis « Menu › Paramètres » ; l'aide « ? » sur Tâches et sur Aujourd'hui ; la visite guidée d'Aujourd'hui, ses quatre étapes, sortie par Échap. En 360×780 : l'en-tête de la fiche. En 911×512 : Tâches à la touche Tab (lien d'évitement, cinq arrêts), les raccourcis N, ? et Ctrl K, Échap après chacun. Environ 60 commandes de navigateur en deux sessions.

**Captures du relevé lues** : `--375-haut` et `--375` de Tâches, Évènements, fiche, Budget, carnet ; `--zoom150-haut` d'Aujourd'hui, Évènements, fiche, Tâches, panneau d'une tâche, carnet, Paramètres › Notifications.

**Code lu, sans rien modifier** : `app/globals.css` (jetons de couleur, onglets, tableaux, pastilles, tiroir d'aide, bulle de visite), `app/app-shell.tsx`, `app/app-sidebar.tsx`, `app/taches/task-table-client.tsx`, `app/taches/task-check.tsx`, `app/settings-nav.tsx`, `packages/ui/src/guided-tour.tsx`. Rapports de contraste calculés (formule WCAG) à partir des jetons.

**Ce que je n'ai pas pu regarder** : un vrai lecteur d'écran (je lis le code et le texte de la page, pas ce qu'une synthèse vocale prononce) ; un vrai pouce (aucun geste de côté : je sais par le code et par le texte de la page ce qui est hors du cadre, je n'ai pas fait défiler un tableau de côté) ; la touche Tab au-delà de Tâches (Évènements, fiche, carnet : ordre lu dans le code seulement) ; le piège de focus des panneaux ; un compte neuf et l'ouverture automatique d'une visite ; les longues listes de l'agence sur téléphone (chiffres du relevé seulement) ; la fiche d'un prestataire ; la carte avec son fond (non installé ici) ; les erreurs de formulaire sur téléphone ; le clavier virtuel.

## 2. Hypothèses

### H-MA-01 — Sur téléphone, « Budget et prestataires » montre les libellés sans les montants
- Écran et taille : `/events/[id]?onglet=budget`, Camille, 375×812
- Constat : chaque poste devient une carte avec « Prévu », « Réel », « Écart », « Réglé », « Reste à payer », « Prochaine échéance », et aucune valeur à l'écran. Les montants (« 6 500,00 € », « 3 500,00 € »…), la pastille « Engagé » et le bouton « Ouvrir » sont dans la page, hors du cadre à droite : la carte garde une largeur minimale de 560 px dans un écran de 375 px, et chaque valeur est poussée au bord droit de la carte.
- Preuve : `P/a-015.jpg` (six libellés, aucune valeur, bord droit de la carte absent) ; texte de la page lu par `text` (les montants y sont) ; `CODE/app/globals.css` ligne 1572 (`min-w-[560px]`) et lignes 5905-5931 (mise en cartes, `justify-between`).
- Gravité présumée : bloque
- Qui bute : la planner en rendez-vous ou sur le lieu, qui ouvre le budget pour dire ce qu'il reste à payer au traiteur. Elle voit six libellés vides et croit que rien n'est saisi.
- Principe candidat : un tableau mis en cartes sur téléphone ne garde aucune largeur minimale ; chaque libellé a sa valeur sur la même ligne, dans l'écran.

### H-MA-02 — Sur téléphone, le tableau des tâches cache l'échéance, « Qui la réalise » et les trois actions
- Écran et taille : `/taches` et `/events/[id]?onglet=retroplanning`, 375×812
- Constat : le tableau a sept colonnes (case, « Fait », « Tâche », « Catégorie », « Échéance », « Qui la réalise », actions). On en voit trois ; la quatrième est coupée à « CA ». La date, la personne et « Modifier », « Reporter », « Supprimer » sont à droite, hors du cadre, sans fondu ni flèche. Seule la pastille « En retard » dit quelque chose du temps.
- Preuve : `P/a-006.jpg`, `REL/taches--375.jpg`, `P/a-019.jpg` (Rétroplanning) ; colonnes lues dans `CODE/app/taches/task-table-client.tsx` lignes 270-290.
- Gravité présumée : bloque
- Qui bute : toute planner sur téléphone. Une liste de tâches sans date ne sert pas à décider quoi faire aujourd'hui.
- Principe candidat : pas de défilement horizontal sur téléphone ; une ligne de liste montre sans geste son titre, son échéance et son état, et range ses actions secondaires derrière un seul bouton.

### H-MA-03 — Paramètres sur téléphone : selon l'entrée, on ne voit pas le réglage, ou on ne voit pas le menu
- Écran et taille : `/parametres`, `/parametres/notifications`, `/parametres/equipe`, 375×812
- Constat : ouverte par son adresse (lien d'un e-mail, rechargement), « Notifications » montre d'abord le menu des Paramètres ; le titre « Notifications » est à 1 200 px et la première case à cocher vers 1 540 px, soit 1,9 écran. Ouverte par « Menu › Paramètres », la page arrive déjà défilée de 1 187 px, sur le formulaire « Entreprise et TVA » (SIREN, forme juridique) : le menu des cinquante rubriques est au-dessus, invisible, et rien ne dit qu'il existe. Pour passer de « Notifications » à « Équipe » : remonter d'un écran et demi, retrouver la rubrique dans la liste, toucher ; la page redescend seule sur « Équipe ». Pour la rubrique suivante, recommencer.
- Preuve : `P/a-026.jpg` et `P/a-027.jpg` (par l'adresse) ; `P/a-034.jpg` (par le menu : défilement 1 187 sur 3 821 px) ; `P/a-029.jpg` (« Équipe » : défilement 1 187 sur 2 588 px) ; relevé, § 2 (55 écrans sur 58).
- Gravité présumée : bloque
- Qui bute : la planner qui cherche « Notifications » depuis le menu. Elle tombe sur SIREN, conclut que « Paramètres » veut dire « ma société », et ne trouve pas le reste.
- Principe candidat : sur téléphone, un menu de second niveau est un écran à lui seul (la liste, puis le réglage avec « ← Paramètres »), jamais un bloc empilé au-dessus du contenu.

### H-MA-04 — Fiche d'évènement sur téléphone : l'onglet actif sort de l'écran, six onglets sur huit sont cachés
- Écran et taille : `/events/[id]?onglet=retroplanning`, 375×812
- Constat : la barre montre « Synthèse » et « Budget et prestataires 6/9 ». Les six autres (« Rétroplanning », « Programme du jour J », « Mes devis et factures », « Mariés », « Documents », « Invités ») sont à droite, sans fondu ni flèche. Sur le Rétroplanning, l'onglet actif n'est pas ramené à l'écran : la barre ne souligne aucun onglet.
- Preuve : `P/a-019.jpg` (Rétroplanning ouvert, aucun onglet souligné) ; `P/a-013.jpg` ; `CODE/app/globals.css` ligne 561 (`overflow-x-auto`, rien d'autre).
- Gravité présumée : freine
- Qui bute : la planner qui cherche le programme du jour J sur son téléphone. Elle ne sait ni qu'il y a d'autres onglets, ni où elle est.
- Principe candidat : une barre d'onglets qui déborde le montre (onglet coupé net ou fondu) et ramène l'onglet actif à l'écran ; au-delà de quatre onglets sur téléphone, une liste « Rubrique ».

### H-MA-05 — Fiche d'évènement sur téléphone : 800 px d'en-tête avant les onglets
- Écran et taille : `/events/[id]`, 375×812
- Constat : avant le premier contenu : barre de marque (76 px), recherche et « Créer » (jusqu'à 160 px), lien de retour, titre, quatre lignes d'information, liste « Type d'événement » et « Changer le type », quatre boutons sur deux rangées, frise de cinq étapes, « Reporter l'évènement… » et « Annuler l'évènement… ». Les onglets commencent vers 800 px, « Prochaine action » vers 860 px. Le premier écran ne contient ni tâche, ni montant.
- Preuve : `REL/events_id_--375-haut.jpg` ; `P/a-013.jpg` (défilement 759 : les onglets sont en haut de l'écran).
- Gravité présumée : freine
- Qui bute : la planner qui ouvre dix fois par jour le même mariage : un écran entier à défiler à chaque fois.
- Principe candidat : sur téléphone, l'en-tête d'une fiche tient en 300 px (nom, date, statut) ; les réglages rares (type, report, annulation) vont derrière « … ».

### H-MA-06 — Le menu du téléphone pousse la page, ne se ferme pas à Échap et perd son bouton de fermeture
- Écran et taille : toutes les pages, 375×812
- Constat : « Menu » déplie douze liens, l'adresse du compte, « Créer une autre organisation » et « Se déconnecter » au-dessus du contenu : la page s'allonge de 788 px (2 905 → 3 693 px). Le bouton devient « Fermer le menu », mais la barre de marque défile avec la page : après 500 px, plus aucun moyen visible de fermer, et « Aujourd'hui » reparaît sous « Se déconnecter », deux écrans l'un sur l'autre. Échap ne ferme pas. Ce qui est bien : la page courante est marquée (fond vert pâle), le bouton porte `aria-expanded`, le menu se replie après un lien.
- Preuve : `P/a-004.jpg` (après Échap : menu toujours ouvert, défilé de 500 px, la page dessous) ; longueurs de page rendues par le navigateur ; `CODE/app/app-sidebar.tsx` (aucune gestion d'Échap pour `open`) ; `CODE/app/globals.css` ligne 351 (`md:sticky` seulement). La capture du haut du menu ouvert a été écrasée à la reprise ; la liste des liens est celle de `CODE/app/app-shell.tsx` lignes 537-640.
- Gravité présumée : freine
- Qui bute : la planner pressée, d'une main : menu ouvert, elle défile, voit deux pages empilées et ne sait plus où elle est.
- Principe candidat : sur téléphone, le menu est un panneau par-dessus la page, avec un bouton de fermeture toujours visible ; il se ferme à Échap, au toucher hors du panneau et au choix d'un lien.

### H-MA-07 — Carnet sur téléphone : le premier nom arrive après 1 276 px de filtres
- Écran et taille : `/prestataires`, 375×812
- Constat : avant la liste : titre et sous-titre, trois boutons (« Réglages », « Importer », « Nouveau prestataire »), deux pastilles, le bandeau « 12 prestataires à classer », cinq filtres empilés (« Nom ou ville », « Où ? », « Déjà travaillé ensemble », « Évaluation », « Sur la carte »), la bascule « Liste / Carte », « 12 résultats », deux liens d'export. Le premier prestataire, « Atelier Papier », est à 1 276 px : 1,6 écran.
- Preuve : `REL/prestataires--375-haut.jpg` ; `P/a-021.jpg` (défilement 560, premier nom à 716 px du haut de l'écran).
- Gravité présumée : freine
- Qui bute : la planner qui cherche le numéro du traiteur dans sa voiture. Elle veut un nom, on lui montre un formulaire.
- Principe candidat : sur téléphone, une liste montre un champ de recherche et un bouton « Filtres » ; le premier résultat est dans le premier écran.

### H-MA-08 — Carnet sur téléphone : 138 px par prestataire pour un nom, « Non placé sur la carte » et « Archiver »
- Écran et taille : `/prestataires`, 375×812
- Constat : chaque ligne montre le nom (lien vert souligné), « Non placé sur la carte » et un lien noir souligné « Archiver ». Ni métier, ni ville, ni téléphone. Cinq prestataires par écran. La seule action de ligne est la plus rare, elle a l'air d'un lien de lecture, sa cible fait environ 18 px de haut.
- Preuve : `P/a-022.jpg`.
- Gravité présumée : freine
- Qui bute : la planner qui veut appeler : il faut ouvrir chaque fiche. Celle qui défile vite peut toucher « Archiver ».
- Principe candidat : une ligne de liste montre ce qui sert à reconnaître et à agir (métier, ville, téléphone à toucher) ; une action qui retire n'est jamais la seule action de ligne.

### H-MA-09 — Le champ « Où ? » du carnet est un carré de 26 px qui sort du cadre
- Écran et taille : `/prestataires`, 375×812 et 911×512
- Constat : en 375 px, le champ de lieu fait environ 26 px de large, collé au bord gauche de l'écran (à 3 px, hors de la marge de 16 px). « dans un rayon de » et la liste « 15 km » flottent au centre d'un bloc blanc. En 911 px, même carré, à cheval sur le champ voisin. On ne peut pas lire ce que l'on tape.
- Preuve : `P/a-021.jpg`, `REL/prestataires--375-haut.jpg`, `REL/prestataires--zoom150-haut.jpg`.
- Gravité présumée : freine
- Qui bute : la planner qui cherche « un fleuriste à 20 km de Sarlat » : le champ n'a pas l'air d'un champ.
- Principe candidat : un champ a une largeur minimale de douze caractères ; sur téléphone il prend la largeur de l'écran, et son unité passe dessous.

### H-MA-10 — Liste des évènements sur téléphone : le premier évènement est sous le premier écran, son statut est coupé
- Écran et taille : `/events`, Camille, 375×812
- Constat : avant le tableau : trois boutons, la bascule « Liste / Colonnes / Calendrier », quatre filtres empilés, la bascule « À venir / Terminés / Archivés », collée au champ « Année » (aucun espace). La première ligne, « Baptême », est vers 835 px. Le tableau déborde : la pastille de statut est coupée (« En prépar »), la colonne « Lieu » est hors du cadre. Avec les 65 évènements de l'agence, le relevé mesure 8 hauteurs d'écran.
- Preuve : `REL/events--375.jpg` ; relevé, § 2 (« Longueur »).
- Gravité présumée : freine
- Qui bute : la planner qui ouvre « Évènements » pour toucher un mariage : rien à toucher dans le premier écran.
- Principe candidat : le premier écran d'une liste contient au moins trois lignes de la liste, à toutes les tailles.

### H-MA-11 — Portable à 150 % : le tableau des tâches perd aussi ses dernières colonnes
- Écran et taille : `/taches`, 911×512
- Constat : le menu latéral garde 232 px sur 911 (un quart de la largeur). Dans ce qui reste, l'en-tête « Qui la réalise » est coupé (« QUI L / RÉAL »), la pastille de la personne aussi (« Pla »), et la colonne des actions (« Modifier », « Reporter », « Supprimer ») est hors du cadre. Le titre de la tâche tient sur trois lignes.
- Preuve : `P/c-tab2.jpg`, `REL/taches--zoom150-haut.jpg`.
- Gravité présumée : freine
- Qui bute : la planner qui grossit l'affichage parce qu'elle voit mal, sur un portable de 13 ou 14 pouces : c'est elle qui a le plus besoin de tout voir sans chercher.
- Principe candidat : la mise en page se choisit sur la largeur du contenu, pas sur celle de la fenêtre ; à 150 %, aucune colonne ne sort du cadre.

### H-MA-12 — Portable à 150 % : les Paramètres s'empilent comme sur téléphone
- Écran et taille : `/parametres/notifications`, 911×512
- Constat : le menu des Paramètres est au-dessus du réglage, comme en 375 px. Le premier écran montre « Chercher un réglage » et cinq rubriques ; le titre « Notifications » n'y est pas. Le relevé compte zéro commande du réglage dans le premier écran, à cette taille, sur 55 écrans sur 58.
- Preuve : `REL/parametres_notifications--zoom150-haut.jpg` ; relevé, § 5 (colonne « Zones zoom » à 0).
- Gravité présumée : freine
- Qui bute : la même planner que H-MA-11, sur son ordinateur, pas sur son téléphone : elle ne s'attend pas à un écran de téléphone.
- Principe candidat : entre 768 et 1 024 px, le menu de second niveau se replie en une liste déroulante au-dessus du titre ; il ne prend jamais plus d'une ligne.

### H-MA-13 — Portable à 150 % : le premier écran de la fiche et des listes ne contient aucune ligne
- Écran et taille : `/events/[id]`, `/events`, `/taches`, 911×512
- Constat : sur la fiche, les 512 px montrent le titre, quatre boutons, la frise et « Reporter / Annuler » : les onglets sont dessous. Sur « Évènements », la première ligne est coupée au bord bas. Sur « Tâches », le premier titre de tâche commence à 500 px. Dans le menu, « Tâches · 2 en retard » tient sur deux lignes.
- Preuve : `REL/events_id_--zoom150-haut.jpg`, `REL/events--zoom150-haut.jpg`, `REL/taches--zoom150-haut.jpg`.
- Gravité présumée : freine
- Qui bute : la planner sur petit portable grossi : chaque écran commence par un défilement.
- Principe candidat : à 911×512, le premier écran d'une liste montre trois lignes et celui d'une fiche montre ses onglets.

### H-MA-14 — Un titre de tâche sur trois à cinq lignes dans une colonne de 100 px
- Écran et taille : `/taches`, 375×812
- Constat : la colonne « Tâche » fait environ 100 px : « Faire signer le contrat du photographe » tient sur trois lignes, plus la pastille « En retard », plus « Léa & Maxime » : cinq lignes, 135 px par tâche. Six tâches par écran, sans leur date. Le relevé compte 12 titres sur deux lignes ou plus sur cet écran, 42 dans « Toutes ».
- Preuve : `P/a-006.jpg` ; relevé, § 5.
- Gravité présumée : freine
- Qui bute : la planner qui passe ses tâches en revue : elle lit des mots coupés (« Faire signer / le contrat du / photographe »).
- Principe candidat : sur téléphone, le titre d'une ligne a toute la largeur ; ses attributs passent dessous, en une ligne.

### H-MA-15 — Tâches sur téléphone : une case de 20 px et un rond de 24 px côte à côte, pour deux gestes différents
- Écran et taille : `/taches`, 375×812
- Constat : sur chaque ligne, la case de sélection (carrée, 20 px) et le rond « Fait » (24 px) sont à 46 px l'un de l'autre. L'une ouvre une barre d'actions en lot, l'autre termine la tâche. Le relevé compte 40 cibles de moins de 44 px sur cet écran, 133 dans « Toutes », 17 dans le Rétroplanning.
- Preuve : `P/a-006.jpg` ; relevé, § 5 ; `CODE/app/globals.css` ligne 5996 (« rond, pour ne pas se confondre avec la case de sélection »).
- Gravité présumée : freine
- Qui bute : la planner au pouce : elle veut cocher « fait », touche la case de gauche, voit une barre qu'elle n'attendait pas.
- Principe candidat : une seule case par ligne sur téléphone, celle de « fait », dans une cible de 44 px ; la sélection en lot s'ouvre par un bouton « Sélectionner ».

### H-MA-16 — Visite guidée sur téléphone : à l'étape 2, la bulle parle d'une zone que l'écran ne montre pas
- Écran et taille : `/`, « ? › Revoir la visite », Camille, 375×812
- Constat : étape « 2 sur 4 », « Le reste, par urgence — En retard, aujourd'hui, en attente d'un tiers, puis les quatorze prochains jours. » L'écran reste sur la carte « À traiter en premier », sans cadre, tout grisé : la zone visée n'est pas trouvée sur cette page, et rien ne le dit. La planner lit une phrase sur « le reste » en regardant « le premier ».
- Preuve : `P/b-004.jpg` (étape 2 : même défilement, 379 px, qu'à l'étape 1, aucun cadre) à comparer à `P/b-003.jpg` (étape 1) et `P/b-005.jpg` (étape 3, cadre net) ; `CODE/../../packages/ui/src/guided-tour.tsx` (« une étape dont la zone n'est pas à l'écran a sa bulle seule »).
- Gravité présumée : freine
- Qui bute : la débutante, à sa première visite : elle cherche à l'écran ce dont on lui parle, ne le trouve pas, et doute de la suite.
- Principe candidat : une étape de visite dont la zone n'existe pas sur la page est sautée ; une bulle ne décrit que ce qui est encadré.

### H-MA-17 — Future marque bleu vif, orange, crème : l'orange ne peut ni porter du texte, ni redevenir une alerte
- Écran et taille : toutes
- Constat : calculs sur des teintes types. Orange vif #F28C28 sur crème #FFF7EA : 2,31 ; blanc sur cet orange : 2,45 : aucun texte, aucune icône fine. Seule l'encre sur orange passe (7,25). Un bleu vif à la #3B82F6 ne passe ni en texte sur crème (3,46), ni sous du texte blanc (3,68) ; il faut un bleu à la #2563EB (4,86 et 5,17) ou plus sombre (#1D4ED8 : 6,30). Le gris actuel #5A6372 sur crème reste à 5,70. Surtout : l'app emploie déjà un orange pour « attention » (#9A5B00 sur #FBF0DC) et un rouge pour « en retard ». Un bouton orange se confondra avec une alerte, et un fond crème avec le fond des pastilles d'attention.
- Preuve : `CODE/app/globals.css` lignes 31-50 (jetons `attention`, `critical`) ; calcul WCAG ; `P/b-003.jpg` (pastilles rouges « En retard de 5 jours », orange « Le 29 novembre 2026 »).
- Gravité présumée : freine (à la refonte)
- Qui bute : toutes : si l'orange est la couleur de l'action, « attention » et « touchez ici » se ressemblent.
- Principe candidat : le bleu porte l'action et les liens (4,5:1 au moins sur crème) ; l'orange est un accent sans texte, jamais un état ; chaque état garde sa teinte, doublée d'un mot ou d'une icône.

### H-MA-18 — Au clavier, sept arrêts par tâche : 77 pressions pour traverser onze tâches
- Écran et taille : `/taches`, 911×512 et 1 440 px
- Constat : chaque ligne a sept éléments focalisables : case de sélection, « Fait », titre, échéance, « Modifier », « Reporter », « Supprimer ». Onze tâches : 77 pressions de Tab ; « Toutes » (42 tâches) : 294. Aucun raccourci ne saute au mois suivant ni à la fin du tableau. L'ordre, lui, est logique : « Réglages », « Liste », « Calendrier », « À faire »…, puis le tableau.
- Preuve : `CODE/app/taches/task-table-client.tsx` lignes 300-380 (compté dans le code, non parcouru jusqu'au bout) ; `P/c-tab2.jpg`, `P/c-tab3.jpg`, `P/c-tab5.jpg` (ordre et anneau).
- Gravité présumée : gêne
- Qui bute : la planner qui travaille au clavier (douleur au poignet, lecteur d'écran) : la formule « Tâches hors évènement », sous le tableau, est à 80 pressions.
- Principe candidat : une ligne de liste a deux arrêts au clavier (son action principale, son menu « … ») ; les flèches parcourent les lignes.

### H-MA-19 — Deux rangées de filtres sans nom ; l'option active ne tient qu'à un fond à 1,16
- Écran et taille : `/taches` et Rétroplanning, 375×812
- Constat : « À faire / En retard / Toutes » puis « Tout le monde / Planner / Mariés » : deux rangées de pastilles identiques, sans libellé. La seconde passe à la ligne (« Mariés » seul). L'option active a un fond vert pâle (#E3F1EE sur blanc : 1,16) et une bordure verte ; pas de coche, pas de graisse. Le code pose `aria-current="true"` : le lecteur d'écran le dit, l'œil doit le deviner.
- Preuve : `REL/taches--375-haut.jpg`, `P/a-019.jpg` ; `CODE/app/events/[id]/page.tsx` lignes 1158-1165.
- Gravité présumée : gêne
- Qui bute : la planner au soleil ou à la vue basse ; celle qui ne comprend pas ce que filtre la seconde rangée.
- Principe candidat : un groupe de filtres a un nom ; l'option active porte une coche ou une graisse en plus de la couleur.

### H-MA-20 — Synthèse sur téléphone : la pastille de date passe sous le bouton « Noter une relance »
- Écran et taille : `/events/[id]` (Synthèse), 375×812
- Constat : dans « Prochaine action », la pastille « Depuis le 25 novembre 2026 » est recouverte par le bouton « Noter une relance » : on lit « Depuis le 25 novembre 202 ». Le titre « Contrat de Maison Haddad (Traiteur) à faire signer » est serré sur trois lignes à gauche du bouton. « Reporter » et « Voir 3 de plus » sont empilés en bas à gauche, loin des « Fait » de droite.
- Preuve : `P/a-013.jpg` ; même recouvrement pendant la visite, `P/b-004.jpg`.
- Gravité présumée : gêne
- Qui bute : toute planner sur téléphone : l'écran a l'air cassé.
- Principe candidat : sur téléphone, l'action d'une ligne passe sous son texte dès que son libellé dépasse un mot.

### H-MA-21 — Frise de statut sur téléphone : trois ou quatre lignes par étape, et deux liens de 18 px dessous
- Écran et taille : `/events/[id]`, 375×812 et 360×780
- Constat : « En préparation » est coupé en « En / préparation », les dates tiennent sur trois lignes (« 24 / novembre / 2026 »), « après le 30 janvier 2027 » sur quatre. Sous la frise, « Reporter l'évènement… » (vert) et « Annuler l'évènement… » (rouge) sont deux liens d'environ 18 px de haut, à 28 px l'un de l'autre. En 360 px, « Annuler l'évènement… » ne tient plus à côté de « Reporter l'évènement… ».
- Preuve : `REL/events_id_--375-haut.jpg`, `P/b-009.jpg` (360 px).
- Gravité présumée : gêne
- Qui bute : la planner au pouce : « Annuler l'évènement » est une petite cible à côté d'une autre petite cible.
- Principe candidat : sur téléphone, une frise dit l'étape en cours en toutes lettres et montre les autres en points ; un geste lourd n'est jamais un petit lien voisin d'un autre.

### H-MA-22 — La recherche du haut est coupée à « Recher » et affiche « ⌘K » sur un téléphone
- Écran et taille : toutes les pages, 375×812 (« Recher ») et 360×780 (« Rech »)
- Constat : le champ de recherche fait environ 127 px ; son invite est coupée et recouverte par la pastille « ⌘K », un raccourci de clavier d'ordinateur. « Créer », la cloche et « ? » se partagent le reste. Cette barre (84 px) s'ajoute à la barre de marque (76 px) : 160 px avant le titre de chaque page. En 911 px, l'invite est coupée aussi (« …un devis, une tâcl »).
- Preuve : `P/b-001.jpg`, `P/b-009.jpg`, `REL/taches--zoom150-haut.jpg`.
- Gravité présumée : gêne
- Qui bute : la planner sur téléphone : elle ne reconnaît pas une recherche, et « ⌘K » ne lui dit rien.
- Principe candidat : sur téléphone, une seule barre du haut (marque, loupe, « Créer », menu) ; aucun raccourci de clavier affiché sur un écran tactile ; une invite de champ n'est jamais coupée.

### H-MA-23 — « Nouveau prestataire » sur téléphone : 240 px de sommaire avant le premier champ
- Écran et taille : `/prestataires/nouveau`, 375×812
- Constat : le sommaire des quatre rubriques (« Identité », « Métiers et étiquettes », « Coordonnées », « Tarifs et note ») est empilé au-dessus du formulaire, suivi de « Rubrique 1 sur 4 » et du titre « Identité », déjà dit deux fois. Le premier champ, « Nom du prestataire », est vers 770 px : en bas du premier écran, sous le clavier dès qu'il s'ouvre (supposé : je n'ai pas vu le clavier).
- Preuve : `P/a-025.jpg`.
- Gravité présumée : gêne
- Qui bute : la planner qui note, debout, un prestataire croisé sur un salon.
- Principe candidat : sur téléphone, les étapes d'un formulaire tiennent en une ligne (« 1 sur 4 · Identité ») ; le premier champ est dans la moitié haute de l'écran.

### H-MA-24 — Panneau d'une tâche : deux sorties sans enregistrer, « Supprimer la tâche » à 14 px du bouton principal
- Écran et taille : `/taches?tache=…`, 375×812 et 911×512
- Constat : sur téléphone, le panneau prend tout l'écran et « Enregistrer » est en bas à droite, sous le pouce (bien). Mais il a deux sorties qui font la même chose, « Retour » en haut à gauche et « Annuler » en bas (« Fermer » et « Annuler » en 911 px : un troisième mot), et « Supprimer la tâche » (bordure rouge) est 14 px au-dessus de la rangée « Annuler / Enregistrer ». Échap ferme le panneau (vérifié).
- Preuve : `P/a-008.jpg`, `REL/taches_tache--zoom150-haut.jpg`.
- Gravité présumée : gêne
- Qui bute : la planner au pouce droit : « Supprimer la tâche » est dans la zone d'« Enregistrer ».
- Principe candidat : dans un panneau d'édition, une seule sortie sans enregistrer, toujours du même nom ; la suppression est en haut, loin du bouton principal.

### H-MA-25 — Aide d'écran sur téléphone : un paragraphe gris de 95 à 150 mots sur 60 % de l'écran, « Revoir la visite » au bord
- Écran et taille : « ? » sur `/taches` et sur `/`, 375×812
- Constat : le tiroir monte du bas : 300 px sur Tâches, 487 px sur Aujourd'hui (60 % de l'écran). Il contient un seul paragraphe de 13 px, gris, sans puce : environ 95 mots sur Tâches, 150 sur Aujourd'hui. Le bouton « Revoir la visite » est à cheval sur le bord bas de l'écran. La croix de fermeture fait 36 px. Sur Tâches, le texte décrit « Modifier », « Reporter », « Supprimer » « sur chaque ligne », que le téléphone ne montre pas, et s'intitule « Les tâches de tous vos mariages » chez une planner qui organise aussi un baptême.
- Preuve : `P/a-036.jpg` (Tâches), `P/b-002.jpg` (Aujourd'hui) ; `CODE/app/globals.css` lignes 1923 et 1936.
- Gravité présumée : gêne
- Qui bute : la débutante qui demande de l'aide sur son téléphone : elle lit la description d'un écran qu'elle ne voit pas, et ne voit pas le bouton de la visite.
- Principe candidat : l'aide d'un écran tient en trois à cinq puces, décrit ce que l'on voit à cette taille, et commence par son action (« Revoir la visite »).

### H-MA-26 — Visite guidée sur téléphone : la bulle couvre le bas de la zone qu'elle encadre, et son texte ne colle pas à l'écran
- Écran et taille : `/`, visite, étape 1, 375×812
- Constat : la bulle est ancrée en bas (245 px, sous le pouce : bien). La carte « À traiter en premier » est encadrée de vert, mais elle est plus haute que la place libre : son cadre et ses dernières lignes passent sous la bulle. La bulle dit « Les trois points les plus urgents » ; la carte affiche « Tâches (4) » et « Relances et messages (1) ».
- Preuve : `P/b-003.jpg`.
- Gravité présumée : gêne
- Qui bute : la débutante : elle compte trois, en voit quatre et plus.
- Principe candidat : une zone de visite tient entière au-dessus de la bulle, sinon la visite encadre son titre seul ; le texte d'une bulle ne cite aucun nombre que l'écran peut contredire.

### H-MA-27 — Couleurs actuelles : les textes passent, les états reposent sur des fonds à 1,1
- Écran et taille : toutes
- Constat : rapports calculés. Textes : encre #14181F sur fond #F6F7F9 : 16,6 ; gris #5A6372 sur blanc 6,07, sur fond 5,66, sur vert pâle 5,22 ; vert #0F6E5C sur blanc 6,17 et sur vert pâle #E3F1EE (bandeau « Votre fiche entreprise… », pastille « Confirmé ») 5,31 ; blanc sur vert 6,17 ; pastille rouge #B3261E sur #FBE9E7 : 5,58 ; pastille orange #9A5B00 sur #FBF0DC : 4,81 (juste au-dessus de 4,5) ; tâche faite, grise et barrée, sur blanc : 6,07. Non-textes : bordure des champs #838C99 sur blanc 3,40 et sur fond 3,17 (passe de peu) ; bordure des cartes #DDE1E7 : 1,31 ; fond de l'option active, de la ligne courante du menu et de la ligne sélectionnée : 1,16 sur blanc, 1,08 sur le fond.
- Preuve : `CODE/app/globals.css` lignes 31-50 et 471-494 ; calcul WCAG.
- Gravité présumée : gêne
- Qui bute : la planner au soleil ou à la vue basse : « où suis-je dans le menu », « quel filtre est actif » ne tiennent qu'à un fond presque blanc.
- Principe candidat : un état (actif, sélectionné, courant) se lit sans son fond : trait de 2 px à 3:1 au moins, graisse ou coche.

### H-MA-28 — Liens : les titres de tâche sont noirs et non soulignés ; le vert des liens a la clarté du gris
- Écran et taille : `/taches`, Rétroplanning, toutes tailles
- Constat : le titre d'une tâche est un lien écrit en encre, sans soulignement ; le soulignement n'apparaît qu'au survol, qui n'existe pas au doigt. Le relevé en compte 11 par écran. Ailleurs (Aujourd'hui, carnet), les liens sont verts et soulignés. Le vert des liens (#0F6E5C) et le gris des textes secondaires (#5A6372) ont un rapport de 1,02 entre eux, et le vert sur l'encre 2,89 : sans soulignement, un lien ne se distingue ni du gris, ni, pour une daltonienne, du noir.
- Preuve : `P/a-006.jpg` (titres noirs), `P/b-003.jpg` (titres verts soulignés d'Aujourd'hui) ; `CODE/app/globals.css` ligne 6003 (`text-ink no-underline hover:underline`) ; relevé, § 2 (« Affordance »).
- Gravité présumée : gêne
- Qui bute : toute planner sur téléphone : la même tâche est un lien vert souligné sur « Aujourd'hui » et un texte noir dans « Tâches ».
- Principe candidat : un même objet a la même apparence de lien partout ; tout lien est souligné, la couleur ne porte jamais seule le sens.

### H-MA-29 — L'orange a déjà trois sens : « attention », « Mariés », « priorité haute »
- Écran et taille : `/taches`, Rétroplanning, Aujourd'hui, fiche
- Constat : la même pastille orange (`badge-ambre`) sert à une date proche (« Le 29 novembre 2026 »), à un état (« À surveiller »), à la personne « Mariés » dans « Qui la réalise » et à « Priorité haute ». La pastille « Planner », nommée `badge-bleu` dans le code, est grise. Une tâche confiée aux mariés a donc l'air d'une alerte.
- Preuve : `CODE/app/taches/task-table-client.tsx` lignes 325 et 351 ; `CODE/app/globals.css` lignes 488-494 ; `P/b-003.jpg` (date), `P/a-013.jpg` (« À surveiller »). La pastille « Mariés » est hors du cadre sur téléphone : lue dans le code, vue sur `REL/taches--zoom150-haut.jpg` seulement pour « Pla ».
- Gravité présumée : gêne
- Qui bute : la planner qui balaie la liste à la couleur : elle prend « Mariés » pour une urgence.
- Principe candidat : une couleur, un sens ; une personne ou une catégorie ne prend jamais une couleur d'état.

### H-MA-30 — « Se déconnecter » et « Créer une autre organisation » sont au bout du menu, sous le pouce
- Écran et taille : menu ouvert, 375×812
- Constat : en bas du menu : « Connecté comme camille.roussel+spec@exemple.test », le lien « Créer une autre organisation », puis le bouton « Se déconnecter », à 40 px l'un de l'autre. Deux gestes rares et lourds occupent la zone la plus facile à toucher, juste au-dessus du contenu de la page qui reparaît.
- Preuve : `P/a-004.jpg`.
- Gravité présumée : gêne
- Qui bute : la planner qui fait défiler le menu et pose le pouce en bas.
- Principe candidat : les gestes rares et lourds vont dans le compte, pas au bout du menu de tous les jours.

### H-MA-31 — La touche N ouvre un menu coupé en haut dès que la page a défilé
- Écran et taille : `/taches`, 911×512, page défilée de 116 px
- Constat : N ouvre bien « Créer » (« Prospect », « Tâche », « Dépense », « Devis »), le focus est sur « Prospect », l'anneau est net. Mais le menu reste accroché au bouton « Créer », sorti de l'écran : son en-tête « Raccourci : touche N » est coupé par le bord haut. Plus bas dans la page, le menu s'ouvrirait hors de l'écran (supposé : non essayé).
- Preuve : `P/d-touche-n.jpg`.
- Gravité présumée : gêne
- Qui bute : la planner au clavier, au milieu d'une longue liste : elle tape N et ne voit rien venir.
- Principe candidat : un menu ouvert par un raccourci s'affiche dans l'écran, où que soit son bouton ; la barre du haut reste visible.

### H-MA-32 — Notifications sur téléphone : en-têtes sur deux lignes, colonne « Push » au bord
- Écran et taille : `/parametres/notifications`, 375×812
- Constat : dans « Par sorte et par canal », « DANS L'APPLICATION » et « E-MAIL » passent sur deux lignes ; « PUSH » touche le bord droit de la carte et un filet dépasse. Le relevé compte 14 libellés sur deux lignes sur cet écran.
- Preuve : `P/a-027.jpg` ; relevé, § 5.
- Gravité présumée : détail
- Qui bute : la planner qui règle ses notifications sur le téléphone qui les reçoit.
- Principe candidat : une grille de cases à cocher devient, sur téléphone, une liste par sorte avec ses canaux en ligne.

### H-MA-33 — Fermer l'aide par Échap renvoie la page tout en haut
- Écran et taille : `/taches`, 911×512
- Constat : page défilée de 116 px, « ? » ouvre l'aide (170 px en bas, un tiers de l'écran), Échap la ferme : la page revient à 0 px, parce que le focus retourne au bouton « ? » de la barre du haut. Dans une liste de 42 tâches, la planner perd sa place. Ce qui est bien : « ? » et Échap marchent, le focus revient à son point de départ.
- Preuve : `P/d-aide.jpg`, `P/d-echap2.jpg` ; défilement rendu par le navigateur (116 → 0).
- Gravité présumée : détail
- Qui bute : la planner au clavier qui consulte l'aide au milieu d'une liste.
- Principe candidat : fermer une aide ou un panneau rend la page là où elle était.

### H-MA-34 — Carte du carnet sur téléphone : un texte coupé sous la carte, des boutons de 30 px
- Écran et taille : `/prestataires?vue=carte`, 375×812
- Constat : sous la carte, un texte qui commence par « Au… » est recouvert par l'encart de la carte. Les boutons « + » et « − » font environ 30 px. Le fond de carte n'est pas installé dans cet environnement : je ne juge ni la carte, ni ses points.
- Preuve : `P/a-024.jpg`.
- Gravité présumée : détail
- Qui bute : toute planner sur téléphone.
- Principe candidat : aucun texte sous un autre bloc ; les commandes d'une carte font 44 px.

### H-MA-35 — En 360 px, « Type d'événement : » passe sur deux lignes
- Écran et taille : `/events/[id]`, 360×780
- Constat : le libellé « Type d'événement : » se coupe en « Type / d'événement : » à gauche de sa liste ; « Changer le type » reste un texte vert sans bordure sous la liste, à côté de quatre boutons bordés.
- Preuve : `P/b-009.jpg`.
- Gravité présumée : détail
- Qui bute : la planner sur un téléphone étroit (beaucoup d'Android sont à 360 px).
- Principe candidat : sur téléphone, un libellé de champ est au-dessus de son champ, jamais à côté.

### H-MA-36 — Visite guidée : « Passer la visite » reste à côté de « Terminer »
- Écran et taille : `/`, visite, étape 4, 375×812
- Constat : à la dernière étape, la rangée montre « Passer la visite », « Précédent », « Terminer » : deux boutons qui ferment. À toutes les étapes, on peut sortir : « Passer la visite » sur téléphone, Échap au clavier (vérifié : la visite se ferme, la page reste où elle était). Les trois boutons tiennent sur une ligne en 375 px, à 8 px l'un de l'autre.
- Preuve : `P/b-006.jpg`, `P/b-007.jpg` (après Échap).
- Gravité présumée : détail
- Qui bute : personne ne reste bloquée ; c'est un mot de trop.
- Principe candidat : à la dernière étape d'un parcours, une seule sortie.

### H-MA-37 — Ce qui est bien fait et doit survivre à la refonte
- Écran et taille : `/` en 375×812 ; `/taches` au clavier ; code
- Constat : « Aujourd'hui » est le seul des quatre modules qui tient sur téléphone : des cartes, pas de tableau, le titre en lien souligné, la date en pastille, un bouton « Fait » de 44 px à droite, sous le pouce. Au clavier : lien d'évitement « Aller au contenu » visible au focus et qui saute bien la barre du haut ; anneau de focus vert de 2 px, décalé de 2 px, net sur tout ce que j'ai parcouru ; Ctrl K pose le focus dans la recherche ; Échap ferme le panneau d'une tâche, l'aide et la visite. Dans le code : tableau des tâches avec légende, `scope`, région défilable nommée et focalisable ; chaque case et chaque bouton de ligne nomme sa tâche (« Sélectionner « Choisir le fleuriste » ») ; « Fait » porte `aria-pressed` ; une tâche faite a trois signes (coche, texte barré, pastille « Faite ») ; onglets en `nav` avec `aria-current="page"` ; frise en liste ordonnée avec `aria-current="step"` ; messages de retour en `role="status"`. La ligne cliquable du tableau double un vrai lien : le clavier et le lecteur d'écran n'y perdent rien.
- Preuve : `P/b-001.jpg`, `P/b-003.jpg` ; `P/c-tab1.jpg`, `P/c-tab2.jpg`, `P/c-tab5.jpg`, `P/d-ctrlk.jpg` ; `CODE/app/taches/task-table-client.tsx`, `CODE/app/taches/task-check.tsx` ligne 43, `CODE/app/events/[id]/page.tsx` ligne 766, `CODE/app/events/[id]/change-status-form.tsx` ligne 81.
- Gravité présumée : détail
- Qui bute : personne ; c'est l'acquis à ne pas perdre.
- Principe candidat : le motif de carte d'« Aujourd'hui » est le modèle de toute liste sur téléphone ; toute ligne cliquable contient un lien ou un bouton qui fait la même chose.

## 3. Dix principes de Design System

1. **Pas de défilement horizontal sur téléphone.** Un tableau devient une liste de cartes sur le modèle d'« Aujourd'hui », sans largeur minimale ; chaque valeur est à côté de son libellé, dans l'écran.
2. **Le premier écran montre du contenu.** Trois lignes d'une liste, ou les onglets d'une fiche, en 375×812 comme en 911×512 ; au plus 300 px d'en-tête ; les filtres derrière un bouton.
3. **Un menu de second niveau est un écran à lui seul sur téléphone**, et une seule ligne entre 768 et 1 024 px. Jamais un bloc empilé au-dessus du contenu.
4. **Le menu du téléphone est un panneau par-dessus la page** : bouton de fermeture toujours visible, Échap, toucher dehors. La barre du haut tient en une ligne et reste visible.
5. **Cibles de 44 px, gestes séparés.** Deux cibles voisines qui font des gestes différents sont à 8 px au moins ; un geste qui retire ou annule n'est ni un petit lien, ni le voisin du bouton principal.
6. **Une ligne, une action sous le pouce, le reste derrière « … ».** Deux arrêts au clavier par ligne. L'action principale d'un écran ou d'un panneau est en bas à droite ; une seule sortie sans enregistrer, toujours du même nom.
7. **Un état se lit sans la couleur ni le fond** : mot, coche, graisse ou trait à 3:1. Une couleur a un seul sens ; une personne ou une catégorie ne prend pas une couleur d'état.
8. **Tout lien est souligné et un même objet a la même apparence partout.** Dans la future marque, le bleu (4,5:1 au moins sur crème) porte liens et action ; l'orange ne porte ni texte, ni état.
9. **Ce qui déborde le montre, ce qui est actif reste à l'écran** : onglet actif ramené dans le cadre, menu ouvert par raccourci affiché dans l'écran, page rendue à sa place quand un panneau se ferme.
10. **L'aide et les visites décrivent ce que l'écran montre à cette taille** : trois à cinq puces, l'action d'abord, une bulle qui ne parle que de ce qu'elle encadre et ne le recouvre pas.
